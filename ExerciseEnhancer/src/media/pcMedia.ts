// src/media/pcMedia.ts

// the PC and the device running the expo app must be on the same local network for this to work.

//run ipconfig in cmd/powershell to get the IP address of the PC that will be used for media, and replace the placeholder IP below with the PCs IP. 
const PC_MEDIA_BASE_URL = "http://00.00.00.00:8765";//placeholder IP, I add my own PCs IP when running. 

// function to send requests to the PC media helper python script.
async function request(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${PC_MEDIA_BASE_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
}

// Check whether the PC helper is reachable on the local network.
export async function isPcMediaAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const response = await request("/health", {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

// function to send POST commands to the PC media helper.
async function postCommand(path: string): Promise<void> {
  const response = await request(path, { method: "POST" });

  if (!response.ok) {
    throw new Error(`PC media request failed: ${response.status}`);
  }
}

export async function pausePcMedia(): Promise<void> {
  await postCommand("/pause");
}

export async function playPcMedia(): Promise<void> {
  await postCommand("/play");
}

export async function togglePcMedia(): Promise<void> {
  await postCommand("/toggle");
}