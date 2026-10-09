import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Alert, Input } from "@store-builder/ui";
import {
  QUOTE_LIMITS,
  apiFieldProblems,
  isApiErrorCode,
  quoteAnswer,
  type Quote,
  type QuoteAnswerLine,
  type QuoteLine,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { formatMoney, minorToMajorInput } from "@/lib/format";
import { parseWholeNumber, todayDay } from "@/lib/wholeNumber";
import { countOf } from "@/lib/plural";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { SaveBar } from "@/components/SaveBar";
import { Section } from "@/components/Section";
import { Textarea } from "@/components/Textarea";
import { costToMinor, variantDetail, variantFullName } from "@/pages/inventory/inventoryText";
import { SwitchRow } from "./kit/Switch";
import { QUOTE_STRINGS } from "./quoteStrings";

interface DraftLine {
  line: QuoteLine;
  included: boolean;
  quantity: string;
  /** Major units as typed, "120.00". */
  unitPrice: string;
  quantityError?: string;
  priceError?: string;
}

const DATE_INPUT =
  "flex h-11 w-full max-w-[14rem] rounded-[var(--radius)] border border-line-strong bg-paper-raised px-3 text-sm text-ink focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none aria-invalid:border-danger";

const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The day a quote holds until, as the date field has it: its own date while that is ahead, else a week from today. */
function initialValidity(validUntil: string | null): string {
  const saved = validUntil ? new Date(validUntil) : null;
  if (saved && !Number.isNaN(saved.getTime()) && saved.getTime() > Date.now()) return dayOf(saved);
  const next = new Date();
  next.setDate(next.getDate() + 7);
  return dayOf(next);
}

/** The end of that day on this device, as the API takes it; null for a day that is not one. */
function endOfDayIso(day: string): string | null {
  const d = new Date(`${day}T23:59:59`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** What the form starts from: the store's own prices and the quantities asked for, or the quote already sent. */
function startLines(quote: Quote): DraftLine[] {
  const answered = quote.lines.some((l) => l.unitPrice !== null);
  return quote.lines.map((line) => ({
    line,
    // A quote already sent keeps the lines it left out; a new one offers everything that still exists.
    included: answered ? line.unitPrice !== null : line.productName !== null,
    quantity: String(line.quantity),
    unitPrice: minorToMajorInput(line.unitPrice ?? line.listPrice),
  }));
}

/** Brings a field into view and puts the caret in it — after the render that drew its error. */
function reveal(id: string) {
  window.requestAnimationFrame(() => {
    const field = document.getElementById(id);
    if (!field) return;
    field.focus({ preventScroll: true });
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    field.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
  });
}

/**
 * The store's answer to a quote request (PUT /quotes/:id/answer): for each
 * product asked for, the quantity offered and the price of one piece — a line
 * can be left out — then a note and the day the offer holds until. It starts
 * from the store's own prices and the quantities asked for, or from the quote
 * already sent, which can be changed and sent again while the shopper has not
 * answered. The total is what the shopper will be asked to accept; shipping is
 * added when the order is made.
 *
 * The total and the one button stay in reach in the bar under the form; a
 * refused send puts the caret in the first field that needs fixing.
 */
export function QuoteEditor({
  quote,
  currency,
  onSaved,
  onClosed,
}: {
  quote: Quote;
  /** The quote's own currency once it has prices, the store's before. */
  currency: string;
  onSaved: (saved: Quote, first: boolean) => void;
  /** The quote was accepted, declined or cancelled meanwhile (409 QUOTE_CLOSED). */
  onClosed: () => void;
}) {
  const t = useT(QUOTE_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const validityRef = useRef<HTMLInputElement>(null);
  const first = quote.status === "new";
  const answered = quote.lines.some((l) => l.unitPrice !== null);

  const [lines, setLines] = useState<DraftLine[]>(() => startLines(quote));
  const [note, setNote] = useState(quote.quotedNote ?? "");
  const [validity, setValidity] = useState(() => initialValidity(quote.validUntil));
  const [linesError, setLinesError] = useState<string | null>(null);
  const [validityError, setValidityError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // What the form opened with: leaving is only a loss once something differs from it.
  const start = useMemo(
    () => ({ lines: startLines(quote), note: quote.quotedNote ?? "", validity: initialValidity(quote.validUntil) }),
    // The editor is keyed by the quote and its last answer (QuoteDetailPage), so this is its whole life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const dirty =
    note !== start.note ||
    validity !== start.validity ||
    lines.some((l, index) => {
      const was = start.lines[index];
      return !was || l.included !== was.included || l.quantity !== was.quantity || l.unitPrice !== was.unitPrice;
    });
  useReportDirty(dirty && !saving);

  const fieldId = (kind: "include" | "quantity" | "price", variantId: string) => `${formId}-${kind}-${variantId}`;

  const patch = (variantId: string, change: Partial<DraftLine>) => {
    setLinesError(null);
    setLines((prev) => prev.map((l) => (l.line.variantId === variantId ? { ...l, ...change } : l)));
  };

  function reset() {
    setLines(startLines(quote));
    setNote(start.note);
    setValidity(start.validity);
    setLinesError(null);
    setValidityError(null);
    setFailure(null);
  }

  const totalOf = (l: DraftLine) => {
    const quantity = parseWholeNumber(l.quantity, 1, QUOTE_LIMITS.quantity);
    const price = costToMinor(l.unitPrice);
    return quantity !== null && !Number.isNaN(quantity) && !Number.isNaN(price) ? quantity * price : null;
  };
  const total = lines.reduce((sum, l) => (l.included ? sum + (totalOf(l) ?? 0) : sum), 0);
  const includedCount = lines.filter((l) => l.included).length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFailure(null);
    let bad = false;
    // The first field that needs fixing, in reading order: it gets the caret.
    const firstBad: { id: string | null } = { id: null };
    const payload: QuoteAnswerLine[] = [];
    const checked = lines.map((l) => {
      if (!l.included) return { ...l, quantityError: undefined, priceError: undefined };
      const quantity = parseWholeNumber(l.quantity, 1, QUOTE_LIMITS.quantity);
      const price = costToMinor(l.unitPrice);
      const quantityError = quantity === null || Number.isNaN(quantity) ? fmt(t.quantityError, { min: 1, max: QUOTE_LIMITS.quantity }) : undefined;
      const priceError = Number.isNaN(price) ? t.priceError : undefined;
      if (quantityError || priceError || quantity === null) {
        bad = true;
        firstBad.id ??= fieldId(quantityError ? "quantity" : "price", l.line.variantId);
      } else payload.push({ variantId: l.line.variantId, quantity, unitPrice: price });
      return { ...l, quantityError, priceError };
    });
    setLines(checked);
    if (!checked.some((l) => l.included)) {
      setLinesError(t.linesError);
      bad = true;
      const firstLine = checked[0];
      if (firstLine) firstBad.id ??= fieldId("include", firstLine.line.variantId);
    }
    const validUntil = endOfDayIso(validity);
    if (!validUntil || new Date(validUntil).getTime() <= Date.now()) {
      setValidityError(t.validityError);
      bad = true;
      firstBad.id ??= validityRef.current?.id ?? null;
    }
    if (bad || !validUntil) {
      if (firstBad.id) reveal(firstBad.id);
      return;
    }

    setSaving(true);
    try {
      const saved = await quoteAnswer(apiClient, workspaceId, quote.id, { lines: payload, note: note.trim() || null, validUntil });
      onSaved(saved, first);
    } catch (err) {
      if (isApiErrorCode(err, "QUOTE_CLOSED")) {
        onClosed();
      } else {
        const fields = apiFieldProblems(err).map((p) => p.field);
        if (fields.some((f) => f.startsWith("validUntil"))) {
          setValidityError(t.validityError);
          if (validityRef.current?.id) reveal(validityRef.current.id);
        } else setFailure(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-[var(--bento-gap)]">
      <Section title={t.linesTitle} description={answered ? t.linesHintQuoted : t.linesHintNew} flush>
        <ul className="divide-y divide-line border-t border-line">
          {lines.map((l) => (
            <LineRow
              key={l.line.variantId}
              draft={l}
              currency={currency}
              disabled={saving}
              lineTotal={totalOf(l)}
              ids={{
                include: fieldId("include", l.line.variantId),
                quantity: fieldId("quantity", l.line.variantId),
                price: fieldId("price", l.line.variantId),
              }}
              onChange={(change) => patch(l.line.variantId, change)}
            />
          ))}
        </ul>
        <div className="border-t border-line px-4 py-3">
          {linesError && (
            <p role="alert" className="mb-1 text-sm font-medium text-danger">
              {linesError}
            </p>
          )}
          <p className="text-xs leading-5 text-ink-soft">{t.totalHint}</p>
        </div>
      </Section>

      <Section title={t.termsTitle}>
        <div className="space-y-4">
          <Field label={t.validity} hint={t.validityHint} error={validityError ?? undefined} required>
            {(props) => (
              <input
                {...props}
                ref={validityRef}
                type="date"
                min={todayDay()}
                value={validity}
                disabled={saving}
                onChange={(e) => {
                  setValidity(e.target.value);
                  setValidityError(null);
                }}
                className={DATE_INPUT}
              />
            )}
          </Field>
          <Field label={t.note} hint={t.noteHint}>
            {(props) => (
              <Textarea {...props} rows={3} dir="auto" maxLength={QUOTE_LIMITS.answerNote} value={note} disabled={saving} onChange={(e) => setNote(e.target.value)} />
            )}
          </Field>
          <p className="text-xs leading-5 text-ink-soft">{first ? (quote.contact.email ? t.willEmail : t.noEmailHint) : t.wontEmailAgain}</p>
        </div>
      </Section>

      {failure && <Alert variant="danger">{failure}</Alert>}

      {/* Always there, not only once something changed: a new request is sent at the store's own prices as it stands. */}
      <SaveBar
        dirty
        saving={saving}
        saveLabel={first ? t.send : t.sendAgain}
        savingLabel={t.sending}
        discardLabel={t.reset}
        onDiscard={dirty ? reset : undefined}
        message={
          <span className="flex flex-col">
            <span className="text-xs leading-5 font-normal text-ink-soft">
              {t.totalLine} · {fmt(t.includedCount, { included: includedCount, total: lines.length })}
            </span>
            <span className="text-lg leading-7 font-semibold text-ink tabular-nums">
              <bdi dir="ltr">{formatMoney(total, currency)}</bdi>
            </span>
          </span>
        }
      />
    </form>
  );
}

/** One requested product: whether it is offered, how many, at what price, and what the line comes to. */
function LineRow({
  draft,
  currency,
  disabled,
  lineTotal,
  ids,
  onChange,
}: {
  draft: DraftLine;
  currency: string;
  disabled: boolean;
  lineTotal: number | null;
  ids: { include: string; quantity: string; price: string };
  onChange: (change: Partial<DraftLine>) => void;
}) {
  const t = useT(QUOTE_STRINGS);
  const quantityErrorId = useId();
  const priceHintId = useId();
  const { line } = draft;
  const productName = line.productName ?? t.unknownProduct;
  const detail = variantDetail(line.optionValues, line.sku);
  const name = variantFullName(productName, detail);
  const off = !draft.included;

  return (
    <li data-slot="quote-line" data-off={off ? "" : undefined} className="space-y-3 px-4 py-3.5 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-[15px] leading-6 font-medium text-ink">
            <bdi>{productName}</bdi>
          </p>
          <p className="text-xs leading-5 text-ink-soft">
            {detail && (
              <>
                <bdi>{detail}</bdi>
                {" · "}
              </>
            )}
            {fmt(t.requested, { pieces: countOf("piece", line.requestedQuantity) })}
          </p>
          {line.note && (
            <p dir="auto" className="mt-0.5 text-xs leading-5 text-ink-soft">
              {fmt(t.shopperNote, { note: line.note })}
            </p>
          )}
        </div>
        <SwitchRow
          id={ids.include}
          side="start"
          className="shrink-0"
          label={t.include}
          ariaLabel={fmt(t.includeName, { name })}
          checked={draft.included}
          disabled={disabled}
          onChange={(included) => onChange({ included, quantityError: undefined, priceError: undefined })}
        />
      </div>

      {off ? (
        <p className="text-xs leading-5 text-ink-soft">{t.leftOut}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[7rem_11rem_minmax(0,1fr)] sm:items-start">
          <div className="space-y-1">
            <label htmlFor={ids.quantity} className="block text-xs font-medium text-ink-soft">
              {t.quantity}
              <span className="sr-only"> — {name}</span>
            </label>
            <Input
              id={ids.quantity}
              inputMode="numeric"
              dir="ltr"
              autoComplete="off"
              maxLength={6}
              value={draft.quantity}
              disabled={disabled}
              aria-invalid={draft.quantityError ? true : undefined}
              aria-describedby={draft.quantityError ? quantityErrorId : undefined}
              onChange={(e) => onChange({ quantity: e.target.value, quantityError: undefined })}
              className="h-11 text-center tabular-nums"
            />
            {draft.quantityError && (
              <p id={quantityErrorId} className="text-xs font-medium text-danger">
                {draft.quantityError}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label htmlFor={ids.price} className="block text-xs font-medium text-ink-soft">
              {t.unitPrice}
              <span className="sr-only"> — {name}</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-xs text-ink-soft">{currency}</span>
              <Input
                id={ids.price}
                inputMode="decimal"
                dir="ltr"
                autoComplete="off"
                maxLength={13}
                placeholder="0.00"
                value={draft.unitPrice}
                disabled={disabled}
                aria-invalid={draft.priceError ? true : undefined}
                aria-describedby={priceHintId}
                onChange={(e) => onChange({ unitPrice: e.target.value, priceError: undefined })}
                className="h-11 ps-11 tabular-nums"
              />
            </div>
            <p id={priceHintId} className={draft.priceError ? "text-xs font-medium text-danger" : "text-xs text-ink-soft"}>
              {draft.priceError ?? (line.listPrice !== null ? fmt(t.listPrice, { price: formatMoney(line.listPrice, currency) }) : "")}
            </p>
          </div>
          <div className="col-span-2 flex items-baseline justify-between gap-3 sm:col-span-1 sm:block sm:space-y-1 sm:text-end">
            <p className="text-xs font-medium text-ink-soft">{t.lineTotal}</p>
            <p className="font-semibold text-ink tabular-nums sm:flex sm:min-h-11 sm:items-center sm:justify-end">
              {lineTotal === null ? "—" : <bdi dir="ltr">{formatMoney(lineTotal, currency)}</bdi>}
            </p>
          </div>
        </div>
      )}
    </li>
  );
}
