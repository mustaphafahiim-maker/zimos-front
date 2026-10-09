import { useId, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { IconBlock, IconEdit, IconEmail, IconEye, IconEyeOff, IconPower, IconScale } from "@/components/icons";
import { Alert, Button, Card } from "@store-builder/ui";
import {
  apiFieldProblems,
  giftCardCode,
  giftCardGet,
  giftCardUpdate,
  type GiftCard,
  type GiftCardDetail,
  type GiftCardTransaction,
  type GiftCardUpdatePayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatDateTime, formatMoney, majorToMinor, parseMoney } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, TextField } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { CodeBox } from "./IssueGiftCardDialog";
import {
  EMAIL_RE,
  GIFT_CARD_STRINGS,
  KIND_KEY,
  STATE_KEY,
  STATE_TONE,
  dateFieldToIso,
  isoToDateField,
  tomorrowDateField,
} from "./giftCardStrings";

const toAscii = (raw: string) => raw.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

/**
 * One gift card (GET /gift-cards/:id): its balance out of the value it was
 * issued for, what it can do now, who it is for, and every change of the
 * balance. Show the code again, resend it, adjust the balance, edit the
 * details, disable or turn it back on.
 */
export function GiftCardDetailPage() {
  const t = useT(GIFT_CARD_STRINGS);
  const { giftCardId = "" } = useParams<{ giftCardId: string }>();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const detail = useAsync(() => giftCardGet(apiClient, workspaceId, giftCardId), [workspaceId, giftCardId]);

  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<"code" | "resend" | "enable" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const card = detail.data?.giftCard ?? null;
  const title = card ? fmt(t.cardTitle, { last4: card.last4 }) : t.title;

  async function run(kind: "code" | "resend" | "enable", task: () => Promise<void>) {
    setBusy(kind);
    setActionError(null);
    try {
      await task();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const update = async (body: GiftCardUpdatePayload) => {
    const next = await giftCardUpdate(apiClient, workspaceId, giftCardId, body);
    detail.setData(next);
    return next;
  };

  return (
    <div>
      <PageHeader
        back={{ to: "/gift-cards", label: t.back }}
        title={title}
        titleBadge={card ? <StatusBadge value={card.state} tone={STATE_TONE[card.state]} text={t[STATE_KEY[card.state]]} /> : undefined}
      />

      <DataState loading={detail.loading} error={detail.error} onRetry={() => void detail.refresh()}>
        {card && detail.data && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <div className="min-w-0 space-y-4">
              <Card className="p-4 sm:p-5">
                <p className="text-xs text-ink-soft">{t.balance}</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-3xl font-semibold tabular-nums text-ink">{formatMoney(card.balanceAmount, card.currency)}</span>
                  <span className="text-sm text-ink-soft">
                    {fmt(t.ofInitial, { initial: formatMoney(card.initialAmount, card.currency) })}
                  </span>
                </p>
                <BalanceBar card={card} />
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
                  <li>
                    {card.expiresAt
                      ? fmt(card.state === "expired" ? t.expiredOn : t.validUntil, { date: formatDate(card.expiresAt) })
                      : t.noExpiry}
                  </li>
                  <li>{fmt(t.issuedOn, { date: formatDate(card.createdAt) })}</li>
                  <li>
                    {card.source === "order" && card.orderId ? (
                      <Link to={`/orders/${card.orderId}`} className="font-medium text-primary hover:underline">
                        {t.boughtOnOrder}
                      </Link>
                    ) : (
                      t.sourceManual
                    )}
                  </li>
                </ul>
                <StateNotice card={card} />

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={busy !== null}
                    onClick={() =>
                      code
                        ? setCode(null)
                        : void run("code", async () => setCode((await giftCardCode(apiClient, workspaceId, card.id, false)).code))
                    }
                  >
                    {code ? <IconEyeOff className="size-4" aria-hidden /> : <IconEye className="size-4" aria-hidden />}
                    {busy === "code" ? t.showingCode : code ? t.hideCode : t.showCode}
                  </Button>
                  {card.recipientEmail && (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={busy !== null}
                      onClick={() =>
                        void run("resend", async () => {
                          await giftCardCode(apiClient, workspaceId, card.id, true);
                          toast.success(fmt(t.resent, { email: card.recipientEmail ?? "" }));
                        })
                      }
                    >
                      <IconEmail className="size-4" aria-hidden />
                      {busy === "resend" ? t.resending : t.resend}
                    </Button>
                  )}
                  <Button type="button" variant="outline" className="min-h-11" disabled={busy !== null} onClick={() => setAdjusting(true)}>
                    <IconScale className="size-4" aria-hidden />
                    {t.adjust}
                  </Button>
                  <Button type="button" variant="outline" className="min-h-11" disabled={busy !== null} onClick={() => setEditing(true)}>
                    <IconEdit className="size-4" aria-hidden />
                    {t.editDetails}
                  </Button>
                  {card.status === "disabled" ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={busy !== null}
                      onClick={() =>
                        void run("enable", async () => {
                          await update({ status: "active" });
                          toast.success(t.enabledToast);
                        })
                      }
                    >
                      <IconPower className="size-4" aria-hidden />
                      {busy === "enable" ? t.enabling : t.enable}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 text-danger hover:bg-danger-soft hover:text-danger"
                      disabled={busy !== null}
                      onClick={() => setDisabling(true)}
                    >
                      <IconBlock className="size-4" aria-hidden />
                      {t.disable}
                    </Button>
                  )}
                </div>
                {actionError && (
                  <Alert variant="danger" className="mt-3">
                    {actionError}
                  </Alert>
                )}
                {code && (
                  <div className="mt-4">
                    <CodeBox code={code} />
                  </div>
                )}
              </Card>

              <History detail={detail.data} />
            </div>

            <Section title={t.recipient}>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-soft">{t.recipientNameLabel}</dt>
                  <dd className="text-ink">
                    <bdi>{card.recipientName || "—"}</bdi>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-soft">{t.recipientEmailLabel}</dt>
                  <dd className="break-all text-ink">
                    <bdi dir="ltr">{card.recipientEmail || "—"}</bdi>
                  </dd>
                </div>
                {card.message && (
                  <div>
                    <dt className="text-xs text-ink-soft">{t.messageLabel}</dt>
                    <dd className="whitespace-pre-line text-ink">
                      <bdi>{card.message}</bdi>
                    </dd>
                  </div>
                )}
                {card.note && (
                  <div>
                    <dt className="text-xs text-ink-soft">{t.noteLabel}</dt>
                    <dd className="whitespace-pre-line text-ink">
                      <bdi>{card.note}</bdi>
                    </dd>
                  </div>
                )}
              </dl>
            </Section>
          </div>
        )}
      </DataState>

      {card && (
        <>
          <AdjustDialog open={adjusting} card={card} onClose={() => setAdjusting(false)} onSave={update} />
          <EditDialog open={editing} card={card} onClose={() => setEditing(false)} onSave={update} />
          <ConfirmDialog
            open={disabling}
            title={fmt(t.disableTitle, { last4: card.last4 })}
            confirmLabel={t.disableConfirm}
            cancelLabel={t.cancel}
            busyLabel={t.disabling}
            destructive
            onCancel={() => setDisabling(false)}
            onConfirm={async () => {
              await update({ status: "disabled" });
              setDisabling(false);
              toast.success(t.disabledToast);
            }}
          >
            <p className="text-sm text-ink-soft">{t.disableBody}</p>
          </ConfirmDialog>
        </>
      )}
    </div>
  );
}

