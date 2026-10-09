import type { GatewayFieldDescriptor } from "@store-builder/api-client";

/*
 * Saved cards on the real gateways (frontend-handoff 380), for the connect
 * form built from GET /payments/gateways:
 *
 *  - Paymob's `motoIntegrationId` is an integration ID with no `method`: it is
 *    typed like the others but turns no checkout method on, so it is listed
 *    under the method IDs and does not count as "a method was entered".
 *  - PayPal's `vault` switch is off until the merchant turns it on, unlike the
 *    express-wallet switches, which are on unless saved off.
 */

/** Switch settings whose server default is off. */
const OFF_BY_DEFAULT: ReadonlySet<string> = new Set(["vault"]);

/** Whether a switch setting is on: as saved, else the server's default for that setting. */
export function gatewaySwitchOn(settings: Record<string, unknown> | null | undefined, key: string): boolean {
  const saved = settings?.[key];
  if (typeof saved === "boolean") return saved;
  return !OFF_BY_DEFAULT.has(key);
}

/** An ID field that turns a checkout method on (Paymob's card, wallet… integration IDs). */
export function turnsMethodOn(field: GatewayFieldDescriptor): boolean {
  return Boolean(field.method);
}

/** The method IDs first, in the server's order; the IDs with no method (saved-cards / MOTO) after them. */
export function methodFieldsFirst(fields: GatewayFieldDescriptor[]): GatewayFieldDescriptor[] {
  return [...fields.filter(turnsMethodOn), ...fields.filter((f) => !turnsMethodOn(f))];
}
