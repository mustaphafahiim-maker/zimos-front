/**
 * Spin to win (backend: frontend-handoff item 258, src/modules/spinWheel).
 * An honest wheel: the server draws by the slices' weights and the store
 * shows every slice's real chance.
 *
 * Staff (discounts.manage), /workspaces/:ws/spin-wheel:
 *   GET /  → { config, preview, stats: { spins, prizes } } — `config` is null until the first
 *            save; `preview` is the wheel the shop would show (null when no prize can be won).
 *   PUT /  SpinWheelConfig (the whole config) → { config }
 *          2–12 slices; a prize is one of the store's discounts with a code; at least one
 *          prize needs a weight above 0. 422 VALIDATION_ERROR on `slices` otherwise — see
 *          `spinWheelProblemOf`.
 *
 * Storefront (public), /store/:ws/spin-wheel:
 *   GET /       → { wheel: StoreSpinWheel | null } — slices in the draw, with `chance` in %.
 *   POST /spin  { phone, fullName?, marketingConsent: true, website: "" } → 201 SpinResult
 *          409 ALREADY_SPUN (one spin per phone), 422 on `phone` or without the consent,
 *          404 SPIN_WHEEL_OFF. `website` is a honeypot: people send it empty.
 */
import { ApiError, type ApiClient } from "../client";
import { apiFieldProblems } from "../errors";

// ------------------------------------------------------------------ staff --

export interface SpinWheelSlice {
  /** Set by the server on the first save — send it back. */
  id?: string;
  /** What the wheel says on the slice, 40 characters at most. */
  label: string;
  /** One of the store's discounts with a code; null = no prize. */
  discountId: string | null;
  /** 0–1000, relative to the other slices; 0 leaves the slice out of the draw. */
  weight: number;
}

export interface SpinWheelConfig {
  enabled: boolean;
  title: string | null;
  text: string | null;
  /** Seconds before the popup opens, 0–600. */
  delaySeconds: number;
  slices: SpinWheelSlice[];
}

export const SPIN_WHEEL_LIMITS = {
  minSlices: 2,
  maxSlices: 12,
  labelMax: 40,
  weightMax: 1000,
  titleMax: 120,
  textMax: 300,
  delayMax: 600,
} as const;

/** A slice as shoppers see it: in the draw now, with its real chance. */
export interface StoreSpinWheelSlice {
  id: string;
  label: string;
  prize: boolean;
  /** Percent, one decimal. */
  chance: number;
}

export interface StoreSpinWheel {
  title: string | null;
  text: string | null;
  delaySeconds: number;
  slices: StoreSpinWheelSlice[];
}

export interface SpinWheelOverview {
  config: SpinWheelConfig | null;
  preview: StoreSpinWheel | null;
  stats: { spins: number; prizes: number };
}

/** GET /workspaces/:ws/spin-wheel. */
export async function spinWheelGet(client: ApiClient, workspaceId: string): Promise<SpinWheelOverview> {
  return client.request<SpinWheelOverview>(`/workspaces/${workspaceId}/spin-wheel`);
}

/** PUT /workspaces/:ws/spin-wheel: the whole config. The answer has no preview or stats — read them again. */
export async function spinWheelSave(client: ApiClient, workspaceId: string, config: SpinWheelConfig): Promise<SpinWheelConfig> {
  const body = await client.request<{ config: SpinWheelConfig }>(`/workspaces/${workspaceId}/spin-wheel`, {
    method: "PUT",
    body: {
      enabled: config.enabled,
      title: config.title ?? "",
      text: config.text ?? "",
      delaySeconds: config.delaySeconds,
      slices: config.slices.map((slice) => ({
        ...(slice.id ? { id: slice.id } : {}),
        label: slice.label,
        discountId: slice.discountId ?? null,
        weight: slice.weight,
      })),
    },
  });
  return body.config;
}

/** Which of the save's refusals this is, read from its message (the API sends no code of its own). */
export type SpinWheelProblem = "prize_not_coupon" | "no_prize_chance";

export function spinWheelProblemOf(err: unknown): SpinWheelProblem | null {
  for (const p of apiFieldProblems(err)) {
    if (p.field !== "slices") continue;
    if (/with a code/i.test(p.message)) return "prize_not_coupon";
    if (/chance above 0/i.test(p.message)) return "no_prize_chance";
  }
  return null;
}

// -------------------------------------------------------------- storefront --

/** GET /store/:ws/spin-wheel: the store's wheel, or null when it has none to show. */
export async function storefrontSpinWheel(client: ApiClient, workspaceId: string): Promise<StoreSpinWheel | null> {
  const { wheel } = await client.request<{ wheel: StoreSpinWheel | null }>(`/store/${workspaceId}/spin-wheel`, { auth: false });
  return wheel && Array.isArray(wheel.slices) && wheel.slices.length > 0 ? wheel : null;
}

export interface SpinPayload {
  phone: string;
  fullName?: string;
  /** The shopper ticked "send me offers": the wheel is a sign-up and says so. */
  marketingConsent: true;
  /** The honeypot: empty from a person. */
  website: string;
}

export interface SpinResult {
  /** The slice the wheel stops on; null when the server ignored the spin (the honeypot). */
  sliceId: string | null;
  label: string | null;
  prize: boolean;
  couponCode: string | null;
}

/** POST /store/:ws/spin-wheel/spin: one spin per phone number. */
export async function storefrontSpin(client: ApiClient, workspaceId: string, payload: SpinPayload): Promise<SpinResult> {
  return client.request<SpinResult>(`/store/${workspaceId}/spin-wheel/spin`, { method: "POST", body: payload, auth: false });
}

/** Why a spin was refused, for the popup's own wording; null for anything else. */
export type SpinRefusal = "already_spun" | "wheel_off" | "phone" | "consent";

export function spinRefusalOf(err: unknown): SpinRefusal | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code === "ALREADY_SPUN") return "already_spun";
  if (err.code === "SPIN_WHEEL_OFF") return "wheel_off";
  const fields = apiFieldProblems(err).map((p) => p.field);
  if (fields.includes("phone")) return "phone";
  if (fields.includes("marketingConsent")) return "consent";
  return null;
}
