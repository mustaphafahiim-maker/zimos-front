/**
 * A setting that may differ by screen: one value for every screen, or
 * `{ base, tablet, mobile }` with any of the three left out. `base` is a
 * computer's; a tablet takes its own or else the computer's, a phone its own
 * or else the tablet's. The screens are the page builder's (elementStyle.ts):
 * a tablet from 1023px down, a phone from 639px down.
 *
 * The server checks each value (zimos modules/pages/xsElements.js
 * `perDevice`); the editor writes the one for the screen it is previewing.
 */

export type Device = "base" | "tablet" | "mobile";
export const DEVICES: readonly Device[] = ["base", "tablet", "mobile"];

export type PerDevice<T> = Partial<Record<Device, T>>;

/** Media queries for the two smaller screens. */
export const DEVICE_MEDIA: Record<Exclude<Device, "base">, string> = {
  tablet: "(max-width: 1023px)",
  mobile: "(max-width: 639px)",
};

/** The values a setting names for each screen, each one checked; null when it names none. */
export function perDevice<T>(raw: unknown, valid: (value: unknown) => value is T): PerDevice<T> | null {
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    const out: PerDevice<T> = {};
    for (const device of DEVICES) {
      const value = (raw as Record<string, unknown>)[device];
      if (valid(value)) out[device] = value;
    }
    return Object.keys(out).length > 0 ? out : null;
  }
  return valid(raw) ? { base: raw } : null;
}

/** What one screen shows: its own value, or the next larger screen's. */
export function onDevice<T>(values: PerDevice<T> | null, device: Device): T | undefined {
  if (!values) return undefined;
  if (device === "mobile") return values.mobile ?? values.tablet ?? values.base;
  if (device === "tablet") return values.tablet ?? values.base;
  return values.base;
}

/** A whole number from `least` to `most`. */
export const wholeIn =
  (least: number, most: number) =>
  (value: unknown): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= least && value <= most;
