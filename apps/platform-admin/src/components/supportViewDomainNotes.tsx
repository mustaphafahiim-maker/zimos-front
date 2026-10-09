/**
 * Support view → Domains (handoff item 341): beside a domain's certificate
 * state, why it is paused (`suspendedReason`) and the certificate provider's
 * own reason (`sslDetail`). Both are absent on an older server.
 */
const PAUSED: Record<string, string> = {
  store_suspended: "Paused: store suspended",
  plan: "Paused: plan",
};

export function DomainNotes({ domain }: { domain: object }) {
  const { suspendedReason, sslDetail } = domain as { suspendedReason?: string | null; sslDetail?: string | null };
  if (!suspendedReason && !sslDetail) return null;
  return (
    <>
      {suspendedReason && <span className="ms-2 text-xs font-medium text-danger">{PAUSED[suspendedReason] ?? `Paused: ${suspendedReason}`}</span>}
      {sslDetail && <span className="block text-xs text-ink-soft">{sslDetail}</span>}
    </>
  );
}
