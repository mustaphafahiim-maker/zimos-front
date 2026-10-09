import type { PriceScheduleChange, PriceScheduleTarget } from "@store-builder/api-client";
import { fmt } from "@/i18n/LocaleContext";
import { formatMoney } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import type { PriceScheduleStrings } from "./priceScheduleStrings";

/** "20% off", "EGP 50.00 off", "Price EGP 199.00" — a sale's discount in one phrase. */
export function changeSummary(t: PriceScheduleStrings, change: PriceScheduleChange, currency: string): string {
  if (change.mode === "percent_off") return fmt(t.changePercent, { value: change.value });
  const amount = formatMoney(change.value, currency);
  return fmt(change.mode === "amount_off" ? t.changeAmount : t.changeSet, { amount });
}

/** "3 items", "5 variants", "Collection: Summer" — what a sale is on. */
export function targetSummary(t: PriceScheduleStrings, target: PriceScheduleTarget, collectionNames: ReadonlyMap<string, string>): string {
  if (target.type === "products") return countOf("item", target.ids.length);
  if (target.type === "variants") return pluralOf(t, "variants", target.ids.length);
  const name = collectionNames.get(target.ids[0] ?? "");
  return name ? fmt(t.targetCollection, { name }) : t.targetCollectionUnknown;
}
