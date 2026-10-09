import { useEffect, useId, useRef, useState, type FocusEvent, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  ORDER_PACK_NOTE_MAX,
  ORDER_PACK_SCANS_MAX,
  ORDER_PACK_SCAN_LENGTH,
  ORDER_PACKED_TAG,
  apiFieldProblems,
  isApiErrorCode,
  orderPackCheck,
  orderPackConfirm,
  orderPackNotComplete,
  type OrderPackCheck,
  type OrderPackLine,
} from "@store-builder/api-client";
import { AccordionSection } from "@/components/Accordion";
import { DataState, SkeletonBar } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import {
  IconBarcode,
  IconChecklist,
  IconClose,
  IconFailed,
  IconPackage,
  IconPacked,
  IconScan,
  IconSpinner,
  IconSuccess,
  IconUndo,
  IconWarning,
} from "@/components/icons";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { pluralOf } from "@/lib/plural";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useOrderErrorMessage } from "../orderErrors";
import { packBeep } from "./packBeep";
import { MeterBar, TickBox } from "./packingBits";
import { readPackDraft, savePackDraft } from "./packingStorage";
import { PACKING_STRINGS } from "./packingStrings";

/** Scans listed under "Scanned so far" before "show all". */
const SCANS_SHOWN = 30;

/** What the last scan did, said under the scan box until the next one. */
type Signal =
  | { kind: "ok"; variantId: string; name: string; scanned: number; expected: number }
  | { kind: "unknown"; code: string }
  | { kind: "over"; name: string }
  | { kind: "limit" };

const normalize = (code: string) => code.trim().toLowerCase();
/** A scanner behind an Arabic keyboard layout can type ٦٢٢١… for 6221…: the barcode is the same digits. */
const asciiDigits = (text: string) =>
  text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
const optionsText = (options: Record<string, string> | null | undefined) => Object.values(options ?? {}).filter(Boolean).join(" / ");
const lineName = (line: OrderPackLine) => [line.name, optionsText(line.options)].filter(Boolean).join(" — ");

/** What changed between two answers, worst first: a wrong code, a line gone over, else the line that moved. */
function signalOf(prev: OrderPackCheck, next: OrderPackCheck): Signal | null {
  if (next.unknown.length > prev.unknown.length) return { kind: "unknown", code: next.unknown[next.unknown.length - 1] };
  const before = new Map(prev.lines.map((line) => [line.variantId, line.scanned]));
  const moved = next.lines.filter((line) => line.scanned > (before.get(line.variantId) ?? 0));
  const over = moved.find((line) => line.over > 0);
  if (over) return { kind: "over", name: lineName(over) };
  const last = moved[moved.length - 1];
  return last ? { kind: "ok", variantId: last.variantId, name: lineName(last), scanned: last.scanned, expected: last.expected } : null;
}

/** A field the packer types in (not a tick box or a button): keys pressed there are theirs, not a scan. */
function isTypingTarget(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  return el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "reset"].includes(el.type);
}

/**
 * Orders → an order → Scan to pack (handoff 249, orders.manage): a packing
 * station for a phone held in one hand. One pane holds everything the packer
 * looks at while scanning — how far along, the item whose turn it is in large
 * type, the scan box, and what the last scan did — and the lists (the order's
 * items, the lines checked by hand, the scans so far) fold under it; from lg
 * up they sit beside it.
 *
 * A USB or Bluetooth scanner types the code and presses Enter; a SKU can be
 * typed by hand. The server answers what every line expects against
 * everything scanned so far. Nothing is kept there between calls, so the
 * scans live here and in the session — a reload sends the list again. A wrong
 * item or one too many is said in words under the box, with a low double beep
 * and a red frame. Confirming tags the order `packed`.
 *
 * The phone camera is not wired in: the box takes whatever a scanner or a
 * keyboard types into it.
 */
