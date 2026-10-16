import type { ScreenDevice } from "./canvasDrag";

/**
 * A setting that may differ by screen, as the storefront reads it
 * (storefront lib/deviceValue.ts): one value for every screen, or
 * `{ base, tablet, mobile }` with any left out — a tablet falls back to the
 * computer's value, a phone to the tablet's.
 */
export type DeviceValue<T> = T | { base?: T; tablet?: T; mobile?: T };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** The value saved for each screen. */
export function deviceParts(saved: unknown): Partial<Record<ScreenDevice, unknown>> {
  if (saved === undefined || saved === null) return {};
  if (!isRecord(saved)) return { base: saved };
  const out: Partial<Record<ScreenDevice, unknown>> = {};
  for (const device of ["base", "tablet", "mobile"] as const) if (saved[device] !== undefined && saved[device] !== null) out[device] = saved[device];
  return out;
}

/** What one screen shows: its own value, or the next larger screen's. */
export function valueOnDevice(saved: unknown, device: ScreenDevice): unknown {
  const parts = deviceParts(saved);
  if (device === "mobile") return parts.mobile ?? parts.tablet ?? parts.base;
  if (device === "tablet") return parts.tablet ?? parts.base;
  return parts.base;
}

/** Whether a screen has a value of its own (not one it falls back to). */
export function hasOwnOnDevice(saved: unknown, device: ScreenDevice): boolean {
  return deviceParts(saved)[device] !== undefined;
}

/**
 * The setting with one screen's value set — or, for null, taken away so that
 * screen falls back again. Written as a plain value while only a computer's
 * is set, so a page that never used another screen keeps its old shape;
 * undefined once nothing is left.
 */
export function withDeviceValue(saved: unknown, device: ScreenDevice, value: unknown): unknown {
  const parts = deviceParts(saved);
  if (value === null || value === undefined) delete parts[device];
  else parts[device] = value;
  const keys = Object.keys(parts);
  if (keys.length === 0) return undefined;
  if (keys.length === 1 && parts.base !== undefined) return parts.base;
  return parts;
}
