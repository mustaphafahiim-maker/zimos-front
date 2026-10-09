import { useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IconCombine } from "@/components/icons";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  customerMergeCandidates,
  customerMergeRun,
  isApiErrorCode,
  type Customer,
  type CustomerMergeCandidate,
  type CustomerMergeResult,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney, parseMoney } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { CustomerCard, type CustomerCardFrame } from "../detail/CardFrame";
import { SECTION_STRINGS } from "../detail/sectionStrings";
import { canManageCustomers } from "./crmAccess";
import { MERGE_STRINGS, type MergeStrings } from "./mergeStrings";

/** One of the two customers in the side-by-side. */
interface Side {
  id: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  totalOrders: number;
  createdAt: string | null;
}

type Step = "compare" | "confirm" | "result";

/** "orders.customer_id": 2 → the rows moved per table, most first; unknown tables are counted together. */
function movedRows(t: MergeStrings, moved: Record<string, number>): { label: string; count: number }[] {
  const byLabel = new Map<string, number>();
  for (const [key, count] of Object.entries(moved)) {
    const table = key.split(".")[0];
    const label = (t as Record<string, string | undefined>)[`moved_${table}`] ?? t.moved_other;
    byLabel.set(label, (byLabel.get(label) ?? 0) + count);
  }
  return [...byLabel].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

/**
 * The customer page's «عملاء ممكن يكونوا نفس الشخص» card (handoff 248): other
 * customers with the same email, phone ending or name, each with «دمج». The
 * merge shows both side by side, asks which one stays, warns that it can't be
 * undone, then says what moved. Only for staff who manage customers; with no
 * candidate the card is not there.
 *
 * `frame` lets the customer page draw the card as one of its folding sections
 * (how many look alike as the folded line); left out, it is the `Section` it
 * always was. The three dialogs of a merge stand outside it either way.
 */
export function CustomerDuplicates({ customer, onMerged, frame }: { customer: Customer; onMerged: () => void; frame?: CustomerCardFrame }) {
  const t = useT(MERGE_STRINGS);
  const sections = useT(SECTION_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const navigate = useNavigate();
  const errorMessage = useErrorMessage();
  const groupId = useId();
  const manager = canManageCustomers(currentWorkspace?.role);
  const candidates = useAsync(
    () => (manager ? customerMergeCandidates(apiClient, workspaceId, customer.id) : Promise.resolve([])),
    [workspaceId, customer.id, manager]
  );

  const [target, setTarget] = useState<CustomerMergeCandidate | null>(null);
  const [step, setStep] = useState<Step>("compare");
  const [keepThis, setKeepThis] = useState(true);
  const [result, setResult] = useState<CustomerMergeResult | null>(null);

  if (!manager || isPermissionError(candidates.error)) return null;
  if (candidates.error) {
    return (
      <CustomerCard frame={frame} title={t.title}>
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-danger">{errorMessage(candidates.error)}</p>
          <Button variant="outline" size="sm" className="min-h-11 md:min-h-8" onClick={() => void candidates.refresh()}>
            {common.retry}
          </Button>
        </div>
      </CustomerCard>
    );
  }
  const list = candidates.data ?? [];
  // The dialogs outlive the list: after a merge the candidate is gone while its result is still on screen.
  if (list.length === 0 && !target) return null;

  const me: Side = {
    id: customer.id,
    fullName: customer.fullName,
    phone: customer.phoneRaw || customer.phoneNormalized,
    email: customer.email,
    totalOrders: customer.totalOrders,
    createdAt: (customer as Customer & { createdAt?: string }).createdAt ?? null,
  };
  const other: Side | null = target;
  const nameOf = (side: Side) => side.fullName?.trim() || side.phone || t.noName;
  // «مفيش أوردرات» rather than a bare zero, which in Arabic digits reads as a dot.
  const ordersOf = (count: number) => (count > 0 ? countOf("order", count) : t.noOrders);
  // Two records of one person often carry the same name: the phone tells them apart.
  const nameAndPhone = (side: Side) => (side.fullName?.trim() && side.phone ? `${side.fullName.trim()} (${side.phone})` : nameOf(side));

  function open(candidate: CustomerMergeCandidate) {
    setTarget(candidate);
    setStep("compare");
    setResult(null);
    // The record with more orders is usually the one to keep; a tie keeps the page's own.
    setKeepThis(customer.totalOrders >= candidate.totalOrders);
  }

  function close() {
    const merged = result;
    setTarget(null);
    setResult(null);
    setStep("compare");
    if (!merged) return;
    // The page's own customer was the duplicate: it is gone, so go to the one that stayed.
    if (merged.customer.id !== customer.id) navigate(`/customers/${merged.customer.id}`, { replace: true });
    else {
      void candidates.refresh({ silent: true });
      onMerged();
    }
  }

  async function run() {
    if (!other) return;
    try {
      setResult(
        await customerMergeRun(apiClient, workspaceId, {
          keepId: keepThis ? me.id : other.id,
          duplicateId: keepThis ? other.id : me.id,
        })
      );
      setStep("result");
    } catch (err) {
      if (isApiErrorCode(err, "CUSTOMER_PAYMENT_IN_PROGRESS")) throw new Error(t.paymentInProgress);
      if (isApiErrorCode(err, "NOT_FOUND")) throw new Error(t.gone);
      throw new Error(errorMessage(err));
    }
  }

  const sideCard = (side: Side, caption: string, kept: boolean, onPick: () => void) => (
    <label
      className={cn(
        "block cursor-pointer rounded-[var(--radius)] p-3 ring-1 ring-line transition-colors",
        "has-[:checked]:bg-primary-soft has-[:checked]:ring-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-soft">{caption}</span>
        <StatusBadge value={kept ? "stays" : "goes"} tone={kept ? "success" : "danger"} text={kept ? t.stays : t.goes} />
      </span>
      <span dir="auto" className="mt-1 block break-words text-base font-semibold text-ink">
        {side.fullName?.trim() || t.noName}
      </span>
      <dl className="mt-2 space-y-1 text-sm">
        {(
          [
            [t.phone, side.phone ? <bdi dir="ltr">{side.phone}</bdi> : t.none],
            [t.email, side.email ? <bdi dir="ltr" className="break-all">{side.email}</bdi> : t.none],
            [t.orders, <span className="tabular-nums">{ordersOf(side.totalOrders)}</span>],
            [t.since, side.createdAt ? formatDate(side.createdAt) : t.none],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-xs text-ink-soft">{label}</dt>
            <dd className="min-w-0 text-end text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <span className="mt-3 flex min-h-11 items-center gap-2 border-t border-line pt-2 text-sm font-medium text-ink">
        <input
          type="radio"
          name={`${groupId}-keep`}
          className="size-4 accent-primary"
          checked={kept}
          onChange={onPick}
          aria-label={`${t.keep} — ${caption}: ${nameOf(side)}`}
        />
        {t.keep}
      </span>
    </label>
  );

  const rows = result ? movedRows(t, result.moved) : [];
  const credit = result ? parseMoney(result.creditAdded) : 0;

  return (
    <>
      {list.length > 0 && (
        <CustomerCard
          frame={frame}
          title={t.title}
          description={t.hint}
          summary={pluralOf(sections, "duplicates", list.length)}
          badge={<StatusBadge value="duplicates" tone="warning" text={fmt("{n}", { n: list.length })} />}
        >
          <ul className="divide-y divide-line">
            {list.map((candidate) => (
              <li key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link to={`/customers/${candidate.id}`} className="text-sm font-medium text-primary hover:underline">
                    <bdi>{candidate.fullName?.trim() || candidate.phone || t.noName}</bdi>
                  </Link>
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-ink-soft">
                    {candidate.phone && <bdi dir="ltr">{candidate.phone}</bdi>}
                    {candidate.email && <bdi dir="ltr" className="break-all">{candidate.email}</bdi>}
                    <span>{ordersOf(candidate.totalOrders)}</span>
                  </p>
                  <p className="mt-1.5 flex flex-wrap gap-1">
                    {candidate.reasons.map((reason) => (
                      <span key={reason} className="rounded-full border border-line bg-paper px-2 py-0.5 text-xs text-ink">
                        {(t as Record<string, string | undefined>)[`reason_${reason}`] ?? reason}
                      </span>
                    ))}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 rounded-full px-4 pointer-fine:min-h-9"
                  aria-label={fmt(t.mergeWith, { name: candidate.fullName?.trim() || candidate.phone || t.noName })}
                  onClick={() => open(candidate)}
                >
                  <IconCombine className="size-4" aria-hidden />
                  {t.merge}
                </Button>
              </li>
            ))}
          </ul>
        </CustomerCard>
      )}

      {/* 1 — both customers side by side, and which one stays. */}
      <Modal
        open={other !== null && step === "compare"}
        onClose={close}
        title={t.compareTitle}
        description={t.compareHint}
        className="max-w-2xl"
        footer={
          <>
            <Button type="button" variant="outline" className="min-h-11" onClick={close}>
              {common.cancel}
            </Button>
            <Button type="button" variant="danger" className="min-h-11" onClick={() => setStep("confirm")}>
              {t.merge}
            </Button>
          </>
        }
      >
        {other && (
          <div className="space-y-4">
            <fieldset>
              <legend className="sr-only">{t.compareHint}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {sideCard(me, t.thisCustomer, keepThis, () => setKeepThis(true))}
                {sideCard(other, t.otherCustomer, !keepThis, () => setKeepThis(false))}
              </div>
            </fieldset>
            {target && target.reasons.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                {t.whyAlike}:
                {target.reasons.map((reason) => (
                  <span key={reason} className="rounded-full border border-line bg-paper px-2 py-0.5 text-ink">
                    {(t as Record<string, string | undefined>)[`reason_${reason}`] ?? reason}
                  </span>
                ))}
              </p>
            )}
            <Alert variant="danger">{keepThis ? t.confirmKeepThis : t.confirmKeepOther}</Alert>
          </div>
        )}
      </Modal>

      {/* 2 — the warning, said once more before anything is deleted. */}
      <ConfirmDialog
        open={other !== null && step === "confirm"}
        title={t.confirmTitle}
        description={keepThis ? t.confirmKeepThis : t.confirmKeepOther}
        confirmLabel={t.confirm}
        cancelLabel={common.back}
        busyLabel={t.merging}
        destructive
        onCancel={() => setStep("compare")}
        onConfirm={run}
      >
        {other && (
          <p dir="auto" className="text-sm font-medium text-ink">
            {fmt(t.confirmNames, { keep: nameAndPhone(keepThis ? me : other), duplicate: nameAndPhone(keepThis ? other : me) })}
          </p>
        )}
      </ConfirmDialog>

      {/* 3 — what moved. */}
      <Modal
        open={result !== null && step === "result"}
        onClose={close}
        title={t.doneTitle}
        description={result ? fmt(t.doneBody, { name: result.customer.fullName?.trim() || result.customer.phone || t.noName }) : undefined}
        footer={
          <Button type="button" className="min-h-11" onClick={close}>
            {t.done}
          </Button>
        }
      >
        {result && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">{t.movedTitle}</h3>
            {rows.length === 0 && result.pointsAdded === 0 && credit === 0 ? (
              <p className="text-sm text-ink-soft">{t.nothingMoved}</p>
            ) : (
              <dl className="divide-y divide-line text-sm">
                {rows.map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-3 py-2">
                    <dt className="text-ink">{row.label}</dt>
                    <dd className="font-medium tabular-nums text-ink">{fmt("{n}", { n: row.count })}</dd>
                  </div>
                ))}
                {result.pointsAdded > 0 && (
                  <div className="flex items-baseline justify-between gap-3 py-2">
                    <dt className="text-ink">{t.pointsAdded}</dt>
                    <dd className="font-medium tabular-nums text-ink">{fmt("{n}", { n: result.pointsAdded })}</dd>
                  </div>
                )}
                {credit > 0 && (
                  <div className="flex items-baseline justify-between gap-3 py-2">
                    <dt className="text-ink">{t.creditAdded}</dt>
                    <dd className="font-medium tabular-nums text-ink">{formatMoney(credit, currency)}</dd>
                  </div>
                )}
              </dl>
            )}
            {result.customer.alternatePhone && (
              <p className="text-xs text-ink-soft">
                {t.alternatePhone}: <bdi dir="ltr">{result.customer.alternatePhone}</bdi>
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