/** What is left of the value, as a bar (the number above says it in words). */
function BalanceBar({ card }: { card: GiftCard }) {
  const initial = parseMoney(card.initialAmount);
  const share = initial > 0 ? Math.max(0, Math.min(1, parseMoney(card.balanceAmount) / initial)) : 0;
  return (
    <div aria-hidden className="mt-3 h-2 overflow-hidden rounded-full bg-paper-sunken">
      <div
        className={card.state === "active" ? "h-full rounded-full bg-primary" : "h-full rounded-full bg-line-strong"}
        style={{ width: `${Math.round(share * 100)}%` }}
      />
    </div>
  );
}

/** Why a card that is not active cannot be spent, and the way back. */
function StateNotice({ card }: { card: GiftCard }) {
  const t = useT(GIFT_CARD_STRINGS);
  const text = card.state === "disabled" ? t.disabledNotice : card.state === "expired" ? t.expiredNotice : card.state === "empty" ? t.emptyNotice : null;
  if (!text) return null;
  return <p className="mt-3 rounded-[var(--radius)] bg-accent-soft px-3 py-2 text-sm text-accent-dark">{text}</p>;
}

function History({ detail }: { detail: GiftCardDetail }) {
  const t = useT(GIFT_CARD_STRINGS);
  const currency = detail.giftCard.currency;
  const signed = (row: GiftCardTransaction) => {
    const n = parseMoney(row.amount);
    return (
      <bdi className={n > 0 ? "font-medium whitespace-nowrap text-success tabular-nums" : "font-medium whitespace-nowrap text-ink tabular-nums"}>
        {n > 0 ? "+" : n < 0 ? "−" : ""}
        {formatMoney(Math.abs(n), currency)}
      </bdi>
    );
  };
  const columns: Column<GiftCardTransaction>[] = [
    {
      key: "what",
      header: t.colWhat,
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="text-ink">
            {t[KIND_KEY[row.kind]]}
            {row.orderId && (
              <>
                {" · "}
                <Link to={`/orders/${row.orderId}`} onClick={(e) => e.stopPropagation()} className="font-medium text-primary hover:underline">
                  {t.orderLink}
                </Link>
              </>
            )}
          </span>
          {/* Only what staff wrote: a hold's or a release's note is the system's own remark (handoff 201). */}
          {row.note && !/^refund:/.test(row.note) && (row.kind === "adjust" || row.kind === "issue") && (
            <span className="text-xs font-normal text-ink-soft">
              <bdi>{row.note}</bdi>
            </span>
          )}
        </span>
      ),
    },
    { key: "change", header: t.colChange, align: "end", cell: signed },
    {
      key: "after",
      header: t.colAfter,
      align: "end",
      cell: (row) => <span className="whitespace-nowrap text-ink-soft tabular-nums">{formatMoney(row.balanceAfter, currency)}</span>,
    },
    { key: "when", header: t.colWhen, cell: (row) => <span className="whitespace-nowrap text-xs text-ink-soft">{formatDateTime(row.createdAt)}</span> },
  ];
  return (
    <Section title={t.history} description={t.historyHint} flush>
      {detail.transactions.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-ink-soft">{t.historyEmpty}</p>
      ) : (
        <>
          {/* Phones: one line per change. */}
          <ul className="divide-y divide-line border-t border-line md:hidden">
            {detail.transactions.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  {columns[0].cell(row, 0)}
                  <p className="mt-0.5 text-xs text-ink-soft">{formatDateTime(row.createdAt)}</p>
                </div>
                <div className="shrink-0 text-end">
                  {signed(row)}
                  <p className="mt-0.5 text-xs text-ink-soft tabular-nums">{fmt(t.afterShort, { amount: formatMoney(row.balanceAfter, currency) })}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <DataTable columns={columns} rows={detail.transactions} rowKey={(row) => row.id} minWidth="36rem" phoneCards={false} />
          </div>
        </>
      )}
    </Section>
  );
}

