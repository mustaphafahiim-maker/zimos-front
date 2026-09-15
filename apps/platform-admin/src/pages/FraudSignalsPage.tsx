import { NotConnected } from "@/components/NotConnected";

export function FraudSignalsPage() {
  return (
    <NotConnected
      title="Fraud signals"
      description="Phones, emails and addresses repeating across stores."
      summary="Cross-store risk detection has no endpoint yet. Nothing is scored or aggregated server-side, so this screen has no signals to show."
      endpoints={["GET /admin/risk/signals", "POST /admin/risk/blocklist"]}
    />
  );
}
