import { cache } from "react";
import { headers } from "next/headers";
import { storefrontCustomCode, type CustomCodeSlotKey } from "@store-builder/api-client";
import { createServerStorefrontApiClient } from "./serverApiClient";
import { CODE_REF_HEADER } from "./headCodeParse";

const REF = /^[A-Za-z0-9-]{1,100}$/;

/**
 * The store's code slots, read once per request (the root layout and the
 * store layout both want them). The API returns none to a staff preview.
 */
export const storeCustomCode = cache(async (ref: string): Promise<Partial<Record<CustomCodeSlotKey, string>>> => {
  try {
    return await storefrontCustomCode(await createServerStorefrontApiClient(), ref);
  } catch {
    return {};
  }
});

/**
 * The head code and stylesheet the root layout puts in <head>, or null when
 * merchant code may not run on this request. The proxy decides that
 * (CODE_REF_HEADER): the store's own host, not a payment or preview page, no
 * staff preview token — the server's half of components/CustomCode.tsx.
 */
export async function serverHeadCode(): Promise<{ head: string; css: string } | null> {
  const ref = (await headers()).get(CODE_REF_HEADER);
  if (!ref || !REF.test(ref)) return null;
  const slots = await storeCustomCode(ref);
  if (!slots.head && !slots.css) return null;
  return { head: slots.head ?? "", css: slots.css ?? "" };
}
