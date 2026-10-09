import { useSearchParams } from "react-router-dom";
import { useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { SectionTabs } from "@/components/SectionTabs";
import { DisputesTab } from "./DisputesTab";
import { PayoutsTab } from "./PayoutsTab";
import { TransactionsTab } from "./TransactionsTab";
import { LEDGER_STRINGS } from "./ledgerStrings";

type Tab = "transactions" | "payouts" | "disputes";
const TABS: readonly Tab[] = ["transactions", "payouts", "disputes"];

/**
 * /payments/transactions — the finance view of the store's online payments
 * (handoff 384) with the card disputes beside it (handoff 377): three tabs,
 * the current one in `?tab=`. The ledger needs financial_reports.view and the
 * disputes orders.view; each tab says so itself when the role lacks it.
 */
export function PaymentLedgerPage() {
  const t = useT(LEDGER_STRINGS);
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "transactions";

  return (
    <div className="min-w-0">
      <PageHeader title={t.pageTitle} description={t.pageDescription} back={{ to: "/payments", label: t.back }} />
      <SectionTabs<Tab>
        label={t.tabsLabel}
        value={tab}
        onChange={(next) =>
          setParams(
            (prev) => {
              const out = new URLSearchParams(prev);
              if (next === "transactions") out.delete("tab");
              else out.set("tab", next);
              return out;
            },
            { replace: true }
          )
        }
        tabs={[
          { value: "transactions", label: t.tabTransactions },
          { value: "payouts", label: t.tabPayouts },
          { value: "disputes", label: t.tabDisputes },
        ]}
      />
      <div role="tabpanel" aria-label={tab === "transactions" ? t.tabTransactions : tab === "payouts" ? t.tabPayouts : t.tabDisputes}>
        {tab === "transactions" ? <TransactionsTab /> : tab === "payouts" ? <PayoutsTab /> : <DisputesTab />}
      </div>
    </div>
  );
}
