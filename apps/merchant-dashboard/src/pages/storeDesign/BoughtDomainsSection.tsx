import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import { domainPurchaseSetAutoRenew, domainPurchasesList, type DomainPurchase } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { PURCHASE_STRINGS, type PurchaseStrings } from "./domainPurchaseStrings";
import { RenewDomainDialog } from "./RenewDomainDialog";

/** Only a bought domain (active, or lapsed) renews; the API answers DOMAIN_NOT_ACTIVE otherwise. */
const renewable = (p: DomainPurchase) => p.status === "active" || p.status === "expired";

/**
 * A failed purchase the registrar did register (it has an expiry date): the
 * domain was bought and only connecting it to the store failed (502
 * DOMAIN_CONNECT_FAILED) — support finishes it. Not "failed" to the merchant.
 */
const boughtNotConnected = (p: DomainPurchase) => p.status === "failed" && p.expiresAt !== null;

type ShownStatus = DomainPurchase["status"] | "not_connected";
const shownStatus = (p: DomainPurchase): ShownStatus => (boughtNotConnected(p) ? "not_connected" : p.status);
const TONE = { pending: "warning", active: "success", failed: "danger", expired: "neutral", not_connected: "warning" } as const;

/**
 * The purchase's last error in the merchant's words. The server's own text
 * (`lastError`, English, meant for support) is never shown as it is.
 */
function issueText(t: PurchaseStrings, p: DomainPurchase): string | null {
  if (boughtNotConnected(p)) return t.issueNotConnected;
  if (p.status === "failed") return t.issueNotBought;
  if (!p.lastError) return null;
  // On a bought domain the only failure recorded later is a renewal (by hand or the daily auto-renew).
  return renewable(p) ? t.issueRenewFailed : t.issueOther;
}

interface BoughtDomainsSectionProps {
  /** Bumped by the page after a purchase, to read the list again. */
  version: number;
  /** Every time the list is read: the page marks the domains whose DNS the platform holds. */
  onLoaded?: (purchases: DomainPurchase[]) => void;
}

/**
 * Store settings → Domains → "Bought domains" (handoff item 176): each domain
 * bought in the dashboard with its status (and last error), expiry date, the
 * auto-renew switch and "Renew now". Hidden until the store has bought one;
 * the "Buy a domain" section above is the way in.
 */
export function BoughtDomainsSection({ version, onLoaded }: BoughtDomainsSectionProps) {
  const t = useT(PURCHASE_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const state = useAsync(() => domainPurchasesList(apiClient, workspaceId), [workspaceId]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renewing, setRenewing] = useState<DomainPurchase | null>(null);
  const { refresh } = state;

  useEffect(() => {
    if (version > 0) void refresh({ silent: true });
  }, [version, refresh]);

  const purchases = state.data;
  useEffect(() => {
    if (purchases) onLoaded?.(purchases);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reported when the list changes, not when the callback does
  }, [purchases]);

  const replace = (next: DomainPurchase) => state.setData((prev) => (prev ?? []).map((p) => (p.id === next.id ? next : p)));

  async function toggleAutoRenew(purchase: DomainPurchase, autoRenew: boolean) {
    setBusyId(purchase.id);
    replace({ ...purchase, autoRenew });
    try {
      replace(await domainPurchaseSetAutoRenew(apiClient, workspaceId, purchase.id, autoRenew));
      toast.success(fmt(autoRenew ? t.autoRenewOn : t.autoRenewOff, { domain: purchase.hostname }));
    } catch (err) {
      replace(purchase);
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  function renewed(next: DomainPurchase) {
    replace(next);
    setRenewing(null);
    toast.success(fmt(t.renewedToast, { domain: next.hostname, date: formatDate(next.expiresAt) }));
  }

  // First load: nothing is drawn, so a store that never bought a domain sees no empty card.
  if (state.loading) return null;
  if (!state.error && (state.data ?? []).length === 0) return null;

  const domainNode = (p: DomainPurchase) => (
    <bdi dir="ltr" className="break-words font-medium text-ink">
      {p.hostname}
    </bdi>
  );

  const columns: Column<DomainPurchase>[] = [
    { key: "domain", header: t.colDomain, cell: domainNode },
    {
      key: "status",
      header: t.colStatus,
      cell: (p) => {
        const status = shownStatus(p);
        const issue = issueText(t, p);
        return (
          <span className="inline-flex flex-col items-end gap-1 md:items-start">
            <StatusBadge value={status} tone={TONE[status] ?? "neutral"} text={t[`status_${status}`] ?? status} />
            {issue && (
              <span className={cn("max-w-[18rem] text-end text-xs md:text-start", status === "not_connected" ? "text-accent-dark" : "text-danger")}>
                {issue}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "expires",
      header: t.colExpires,
      cell: (p) => <span className="whitespace-nowrap tabular-nums text-ink-soft">{formatDate(p.expiresAt)}</span>,
    },
    {
      key: "autoRenew",
      header: t.colAutoRenew,
      cell: (p) =>
        renewable(p) ? (
          <label className="inline-flex min-h-11 cursor-pointer items-center md:min-h-0">
            <input
              type="checkbox"
              role="switch"
              className="size-5 cursor-pointer accent-primary disabled:cursor-default"
              checked={p.autoRenew}
              disabled={busyId !== null}
              aria-label={fmt(t.autoRenewFor, { domain: p.hostname })}
              onChange={(e) => void toggleAutoRenew(p, e.target.checked)}
            />
          </label>
        ) : (
          <span className="text-ink-soft">—</span>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t.colActions}</span>,
      align: "end",
      cell: (p) =>
        renewable(p) ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 md:min-h-0"
            aria-label={fmt(t.renewNamed, { domain: p.hostname })}
            disabled={busyId !== null}
            onClick={() => setRenewing(p)}
          >
            <RefreshCw className="size-4" aria-hidden />
            {t.renewNow}
          </Button>
        ) : null,
    },
  ];

  return (
    <Section title={t.boughtTitle} description={t.boughtDescription} flush>
      <DataState loading={false} error={state.error} onRetry={() => void state.refresh()}>
        <DataTable columns={columns} rows={state.data ?? []} rowKey={(p) => p.id} minWidth="40rem" className="max-md:px-4 max-md:pb-4" />
      </DataState>

      {renewing && (
        <RenewDomainDialog
          key={renewing.id}
          purchase={renewing}
          onClose={() => setRenewing(null)}
          onRenewed={renewed}
          onStale={() => void state.refresh({ silent: true })}
        />
      )}
    </Section>
  );
}
