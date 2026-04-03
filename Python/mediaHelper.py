from fastapi import FastAPI
from pynput.keyboard import Controller, Key

app = FastAPI()
keyboard = Controller()

# This tracks the helpers expected playback state.
# If playback is changed manually outside the helper it can drift out of sync.
# so don't play or pause manually or it might get out of sync.
expected_playing = False


def press_media_play_pause() -> None:
    keyboard.press(Key.media_play_pause)
    keyboard.release(Key.media_play_pause)


@app.get("/health")
def health():
    return {"ok": True, "expectedPlaying": expected_playing}


@app.post("/toggle")
def toggle_media():
    global expected_playing

    press_media_play_pause()
    expected_playing = not expected_playing

    return {"ok": True, "expectedPlaying": expected_playing}


@app.post("/pause")
def pause_media():
    global expected_playing

    if expected_playing:
        press_media_play_pause()
        expected_playing = False

    return {"ok": True, "expectedPlaying": expected_playing}


@app.post("/play")
def play_media():
    global expected_playing

    if not expected_playing:
        press_media_play_pause()
        expected_playing = True

    return {"ok": True, "expectedPlaying": expected_playing}