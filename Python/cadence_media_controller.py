import asyncio
import time
from dataclasses import dataclass
from typing import Optional

from bleak import BleakClient, BleakScanner
from pynput.keyboard import Controller, Key

CSC_SERVICE_UUID = "00001816-0000-1000-8000-00805f9b34fb"
CSC_MEASUREMENT_UUID = "00002a5b-0000-1000-8000-00805f9b34fb"

# Tweak these as needed.
MIN_PLAY_RPM = 40
LOW_CADENCE_RPM = 15

RECONNECT_AFTER_SIGNAL_LOST_SECONDS = 12.0
RECONNECT_DELAY_SECONDS = 3.0

PLAY_AFTER_SECONDS = 2.0
PAUSE_AFTER_LOW_SECONDS = 3.0
PAUSE_AFTER_STOPPED_SECONDS = 3.0
SIGNAL_LOST_SECONDS = 8.0

SCAN_SECONDS = 12

keyboard = Controller()


@dataclass
class CrankSample:
    revs: int
    event_time: int


last_sample: Optional[CrankSample] = None
last_packet_at: Optional[float] = None
last_movement_at: Optional[float] = None

cadence_above_since: Optional[float] = None
cadence_low_since: Optional[float] = None

current_rpm: Optional[int] = None

# This assumes the user starts with media paused.
media_playing = False


def press_media_play_pause() -> None:
    keyboard.press(Key.media_play_pause)
    keyboard.release(Key.media_play_pause)


def parse_csc_packet(data: bytearray) -> Optional[CrankSample]:
    """
    Parses BLE Cycling Speed and Cadence measurement packets.
    This mirrors the logic used in my mobile app, but works with raw PC BLE bytes.
    """
    if len(data) < 1:
        return None

    offset = 0
    flags = data[offset]
    offset += 1

    wheel_present = (flags & 0x01) != 0
    crank_present = (flags & 0x02) != 0

    if wheel_present:
        if len(data) < offset + 6:
            return None
        offset += 4  # cumulative wheel revolutions
        offset += 2  # last wheel event time

    if not crank_present:
        return None

    if len(data) < offset + 4:
        return None

    revs = int.from_bytes(data[offset: offset + 2], "little")
    offset += 2

    event_time = int.from_bytes(data[offset: offset + 2], "little")

    return CrankSample(revs=revs, event_time=event_time)


def calculate_rpm(sample: CrankSample) -> Optional[int]:
    """
    Converts crank revolution deltas into RPM.
    CSC crank event time uses 1/1024 second units.
    """
    global last_sample

    previous = last_sample
    last_sample = sample

    if previous is None:
        return None

    d_revs = sample.revs - previous.revs
    if d_revs < 0:
        d_revs += 0x10000

    d_time = sample.event_time - previous.event_time
    if d_time < 0:
        d_time += 0x10000

    if d_revs <= 0 or d_time <= 0:
        return None

    seconds = d_time / 1024.0
    if seconds <= 0:
        return None

    return round((d_revs / seconds) * 60.0)


def get_display_rpm(now: float) -> int:
    if last_movement_at is None:
        return 0

    stopped_for_too_long = now - last_movement_at >= PAUSE_AFTER_STOPPED_SECONDS
    if stopped_for_too_long:
        return 0

    return current_rpm if current_rpm is not None else 0


