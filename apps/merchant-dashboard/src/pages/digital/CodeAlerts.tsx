import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { IconWarning } from "@/components/icons";
import { Button, Input } from "@store-builder/ui";
import {
  DIGITAL_CODE_LOW_AT_MAX,
  digitalCodeAlertsGet,
  digitalCodeAlertsSave,
  digitalWaitingCodes,
  notificationsList,
  type DigitalProduct,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { numberField, parseWholeNumber } from "@/lib/wholeNumber";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    waiting: "Orders are waiting for codes — add codes",
    warnBefore: "Warn me when",
    warnAfter: "codes are left",
    warnLabel: "Warn me when this many codes are left",
    hint: "For every product sold with codes. You are also told when paid orders are waiting for codes.",
    invalid: "Write a whole number from {min} to {max}.",
    save: "Save",
    saving: "Saving…",
    saved: "Saved. You'll be warned when {count} codes are left.",
  },
  ar: {
    waiting: "في أوردرات مستنية أكواد — ضيف أكواد",
    warnBefore: "نبّهني لما يفضل",
    warnAfter: "كود",
    warnLabel: "نبّهني لما يفضل العدد ده من الأكواد",
    hint: "لكل المنتجات اللي بتتباع بأكواد. وهنبلّغك برضه لو في أوردرات مدفوعة مستنية أكواد.",
    invalid: "اكتب رقم صحيح من {min} لـ {max}.",
    save: "حفظ",
    saving: "بنحفظ…",
    saved: "اتحفظ. هننبّهك لما يفضل {count} كود.",
  },
} satisfies Messages;

/**
 * The Codes section's alert pieces (handoff 213), above the box where codes
 * are pasted:
 *
 *  - the red «في طلبات مستنية أكواد — أضف أكواد» while paid orders of this
 *    product are owed codes. The API reports that only in the `stock.low`
 *    notification it raised (`data.waitingCodes`), so it is read from the
 *    member's newest notifications — and dropped as soon as the pool has a
 *    code left, since waiting orders take new codes first;
 *  - «نبّهني لما يفضل … كود»: the store-wide number at which the team is
 *    warned (GET / PUT /digital/code-alerts).
 */
export function CodeAlerts({ productId, available }: { productId: string; available: number | undefined }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const inputId = useId();
  const hintId = useId();

  // Both are extras of a section that works without them: a failed read leaves the banner out and the box empty.
  const alerts = useAsync(() => notificationsList(apiClient, workspaceId, { limit: 50 }).catch(() => null), [workspaceId]);
  const saved = useAsync(() => digitalCodeAlertsGet(apiClient, workspaceId).catch(() => null), [workspaceId]);

  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lowAt = saved.data ?? null;
  const value = text ?? numberField(lowAt);
  const changed = text !== null && text.trim() !== numberField(lowAt);
  const waiting = alerts.data ? digitalWaitingCodes(alerts.data.notifications, productId) : 0;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next = parseWholeNumber(value, 0, DIGITAL_CODE_LOW_AT_MAX);
    if (next === null || Number.isNaN(next)) {
      setError(fmt(t.invalid, { min: 0, max: DIGITAL_CODE_LOW_AT_MAX }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await digitalCodeAlertsSave(apiClient, workspaceId, next);
      saved.setData(result);
      setText(null);
      toast.success(fmt(t.saved, { count: result }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {waiting > 0 && available === 0 && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
          <IconWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t.waiting}
        </p>
      )}

      <form onSubmit={save} noValidate className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink">
        <label htmlFor={inputId}>{t.warnBefore}</label>
        <Input
          id={inputId}
          type="text"
          inputMode="numeric"
          dir="ltr"
          autoComplete="off"
          maxLength={6}
          value={value}
          disabled={busy || saved.loading}
          aria-label={t.warnLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={hintId}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          className="h-11 w-20 text-center tabular-nums"
        />
        <span aria-hidden>{t.warnAfter}</span>
        {changed && (
          <Button type="submit" variant="outline" size="sm" className="min-h-11 rounded-full px-4 md:min-h-9" disabled={busy}>
            {busy ? t.saving : t.save}
          </Button>
        )}
        <p id={hintId} className={error ? "basis-full text-xs font-medium text-danger" : "basis-full text-xs text-ink-soft"}>
          {error ?? t.hint}
        </p>
      </form>
    </div>
  );
}

/**
 * `?product=<id>` on the Digital products page opens that product's delivery
 * dialog — where its codes are — once the products are loaded. It is where
 * <DigitalTabLink> sends the code alert's link.
 */
export function OpenProductFromLink({ products, onOpen }: { products: DigitalProduct[]; onOpen: (product: DigitalProduct) => void }) {
  const [params] = useSearchParams();
  const wanted = params.get("product");
  // Once per link: closing the dialog reloads the list, which must not open it again.
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!wanted || opened.current === wanted) return;
    const match = products.find((p) => p.id === wanted);
    if (!match) return;
    opened.current = wanted;
    onOpen(match);
  }, [wanted, products, onOpen]);
  return null;
}

/**
 * The "codes running low" / "orders waiting for codes" notification links to
 * /catalog/:productId?tab=digital. The product page has no such tab — a
 * digital product's delivery and codes live on the Digital products page — so
 * that link is handed over to it.
 */
export function DigitalTabLink({ productId }: { productId: string }) {
  const [params] = useSearchParams();
  if (params.get("tab") !== "digital") return null;
  return <Navigate to={`/digital?product=${productId}`} replace />;
}