export function ScanToPackPage() {
  const { orderId = "" } = useParams<{ orderId: string }>();
  const workspaceId = useWorkspaceId();
  // Another order (or store) is another screen: its own scans, its own answer.
  return <PackScreen key={`${workspaceId}:${orderId}`} orderId={orderId} />;
}

function PackScreen({ orderId }: { orderId: string }) {
  const workspaceId = useWorkspaceId();
  const t = useT(PACKING_STRINGS);
  const toast = useToast();
  const errorMessage = useOrderErrorMessage();
  const location = useLocation();
  const inputId = useId();
  const hintId = useId();
  const forceFormId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [draft] = useState(() => readPackDraft(orderId));
  const [scans, setScans] = useState<string[]>(draft.scans);
  // Read by a scan that lands before the last one re-rendered the page.
  const scansRef = useRef(scans);
  const [manual, setManual] = useState<Set<number>>(() => new Set(draft.manual));
  const [value, setValue] = useState("");

  const [check, setCheck] = useState<OrderPackCheck | null>(null);
  const lastCheck = useRef<OrderPackCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  /** A later check failed (the network): the scans are kept and sent again. */
  const [checkError, setCheckError] = useState<string | null>(null);
  const callId = useRef(0);

  const [signal, setSignal] = useState<Signal | null>(null);
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<number | undefined>(undefined);

  const [allScans, setAllScans] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [forceOpen, setForceOpen] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const dialogOpen = useRef(false);
  dialogOpen.current = forceOpen;

  const focusBox = () => inputRef.current?.focus({ preventScroll: true });

  function announce(next: Signal | null) {
    setSignal(next);
    if (!next || next.kind === "ok") return;
    if (next.kind !== "limit") packBeep(next.kind === "unknown" ? "wrong" : "over");
    setFlash(true);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(false), 700);
  }

  /** Sends every scan so far. `tell`: say what the newest scan did (not for an undo or a reload). */
  async function runCheck(list: string[], tell: boolean) {
    const id = ++callId.current;
    try {
      const result = await orderPackCheck(apiClient, workspaceId, orderId, list);
      if (id !== callId.current) return;
      const prev = lastCheck.current;
      lastCheck.current = result;
      setCheck(result);
      setLoadError(null);
      setCheckError(null);
      if (tell && prev) announce(signalOf(prev, result));
    } catch (err) {
      if (id !== callId.current) return;
      if (lastCheck.current) setCheckError(t.checkFailed);
      else setLoadError(err);
    } finally {
      if (id === callId.current) setLoading(false);
    }
  }

  function commit(list: string[], tell: boolean, ticked: Set<number> = manual) {
    scansRef.current = list;
    setScans(list);
    savePackDraft(orderId, { scans: list, manual: [...ticked] });
    setActionError(null);
    void runCheck(list, tell);
  }

  useEffect(() => {
    void runCheck(scansRef.current, false);
    return () => window.clearTimeout(flashTimer.current);
    // Once per screen: the screen is keyed by store and order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The box keeps the keyboard. It is focused when the page opens; a key pressed while focus is
  // on a button, a tick box or nothing at all goes to it (so a scan is never typed into the void);
  // and with a mouse, clicking an empty part of the page hands the focus straight back.
  const ready = check !== null && !done;
  useEffect(() => {
    if (!ready) return;
    focusBox();
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || dialogOpen.current) return;
      if (document.activeElement === inputRef.current || isTypingTarget(document.activeElement)) return;
      if (e.key.length === 1 && e.key !== " ") focusBox();
    }
    const onWindowFocus = () => {
      if (!dialogOpen.current && !isTypingTarget(document.activeElement)) focusBox();
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("focus", onWindowFocus);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, [ready]);

  function onBoxBlur(e: FocusEvent<HTMLInputElement>) {
    // A touch screen: taking the focus back would keep the on-screen keyboard up.
    if (e.relatedTarget || !window.matchMedia?.("(pointer: fine)").matches) return;
    window.setTimeout(() => {
      const active = document.activeElement;
      if (dialogOpen.current || (active && active !== document.body)) return;
      // Text being selected to copy stays selected.
      if (window.getSelection()?.isCollapsed === false) return;
      focusBox();
    }, 150);
  }

  function addScan(e: FormEvent) {
    e.preventDefault();
    const code = asciiDigits(value).trim().slice(0, ORDER_PACK_SCAN_LENGTH);
    setValue("");
    focusBox();
    if (!code) return;
    if (scansRef.current.length >= ORDER_PACK_SCANS_MAX) {
      announce({ kind: "limit" });
      return;
    }
    commit([...scansRef.current, code], true);
  }

  function undo() {
    setSignal(null);
    commit(scansRef.current.slice(0, -1), false);
    focusBox();
  }

  function removeScan(index: number) {
    setSignal(null);
    commit(
      scansRef.current.filter((_, i) => i !== index),
      false
    );
    focusBox();
  }

  /** Puts a cleared list back, for the Undo of the toast that follows a clearing. */
  function restore(list: string[], ticked: Set<number>) {
    setSignal(null);
    setManual(ticked);
    commit(list, false, ticked);
    focusBox();
  }

  function removeUnknown() {
    const before = scansRef.current;
    const wrong = new Set((check?.unknown ?? []).map(normalize));
    setSignal(null);
    commit(
      before.filter((code) => !wrong.has(normalize(code))),
      false
    );
    focusBox();
    toast.undo(t.removedUnknown, () => restore(before, manual));
  }

  function startOver() {
    const before = scansRef.current;
    const ticked = manual;
    const none = new Set<number>();
    setSignal(null);
    setManual(none);
    commit([], false, none);
    focusBox();
    // Everything scanned so far is still in hand: one press brings it back.
    toast.undo(t.startedOver, () => restore(before, ticked));
  }

  function toggleManual(index: number) {
    const next = new Set(manual);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setManual(next);
    savePackDraft(orderId, { scans: scansRef.current, manual: [...next] });
  }

  async function confirm(force: boolean) {
    if (confirming) return;
    const why = note.trim().slice(0, ORDER_PACK_NOTE_MAX);
    if (force && !why) {
      setNoteError(t.whyRequired);
      return;
    }
    setConfirming(true);
    setActionError(null);
    setNoteError(null);
    try {
      await orderPackConfirm(apiClient, workspaceId, orderId, {
        scans: scansRef.current,
        ...(force ? { force: true, note: why } : {}),
      });
      savePackDraft(orderId, null);
      setForceOpen(false);
      setDone(true);
    } catch (err) {
      if (orderPackNotComplete(err)) {
        // The order changed under the page (its items were edited): show it as it is now.
        setActionError(t.notComplete);
        void runCheck(scansRef.current, false);
      } else if (apiFieldProblems(err).some((p) => p.field === "note")) {
        setNoteError(t.whyRequired);
      } else {
        setActionError(errorMessage(err));
      }
    } finally {
      setConfirming(false);
    }
  }

  const orderLink = `/orders/${orderId}`;
  // Opened from a pick list: the packer goes back to it for the next order, not to this order's page.
  const cameFrom = (location.state as { pickList?: unknown } | null)?.pickList;
  const pickList = typeof cameFrom === "string" && cameFrom.startsWith("/orders/pick-list") ? cameFrom : null;
  const back = pickList ? { to: pickList, label: t.backToPickList } : { to: orderLink, label: t.backToOrder };
  const packedBadge = <StatusBadge value={ORDER_PACKED_TAG} tone="success" text={t.packed} />;
  const header = (
    <PageHeader
      title={t.scanToPack}
      titleMeta={check?.order.orderNumber}
      titleBadge={done || check?.order.packed ? packedBadge : undefined}
      back={back}
    />
  );
  const pill = "min-h-11 rounded-full px-5";

  if (done) {
    return (
      <div className="max-w-3xl">
        {header}
        <div role="status">
          <EmptyState
            tone="success"
            icon={<IconPacked aria-hidden />}
            title={t.packedTitle}
            description={t.packedBody}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild className={pill}>
                  <Link to={back.to}>{back.label}</Link>
                </Button>
                <Button asChild variant="outline" className={pill}>
                  <Link to={`/orders?tag=${ORDER_PACKED_TAG}`}>{t.viewPacked}</Link>
                </Button>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  if (isApiErrorCode(loadError, "ORDER_CANCELLED")) {
    return (
      <div className="max-w-3xl">
        {header}
        <EmptyState
          tone="attention"
          icon={<IconFailed aria-hidden />}
          title={t.cancelledTitle}
          description={t.cancelledBody}
          action={
            <Button asChild variant="outline" className={pill}>
              <Link to={back.to}>{back.label}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const unknown = check?.unknown ?? [];
  const wrongCodes = new Set(unknown.map(normalize));
  const lines = check?.lines ?? [];
  const manualLines = check?.manual ?? [];
  const manualLeft = manualLines.filter((_, i) => !manual.has(i)).length;
  const missing = lines.reduce((n, line) => n + line.missing, 0);
  const over = lines.reduce((n, line) => n + line.over, 0);
  const allDone = Boolean(check?.complete) && manualLeft === 0;
  const scanned = check?.progress.scanned ?? 0;
  const expected = check?.progress.expected ?? 0;
  const progressText = fmt(t.progress, { scanned, expected });
  // Whose turn it is: the line the last scan went to while it still wants more, else the first line that does.
  const lastLine = signal?.kind === "ok" ? signal.variantId : null;
  const current = lines.find((line) => line.variantId === lastLine && line.missing > 0) ?? lines.find((line) => line.missing > 0) ?? null;
  const currentOptions = current ? optionsText(current.options) : "";
  // Newest first, each with its place in the list so it can be taken out.
  const history = scans.map((code, index) => ({ code, index })).reverse();
  const shownHistory = allScans ? history : history.slice(0, SCANS_SHOWN);
  const shortfall = [
    missing + manualLeft > 0 ? fmt(t.summaryMissing, { count: missing + manualLeft }) : null,
    over > 0 ? fmt(t.overBy, { count: over }) : null,
    unknown.length > 0 ? fmt(t.summaryUnknown, { count: unknown.length }) : null,
  ].filter(Boolean);

  return (
    <div className="max-w-5xl">
      {header}

      <DataState
        loading={loading}
        error={loadError}
        onRetry={() => {
          setLoading(true);
          setLoadError(null);
          void runCheck(scansRef.current, false);
        }}
        skeleton={<StationSkeleton />}
      >
        {check && (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
            {/* ------------------------------------------------ the station ---- */}
            <section
              aria-label={t.stationLabel}
              data-flash={flash ? "" : undefined}
              className={cn(
                "zimos-pack-station min-w-0 rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-5 lg:sticky lg:top-24",
                flash && "ring-2 ring-danger"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 text-sm leading-6 font-semibold text-ink tabular-nums">{progressText}</p>
                {allDone && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-success">
                    <IconSuccess className="size-4" weight="fill" aria-hidden />
                    {t.lineDone}
                  </span>
                )}
              </div>
              <MeterBar value={scanned} max={expected} label={progressText} done={allDone} className="mt-2" />

              {/* The item whose turn it is, large: what the packer's eye goes back to between two scans. */}
              <div className="zimos-pack-current mt-4 rounded-[1.25rem] bg-paper-sunken p-4" data-state={allDone ? "done" : current ? "item" : "wait"}>
                {allDone ? (
                  <div className="flex items-start gap-3">
                    <IconSuccess className="size-9 shrink-0 text-success" weight="duotone" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-xl leading-7 font-semibold text-ink">{t.allDoneTitle}</p>
                      <p className="mt-0.5 text-sm leading-6 text-ink-soft">{t.allDoneBody}</p>
                    </div>
                  </div>
                ) : current ? (
                  <>
                    <p className="text-xs leading-4 font-medium text-ink-soft">{t.currentLabel}</p>
                    <div className="mt-1.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xl leading-7 font-semibold text-ink">
                          <bdi>{current.name}</bdi>
                        </p>
                        {currentOptions && (
                          <p className="text-[15px] leading-6 text-ink-soft">
                            <bdi>{currentOptions}</bdi>
                          </p>
                        )}
                        <LineCodes line={current} noSku={t.noSku} barcode={t.barcode} className="mt-1" />
                      </div>
                      <p className="shrink-0 text-[28px] leading-9 font-semibold text-ink tabular-nums">
                        <bdi>{fmt(t.ofCount, { scanned: current.scanned, expected: current.expected })}</bdi>
                      </p>
                    </div>
                  </>
                ) : check.complete ? (
                  // Every barcode is in: what is left is ticked by hand.
                  <div className="flex items-start gap-3">
                    <IconChecklist className="size-9 shrink-0 text-accent-dark" weight="duotone" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-lg leading-7 font-semibold text-ink">{t.allScanned}</p>
                      <p className="mt-0.5 text-sm leading-6 text-ink-soft">{t.manualFirst}</p>
                    </div>
                  </div>
                ) : (
                  // Nothing is missing, yet the order is not right: something extra, or a code that is not its.
                  <div className="flex items-start gap-3">
                    <IconWarning className="size-9 shrink-0 text-danger" weight="duotone" aria-hidden />
                    <p className="min-w-0 text-[15px] leading-6 font-medium text-ink">{t.notComplete}</p>
                  </div>
                )}
              </div>

              <form onSubmit={addScan} className="mt-4">
                <label htmlFor={inputId} className="block text-sm font-semibold text-ink">
                  {t.scanLabel}
                </label>
                {/* One pill, 64px tall: the glyph, the field, the button. A press anywhere on it lands in the field. */}
                <div className="zimos-pack-field mt-2 flex h-16 items-center gap-2 rounded-full bg-paper-raised ps-5 pe-2 ring-1 ring-line-strong transition-[box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-primary motion-reduce:transition-none">
                  <IconBarcode className="size-6 shrink-0 text-ink-soft" aria-hidden />
                  <input
                    ref={inputRef}
                    id={inputId}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={onBoxBlur}
                    dir="ltr"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="done"
                    maxLength={ORDER_PACK_SCAN_LENGTH}
                    placeholder={t.scanPlaceholder}
                    aria-describedby={hintId}
                    className="h-full min-w-0 flex-1 bg-transparent font-mono text-xl text-ink outline-none placeholder:font-sans placeholder:text-base placeholder:text-ink-soft"
                  />
                  <Button type="submit" className="h-12 shrink-0 rounded-full px-5 text-[15px]" disabled={!value.trim()}>
                    {t.add}
                  </Button>
                </div>
                <p id={hintId} className="mt-2 px-1 text-xs leading-5 text-ink-soft">
                  {t.scanHint}
                </p>
              </form>

              {/* What the last scan did: in words and with an icon, never by colour alone. */}
              <div aria-live="assertive" className="empty:hidden">
                {signal?.kind === "ok" && (
                  <p className="zimos-pack-signal mt-3 flex items-start gap-2.5 rounded-[1rem] bg-success-soft px-3.5 py-3 text-[15px] leading-6 font-medium text-success" data-tone="ok">
                    <IconSuccess className="mt-0.5 size-5 shrink-0" weight="fill" aria-hidden />
                    <span className="min-w-0">
                      <bdi>{signal.name}</bdi> · {fmt(t.progress, { scanned: signal.scanned, expected: signal.expected })}
                    </span>
                  </p>
                )}
                {signal && signal.kind !== "ok" && (
                  <p className="zimos-pack-signal mt-3 flex items-start gap-2.5 rounded-[1rem] bg-danger-soft px-3.5 py-3 text-base leading-6 font-semibold text-danger" data-tone="wrong">
                    {signal.kind === "over" ? (
                      <IconWarning className="mt-0.5 size-5 shrink-0" weight="fill" aria-hidden />
                    ) : (
                      <IconFailed className="mt-0.5 size-5 shrink-0" weight="fill" aria-hidden />
                    )}
                    <span className="min-w-0">
                      {signal.kind === "unknown" && (
                        <>
                          {t.signalUnknown}:{" "}
                          <bdi dir="ltr" className="font-mono break-all">
                            {signal.code}
                          </bdi>
                        </>
                      )}
                      {signal.kind === "over" && (
                        <>
                          {t.signalOver}: <bdi>{signal.name}</bdi>
                        </>
                      )}
                      {signal.kind === "limit" && fmt(t.tooManyScans, { max: ORDER_PACK_SCANS_MAX })}
                    </span>
                  </p>
                )}
              </div>

              {unknown.length > 0 && (
                <div role="alert" className="zimos-pack-unknown mt-3 rounded-[1rem] bg-danger-soft px-3.5 py-3 text-sm text-danger">
                  <p className="font-semibold">{t.unknownCodes}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {unknown.map((code, i) => (
                      <bdi key={`${code}-${i}`} dir="ltr" className="font-mono break-all">
                        {code}
                      </bdi>
                    ))}
                  </p>
                  <Button size="sm" variant="outline" className="mt-2.5 min-h-11 rounded-full px-4" onClick={removeUnknown}>
                    {t.removeUnknown}
                  </Button>
                </div>
              )}

              {checkError && (
                <p role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-danger">
                  {checkError}
                  <Button size="sm" variant="outline" className="min-h-11 rounded-full px-4" onClick={() => void runCheck(scansRef.current, false)}>
                    {t.retry}
                  </Button>
                </p>
              )}
              {actionError && !forceOpen && (
                <Alert variant="danger" role="alert" className="mt-3">
                  {actionError}
                </Alert>
              )}

              <div className="mt-4 flex flex-col gap-2">
                {allDone && (
                  <Button
                    className="h-14 w-full gap-2 rounded-full px-5 text-base"
                    onClick={() => void confirm(false)}
                    disabled={confirming}
                    aria-busy={confirming || undefined}
                  >
                    {confirming ? (
                      <IconSpinner className="size-5 animate-spin motion-reduce:animate-none" weight="bold" aria-hidden />
                    ) : (
                      <IconPacked className="size-5" weight="bold" aria-hidden />
                    )}
                    {confirming ? t.confirming : t.confirmAll}
                  </Button>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="min-h-11 flex-1 gap-1.5 rounded-full px-4" onClick={undo} disabled={scans.length === 0}>
                    <IconUndo className="size-4 rtl:-scale-x-100" weight="bold" aria-hidden />
                    {t.undo}
                  </Button>
                  {!allDone && (
                    <Button
                      variant="outline"
                      className="min-h-11 flex-1 rounded-full px-4"
                      aria-haspopup="dialog"
                      onClick={() => {
                        setNoteError(null);
                        setForceOpen(true);
                      }}
                    >
                      {t.confirmAnyway}
                    </Button>
                  )}
                </div>
              </div>
            </section>

            {/* -------------------------------------------------- the lists ---- */}
            <div className="flex min-w-0 flex-col gap-3">
              {check.order.packed && <Alert>{t.alreadyPacked}</Alert>}

              <AccordionSection
                title={t.itemsTitle}
                icon={IconPackage}
                summary={progressText}
                badge={
                  <span className="text-xs font-medium text-ink-soft tabular-nums">
                    <bdi>{fmt(t.ofCount, { scanned, expected })}</bdi>
                  </span>
                }
                defaultOpen
                persistKey="pack:items"
                flush
              >
                <ul>
                  {lines.map((line) => {
                    const options = optionsText(line.options);
                    const isCurrent = current?.variantId === line.variantId;
                    return (
                      <li
                        key={line.variantId}
                        data-current={isCurrent ? "" : undefined}
                        className={cn(
                          "zimos-pack-line flex items-start justify-between gap-3 border-b border-line px-4 py-3 last:border-0",
                          isCurrent && "bg-primary-soft/50"
                        )}
                      >
                        <div className="min-w-0">
                          <p className={cn("text-[15px] leading-6 font-medium", line.done ? "text-ink-soft" : "text-ink")}>
                            <bdi>{line.name}</bdi>
                            {options && (
                              <>
                                {" — "}
                                <bdi>{options}</bdi>
                              </>
                            )}
                          </p>
                          <LineCodes line={line} noSku={t.noSku} barcode={t.barcode} className="mt-0.5" />
                        </div>
                        <div className="shrink-0 text-end">
                          <p
                            className={cn(
                              "inline-flex items-center gap-1.5 text-[15px] leading-6 font-semibold tabular-nums",
                              line.done ? "text-success" : line.over > 0 ? "text-danger" : "text-ink"
                            )}
                          >
                            {line.done && <IconSuccess className="size-5 shrink-0" weight="fill" aria-hidden />}
                            {line.over > 0 && <IconWarning className="size-5 shrink-0" weight="fill" aria-hidden />}
                            <bdi>{fmt(t.ofCount, { scanned: line.scanned, expected: line.expected })}</bdi>
                            {line.done && <span className="sr-only"> — {t.lineDone}</span>}
                          </p>
                          {line.over > 0 && <p className="text-xs font-medium text-danger">{fmt(t.overBy, { count: line.over })}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </AccordionSection>

              {manualLines.length > 0 && (
                <AccordionSection
                  title={t.manualTitle}
                  icon={IconChecklist}
                  summary={manualLeft > 0 ? fmt(t.manualLeft, { count: manualLeft }) : t.manualAllTicked}
                  badge={
                    manualLeft > 0 ? (
                      <StatusBadge value="manual" tone="warning" text={fmt(t.manualLeft, { count: manualLeft })} />
                    ) : (
                      <StatusBadge value="manual" tone="success" text={t.manualAllTicked} />
                    )
                  }
                  defaultOpen
                  persistKey="pack:manual"
                >
                  <p className="text-xs leading-5 text-ink-soft">{t.manualHint}</p>
                  <ul className="mt-1">
                    {manualLines.map((line, i) => {
                      const ticked = manual.has(i);
                      return (
                        <li key={i}>
                          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-[15px] leading-6">
                            <TickBox checked={ticked} onChange={() => toggleManual(i)} />
                            <span className={cn("shrink-0 font-bold tabular-nums", ticked ? "text-ink-soft" : "text-ink")}>
                              {fmt("{count} ×", { count: line.quantity })}
                            </span>
                            <bdi className={cn("min-w-0", ticked ? "text-ink-soft line-through" : "text-ink")}>{line.name}</bdi>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </AccordionSection>
              )}

              {scans.length > 0 && (
                <AccordionSection
                  title={t.scansTitle}
                  icon={IconScan}
                  summary={pluralOf(t, "scans", scans.length)}
                  badge={<span className="text-xs font-medium text-ink-soft tabular-nums">{fmt("{n}", { n: scans.length })}</span>}
                  actions={
                    <Button variant="ghost" size="sm" className="min-h-11 rounded-full px-3 text-ink-soft hover:text-ink" onClick={startOver}>
                      {t.startOver}
                    </Button>
                  }
                  persistKey="pack:scans"
                  flush
                >
                  <ul>
                    {shownHistory.map(({ code, index }) => {
                      const wrong = wrongCodes.has(normalize(code));
                      return (
                        <li key={index} className="flex items-center justify-between gap-2 border-b border-line ps-4 pe-1 last:border-0">
                          <span className="flex min-w-0 flex-wrap items-center gap-2 py-1.5">
                            <bdi dir="ltr" className={cn("font-mono text-sm break-all", wrong ? "text-danger" : "text-ink")}>
                              {code}
                            </bdi>
                            {wrong && <StatusBadge value="not_in_order" tone="danger" text={t.notInOrder} />}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeScan(index)}
                            aria-label={fmt(t.removeScan, { code })}
                            title={fmt(t.removeScan, { code })}
                            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[background-color,color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-primary motion-safe:active:scale-[0.97] motion-reduce:transition-none"
                          >
                            <IconClose className="size-4" weight="bold" aria-hidden />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {history.length > shownHistory.length && (
                    <div className="border-t border-line p-2 text-center">
                      <Button variant="ghost" size="sm" className="min-h-11 rounded-full px-4" onClick={() => setAllScans(true)}>
                        {fmt(t.showAllScans, { count: history.length })}
                      </Button>
                    </div>
                  )}
                </AccordionSection>
              )}
            </div>
          </div>
        )}
      </DataState>

      <Modal
        open={forceOpen}
        onClose={() => {
          if (!confirming) setForceOpen(false);
        }}
        title={t.confirmAnywayTitle}
        description={shortfall.length > 0 ? shortfall.join(" · ") : undefined}
        footer={
          <>
            <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => setForceOpen(false)} disabled={confirming}>
              {t.cancel}
            </Button>
            <Button type="submit" form={forceFormId} className="rounded-full px-5" disabled={confirming} aria-busy={confirming || undefined}>
              {confirming ? t.confirming : t.confirmAnyway}
            </Button>
          </>
        }
      >
        <form
          id={forceFormId}
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void confirm(true);
          }}
        >
          {actionError && (
            <Alert variant="danger" role="alert">
              {actionError}
            </Alert>
          )}
          <Field label={t.why} required hint={t.whyHint} error={noteError ?? undefined}>
            {({ id, ...aria }) => (
              <Textarea
                id={id}
                {...aria}
                autoFocus
                rows={3}
                dir="auto"
                value={note}
                maxLength={ORDER_PACK_NOTE_MAX}
                className="text-base md:text-sm"
                onChange={(e) => {
                  setNote(e.target.value);
                  setNoteError(null);
                }}
              />
            )}
          </Field>
        </form>
      </Modal>
    </div>
  );
}

/** A line's SKU and barcode, in the quiet mono of codes; "No SKU" when it has neither. */
function LineCodes({ line, noSku, barcode, className }: { line: OrderPackLine; noSku: string; barcode: string; className?: string }) {
  return (
    <p className={cn("flex flex-wrap gap-x-3 text-xs leading-5 text-ink-soft", className)}>
      {line.sku && (
        <bdi dir="ltr" className="font-mono">
          {line.sku}
        </bdi>
      )}
      {line.barcode && (
        <span>
          {barcode}:{" "}
          <bdi dir="ltr" className="font-mono">
            {line.barcode}
          </bdi>
        </span>
      )}
      {!line.sku && !line.barcode && noSku}
    </p>
  );
}

/** The station while the first answer is on its way: the pane, the bar, the item, the scan pill — and the list beside it. */
function StationSkeleton() {
  const pane = "rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line";
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
      <div className={cn("zimos-pack-station p-4 sm:p-5", pane)}>
        <SkeletonBar className="h-3.5 w-32" />
        <SkeletonBar className="mt-3 h-2.5 w-full" />
        <div className="mt-4 rounded-[1.25rem] bg-paper-sunken p-4">
          <SkeletonBar className="h-2.5 w-20" />
          <SkeletonBar className="mt-3 h-5 w-3/5" />
          <SkeletonBar className="mt-2.5 h-2.5 w-2/5" />
        </div>
        <SkeletonBar className="mt-4 h-3 w-48" />
        <SkeletonBar className="mt-2 h-16 w-full" />
        <SkeletonBar className="mt-4 h-11 w-full" />
      </div>
      <div className={cn("p-4", pane)}>
        <SkeletonBar className="h-4 w-2/5" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="mt-4 flex items-center justify-between gap-4">
            <SkeletonBar className={i % 2 === 0 ? "w-1/2" : "w-2/5"} />
            <SkeletonBar className="w-12 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