def update_media_rule() -> None:
    """
    Cadence only version of my app's media rule engine.
    Pedalling above the threshold for long enough plays media.
    Low cadence or stopped cadence for long enough pauses media.
    """
    global cadence_above_since, cadence_low_since, media_playing

    now = time.time()
    rpm = get_display_rpm(now)

    signal_lost = (
        last_packet_at is not None and now - last_packet_at >= SIGNAL_LOST_SECONDS
    )

    if rpm >= MIN_PLAY_RPM and not signal_lost:
        if cadence_above_since is None:
            cadence_above_since = now
    else:
        cadence_above_since = None

    if rpm < LOW_CADENCE_RPM or signal_lost:
        if cadence_low_since is None:
            cadence_low_since = now
    else:
        cadence_low_since = None

    should_play = (
        cadence_above_since is not None
        and now - cadence_above_since >= PLAY_AFTER_SECONDS
    )

    should_pause = (
        cadence_low_since is not None
        and now - cadence_low_since >= PAUSE_AFTER_LOW_SECONDS
    )

    if not media_playing and should_play:
        print(f"PLAY  | cadence={rpm} rpm")
        press_media_play_pause()
        media_playing = True
        return

    if media_playing and should_pause:
        reason = "signal lost" if signal_lost else "cadence low/stopped"
        print(f"PAUSE | cadence={rpm} rpm | {reason}")
        press_media_play_pause()
        media_playing = False
        return

    print(
        f"rpm={rpm:>3} | "
        f"media={'PLAYING' if media_playing else 'PAUSED'} | "
        f"signal={'LOST' if signal_lost else 'OK'}"
    )


def handle_csc_notification(sender, data: bytearray) -> None:
    global last_packet_at, last_movement_at, current_rpm

    now = time.time()
    last_packet_at = now

    sample = parse_csc_packet(bytearray(data))
    if sample is None:
        return

    rpm = calculate_rpm(sample)

    if rpm is not None:
        current_rpm = rpm
        last_movement_at = now

    update_media_rule()


def device_matches(device) -> bool:
    name = (device.name or "").lower()

    if "wahoo" in name or "rpm" in name:
        return True

    metadata = getattr(device, "metadata", {}) or {}
    service_uuids = metadata.get("uuids", []) or []

    return any("1816" in uuid.lower() for uuid in service_uuids)


async def find_wahoo_device():
    print("Scanning for Wahoo RPM cadence sensor...")
    print("Start pedalling now to wake the sensor.\n")

    devices = await BleakScanner.discover(timeout=SCAN_SECONDS)

    print("Devices found:")
    for device in devices:
        print(f"  {device.name or 'Unknown'} | {device.address}")

    for device in devices:
        if device_matches(device):
            print(f"\nSelected: {device.name} | {device.address}")
            return device

    print("\nNo Wahoo RPM sensor found.")
    print("Make sure it is not connected to your phone or another app.")
    return None


def reset_sensor_state() -> None:
    global last_sample
    global last_packet_at
    global last_movement_at
    global cadence_above_since
    global cadence_low_since
    global current_rpm

    last_sample = None
    last_packet_at = None
    last_movement_at = None
    cadence_above_since = None
    cadence_low_since = None
    current_rpm = None


async def main() -> None:
    while True:
        reset_sensor_state()

        device = await find_wahoo_device()
        if device is None:
            print(f"Trying again in {RECONNECT_DELAY_SECONDS} seconds...\n")
            await asyncio.sleep(RECONNECT_DELAY_SECONDS)
            continue

        print("\nConnecting...")

        try:
            async with BleakClient(device.address) as client:
                print("Connected.")
                print("Subscribing to cadence notifications...")
                print("\nStart your video/music paused.")
                print("Pedal above the threshold to play.")
                print("Stop pedalling to pause.")
                print("Press Ctrl+C to stop.\n")

                await client.start_notify(
                    CSC_MEASUREMENT_UUID,
                    handle_csc_notification,
                )

                while True:
                    update_media_rule()

                    now = time.time()
                    signal_lost_too_long = (
                        last_packet_at is not None
                        and now - last_packet_at
                        >= RECONNECT_AFTER_SIGNAL_LOST_SECONDS
                    )

                    if signal_lost_too_long:
                        print("Signal lost too long. Reconnecting...\n")
                        break

                    await asyncio.sleep(1)

                await client.stop_notify(CSC_MEASUREMENT_UUID)

        except KeyboardInterrupt:
            print("Stopping...")
            return

        except Exception as exc:
            print(f"Connection error: {exc}")

        print(f"Reconnecting in {RECONNECT_DELAY_SECONDS} seconds...\n")
        await asyncio.sleep(RECONNECT_DELAY_SECONDS)


if __name__ == "__main__":
    asyncio.run(main())
