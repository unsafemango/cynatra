import { config } from "./config.js";

/** Calls the Go picker service and returns its status and JSON body. */
export async function callPicker(path: string, init?: RequestInit) {
  const res = await fetch(config.pickerUrl + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(25_000),
  });
  return { status: res.status, body: await res.json() };
}