function AdjustDialog({
  open,
  card,
  onClose,
  onSave,
}: {
  open: boolean;
  card: GiftCard;
  onClose: () => void;
  onSave: (body: GiftCardUpdatePayload) => Promise<unknown>;
}) {
  const t = useT(GIFT_CARD_STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const [direction, setDirection] = useState<"add" | "take">("add");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState(false);
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      setDirection("add");
      setAmount("");
      setNote("");
      setAmountError(null);
      setFailure(null);
    }
  }

  const balance = parseMoney(card.balanceAmount);
  const minor = majorToMinor(toAscii(amount));
  const valid = Number.isFinite(minor) && minor >= 1;
  const next = valid ? balance + (direction === "add" ? minor : -minor) : null;
  const tooMuch = fmt(t.tooMuch, { amount: formatMoney(balance, card.currency) });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!valid) {
      setAmountError(t.amountError);
      return;
    }
    if (direction === "take" && minor > balance) {
      setAmountError(tooMuch);
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      await onSave({ adjustBy: direction === "add" ? minor : -minor, adjustNote: note.trim() || null });
      onClose();
      toast.success(t.adjusted);
    } catch (err) {
      // The balance moved meanwhile (spent on an order): the API says how much can still come off.
      if (apiFieldProblems(err).some((p) => p.field === "adjustBy")) setAmountError(tooMuch);
      else setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const choice = (value: "add" | "take", label: string) => (
    <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-[var(--radius)] px-3 text-sm text-ink ring-1 ring-line has-[:checked]:bg-primary-soft has-[:checked]:font-medium has-[:checked]:text-primary-dark has-[:checked]:ring-primary">
      <input
        type="radio"
        name={`${formId}-direction`}
        className="size-4 accent-primary"
        checked={direction === value}
        onChange={() => {
          setDirection(value);
          setAmountError(null);
        }}
      />
      {label}
    </label>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.adjustTitle}
      description={fmt(t.adjustDescription, { balance: formatMoney(card.balanceAmount, card.currency) })}
      footer={
        <>
          <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="min-h-11" disabled={saving}>
            {saving ? t.adjustSaving : t.adjustSave}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink">{t.direction}</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            {choice("add", t.addTo)}
            {choice("take", t.takeOff)}
          </div>
        </fieldset>
        <MoneyInput
          label={t.adjustAmount}
          required
          currency={card.currency}
          value={amount}
          onChange={(v) => {
            setAmount(v);
            setAmountError(null);
          }}
          error={amountError ?? undefined}
          hint={next !== null && next >= 0 ? fmt(t.newBalance, { amount: formatMoney(next, card.currency) }) : undefined}
        />
        <Field label={t.adjustNote} hint={t.adjustNoteHint}>
          {(props) => <Textarea {...props} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}

function EditDialog({
  open,
  card,
  onClose,
  onSave,
}: {
  open: boolean;
  card: GiftCard;
  onClose: () => void;
  onSave: (body: GiftCardUpdatePayload) => Promise<unknown>;
}) {
  const t = useT(GIFT_CARD_STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const initial = () => ({
    recipientName: card.recipientName ?? "",
    recipientEmail: card.recipientEmail ?? "",
    expires: isoToDateField(card.expiresAt),
    note: card.note ?? "",
  });
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<{ email?: string; expires?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState(false);
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      setDraft(initial());
      setErrors({});
      setFailure(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const was = initial();
    const body: GiftCardUpdatePayload = {};
    if (draft.recipientName.trim() !== was.recipientName) body.recipientName = draft.recipientName.trim() || null;
    if (draft.recipientEmail.trim() !== was.recipientEmail) body.recipientEmail = draft.recipientEmail.trim() || null;
    if (draft.note.trim() !== was.note) body.note = draft.note.trim() || null;
    if (draft.expires !== was.expires) body.expiresAt = dateFieldToIso(draft.expires);
    const found: { email?: string; expires?: string } = {};
    if (body.recipientEmail && !EMAIL_RE.test(body.recipientEmail)) found.email = t.emailError;
    if (body.expiresAt && new Date(body.expiresAt).getTime() <= Date.now()) found.expires = t.expiresError;
    setErrors(found);
    if (found.email || found.expires) return;
    if (Object.keys(body).length === 0) {
      onClose();
      toast.success(t.noChanges);
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      await onSave(body);
      onClose();
      toast.success(t.saved);
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.editTitle}
      footer={
        <>
          <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="min-h-11" disabled={saving}>
            {saving ? t.editSaving : t.editSave}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <TextField
          label={t.recipientName}
          autoComplete="off"
          maxLength={200}
          value={draft.recipientName}
          onChange={(e) => setDraft((d) => ({ ...d, recipientName: e.target.value }))}
        />
        <TextField
          label={t.recipientEmail}
          type="email"
          dir="ltr"
          autoComplete="off"
          maxLength={255}
          value={draft.recipientEmail}
          error={errors.email}
          onChange={(e) => setDraft((d) => ({ ...d, recipientEmail: e.target.value }))}
        />
        <Field label={t.expires} hint={t.expiresHint} error={errors.expires}>
          {(props) => (
            <input
              {...props}
              type="date"
              min={tomorrowDateField()}
              value={draft.expires}
              onChange={(e) => setDraft((d) => ({ ...d, expires: e.target.value }))}
              className="flex h-11 w-full max-w-[14rem] rounded-[var(--radius)] border border-line-strong bg-paper-raised px-3 text-sm text-ink focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
            />
          )}
        </Field>
        <Field label={t.note} hint={t.noteHint}>
          {(props) => (
            <Textarea {...props} rows={2} maxLength={500} value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
          )}
        </Field>
        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
