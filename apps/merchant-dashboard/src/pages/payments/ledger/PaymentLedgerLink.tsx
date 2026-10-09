import { useT } from "@/i18n/LocaleContext";
import { SettingsGroup, SettingsLinkRow } from "@/components/settings";
import { IconReceipt } from "@/components/icons";
import { LEDGER_PATH, LEDGER_STRINGS } from "./ledgerStrings";

/** The way from the Payments page to the ledger (handoff 384 / 377): one row, under the section list's description. */
export function PaymentLedgerLink({ className }: { className?: string }) {
  const t = useT(LEDGER_STRINGS);
  return (
    <SettingsGroup className={className}>
      <SettingsLinkRow to={LEDGER_PATH} icon={IconReceipt} tone="green" label={t.linkToLedger} hint={t.linkToLedgerHint} />
    </SettingsGroup>
  );
}
