import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  ApiError,
  affiliatesCreate,
  affiliatesRecordPayout,
  affiliatesUpdate,
  type Affiliate,
  type AffiliateCommissionType,
} from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { Field, TextField } from "@/components/Field";
import { IconCoins, IconPercent, IconWhatsApp } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { toAsciiDigits } from "@/pages/loyalty/loyaltyStrings";
import { InlineSwitch, focusFirstInvalid } from "@/pages/loyalty/programmeKit";
import { AFFILIATE_STRINGS, PAYOUT_METHODS, type PayoutMethod } from "./strings";

/** A code the merchant can keep or change: the name in Latin letters, else the phone's last digits. */
export function suggestCode(name: string, phone: string): string {
  const latin = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  if (latin.length >= 2) return latin;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `m${digits.slice(-4)}` : "";
}

const EMPTY_FORM = { name: "", phone: "", code: "", type: "percent" as AffiliateCommissionType, value: "10", active: true, notes: "" };
/** 1,000.00 in minor units: the order the commission example is worked out on. */
const EXAMPLE_BASE = 100000;

/** A field of the sheet: 44px tall, 16px text under a finger (the input's own default). */
const FIELD = "[&_input]:h-11";
const PILL = "rounded-full px-5";

type FieldKey = "name" | "phone" | "value" | "code";

/**
 * Add or edit an affiliate, in a sheet over the list (bottom on a phone,
 * centred from 640px). A new one is handed back so the page can open "send
 * link" next. Save is always there: what is missing is said under its field,
 * and the first of them takes the focus.
 */
export function AffiliateFormModal({
  affiliate,
  currency,
  storeBase,
  onClose,
  onSaved,
}: {
  affiliate: Affiliate | "new" | null;
  currency: string;
  storeBase: string;
  onClose: () => void;
  onSaved: (saved: Affiliate, created: boolean) => void;
}) {
  const t = useT(AFFILIATE_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const existing = affiliate && affiliate !== "new" ? affiliate : null;
  const [form, setForm] = useState(EMPTY_FORM);
  // Until the merchant types a code of their own, it follows the name and phone.
  const [codeTouched, setCodeTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<Partial<Record<FieldKey, string>>>({});
  // The sheet keeps its last wording while it closes.
  const [editingShown, setEditingShown] = useState(false);

  useEffect(() => {
    if (affiliate === null) return;
    setError(null);
    setProblems({});
    setEditingShown(existing !== null);
    setCodeTouched(existing !== null);
    setForm(
      existing
        ? {
            name: existing.name,
            phone: `+${existing.phone}`,
            code: existing.code,
            type: existing.commissionType,
            value: existing.commissionType === "percent" ? String(existing.commissionValue / 100) : minorToMajorInput(existing.commissionValue),
            active: existing.status === "active",
            notes: existing.notes ?? "",
          }
        : EMPTY_FORM
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affiliate === null, existing?.id]);

  function patch(change: Partial<typeof EMPTY_FORM>, field?: FieldKey) {
    setForm((prev) => ({ ...prev, ...change }));
    setError(null);
    if (field) setProblems((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  const code = codeTouched ? form.code : suggestCode(form.name, form.phone);
  // An Arabic keyboard types ٠–٩: the rate is read in either set of digits.
  const typedValue = toAsciiDigits(form.value);
  const commissionValue = form.type === "percent" ? Math.round(Number(typedValue) * 100) : majorToMinor(typedValue);
  const rateValid = typedValue !== "" && Number.isFinite(commissionValue) && commissionValue > 0 && (form.type !== "percent" || commissionValue <= 10000);
  const exampleAmount = form.type === "percent" ? Math.round((EXAMPLE_BASE * commissionValue) / 10000) : commissionValue;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const found: Partial<Record<FieldKey, string>> = {};
    if (form.name.trim().length < 2) found.name = t.nameError;
    if (form.phone.trim().length === 0) found.phone = t.phoneError;
    if (!rateValid) found.value = form.type === "percent" ? t.percentError : t.fixedError;
    if (code.length < 2) found.code = t.codeError;
    setProblems(found);
    if (Object.keys(found).length > 0) {
      setError(t.fixFields);
      window.requestAnimationFrame(() => focusFirstInvalid(document.getElementById(formId)));
      return;
    }

    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      code,
      commissionType: form.type,
      commissionValue,
      status: form.active ? ("active" as const) : ("paused" as const),
      notes: form.notes.trim() || null,
    };
    try {
      const saved = existing ? await affiliatesUpdate(apiClient, workspaceId, existing.id, payload) : await affiliatesCreate(apiClient, workspaceId, payload);
      toast.success(t.saved);
      onSaved(saved, existing === null);
    } catch (err) {
      const errorCode = err instanceof ApiError ? err.code : undefined;
      // What the server refuses about one field is said under that field.
      const onField: Partial<Record<FieldKey, string>> | null =
        errorCode === "AFFILIATE_CODE_TAKEN"
          ? { code: t.codeTaken }
          : errorCode === "AFFILIATE_PHONE_TAKEN"
            ? { phone: t.phoneTaken }
            : errorCode === "INVALID_PHONE"
              ? { phone: t.invalidPhone }
              : null;
      if (onField) {
        setProblems(onField);
        setError(t.fixFields);
        window.requestAnimationFrame(() => focusFirstInvalid(document.getElementById(formId)));
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={affiliate !== null}
      onClose={onClose}
      title={editingShown ? t.editTitle : t.createTitle}
      footer={
        <>
          <Button type="button" variant="outline" className={PILL} disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className={PILL} disabled={busy}>
            {busy ? t.saving : editingShown ? t.save : t.saveNew}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-5">
        {error && <Alert variant="danger">{error}</Alert>}

        <div role="group" aria-labelledby={`${formId}-who`} className="space-y-3">
          <h3 id={`${formId}-who`} className="text-[13px] leading-5 font-semibold text-ink-soft">
            {t.sectionWho}
          </h3>
          <TextField
            label={t.name}
            required
            autoComplete="off"
            value={form.name}
            disabled={busy}
            onChange={(e) => patch({ name: e.target.value }, "name")}
            maxLength={200}
            error={problems.name}
            className={FIELD}
          />
          <TextField
            label={t.phone}
            hint={t.phoneHint}
            required
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="off"
            value={form.phone}
            disabled={busy}
            onChange={(e) => patch({ phone: e.target.value }, "phone")}
            maxLength={32}
            error={problems.phone}
            className={FIELD}
          />
        </div>

        <div role="group" aria-labelledby={`${formId}-rate`} className="space-y-3 border-t border-line pt-4">
          <h3 id={`${formId}-rate`} className="text-[13px] leading-5 font-semibold text-ink-soft">
            {t.sectionRate}
          </h3>
          <div className="space-y-1.5">
            <Segmented
              label={t.type}
              value={form.type}
              onChange={(next) => patch({ type: next }, "value")}
              options={[
                { value: "percent", label: t.type_percent, icon: IconPercent },
                { value: "fixed", label: t.type_fixed, icon: IconCoins },
              ]}
            />
            <p className="text-xs text-ink-soft">{t[`typeHint_${form.type}`]}</p>
          </div>
          <TextField
            label={form.type === "percent" ? t.percentValue : fmt(t.fixedValue, { currency })}
            hint={rateValid ? fmt(t.example, { base: formatMoney(EXAMPLE_BASE, currency), amount: formatMoney(exampleAmount, currency) }) : undefined}
            required
            inputMode="decimal"
            dir="ltr"
            autoComplete="off"
            value={form.value}
            disabled={busy}
            onChange={(e) => patch({ value: e.target.value }, "value")}
            error={problems.value}
            className={FIELD}
          />
        </div>

        <div role="group" aria-labelledby={`${formId}-link`} className="space-y-3 border-t border-line pt-4">
          <h3 id={`${formId}-link`} className="text-[13px] leading-5 font-semibold text-ink-soft">
            {t.sectionLink}
          </h3>
          <TextField
            label={t.code}
            hint={t.codeHint}
            required
            dir="ltr"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={code}
            disabled={busy}
            onChange={(e) => {
              setCodeTouched(true);
              patch({ code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") }, "code");
            }}
            maxLength={40}
            error={problems.code}
            className={FIELD}
          />
          {code.length >= 2 && (
            <p data-slot="affiliate-link-preview" className="rounded-2xl bg-paper-sunken px-4 py-3 text-xs leading-5 text-ink-soft">
              {t.linkPreview}
              <bdi dir="ltr" className="mt-0.5 block text-start text-[13px] font-medium break-all text-ink">
                {storeBase}?ref={code}
              </bdi>
            </p>
          )}
        </div>

        <div className="space-y-3 border-t border-line pt-4">
          <TextField
            label={t.notes}
            hint={t.notesHint}
            dir="auto"
            autoComplete="off"
            value={form.notes}
            disabled={busy}
            onChange={(e) => patch({ notes: e.target.value })}
            maxLength={500}
            className={FIELD}
          />
          {editingShown && (
            <div>
              <InlineSwitch checked={form.active} onChange={(next) => patch({ active: next })} label={t.activeLabel} disabled={busy} />
              <p className="text-xs text-ink-soft">{t.activeHint}</p>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}

/** Step 2 of the flow: the affiliate's own link, the portal, and a ready WhatsApp message. */
export function AffiliateShareDialog({ affiliate, storeBase, onClose }: { affiliate: Affiliate | null; storeBase: string; onClose: () => void }) {
  const t = useT(AFFILIATE_STRINGS);
  // Keep the last affiliate on screen while the dialog closes.
  const [shown, setShown] = useState<Affiliate | null>(affiliate);
  useEffect(() => {
    if (affiliate) setShown(affiliate);
  }, [affiliate]);
  const link = shown ? `${storeBase}?ref=${shown.code}` : "";
  const portal = `${storeBase}/affiliate`;
  const message = shown ? fmt(t.whatsappMessage, { name: shown.name, link, portal }) : "";

  return (
    <Modal
      open={affiliate !== null}
      onClose={onClose}
      title={shown ? fmt(t.shareTitle, { name: shown.name }) : ""}
      description={t.shareDescription}
      footer={
        shown ? (
          <>
            <Button type="button" variant="outline" className={PILL} onClick={onClose}>
              {t.done}
            </Button>
            <Button asChild className={`${PILL} gap-2`}>
              <a href={`https://wa.me/${shown.phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
                <IconWhatsApp className="size-4" weight="fill" aria-hidden />
                {t.whatsapp}
              </a>
            </Button>
          </>
        ) : undefined
      }
    >
      {shown && (
        <div className="space-y-3">
          <ShareRow label={t.theirLink} hint={t.theirLinkHint} value={link} copyLabel={t.copyLink} />
          <ShareRow label={t.portalLink} hint={fmt(t.portalLinkHint, { phone: `+${shown.phone}` })} value={portal} copyLabel={t.copyLink} />
        </div>
      )}
    </Modal>
  );
}

/** A link with what it is for and a button that copies it. Also used by the affiliate's preview. */
export function ShareRow({ label, hint, value, copyLabel }: { label: string; hint: string; value: string; copyLabel: string }) {
  return (
    <div data-slot="affiliate-share" className="rounded-2xl bg-paper-sunken px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-[1_1_10rem]">
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="text-xs leading-5 text-ink-soft">
            <bdi>{hint}</bdi>
          </p>
        </div>
        <CopyButton value={value} label={copyLabel} className="min-h-11 pointer-fine:min-h-9" />
      </div>
      <p dir="ltr" className="mt-2 text-start text-[13px] leading-5 break-all text-ink">
        {value}
      </p>
    </div>
  );
}

/** Step 4 of the flow: the money was sent, now it is recorded with how it was paid. */
export function AffiliatePayDialog({
  affiliate,
  currency,
  onClose,
  onPaid,
}: {
  affiliate: Affiliate | null;
  currency: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const t = useT(AFFILIATE_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [method, setMethod] = useState<PayoutMethod | "">("");
  const [note, setNote] = useState("");
  // Keep the last affiliate in the title while the dialog closes.
  const [shown, setShown] = useState<Affiliate | null>(affiliate);

  useEffect(() => {
    if (affiliate) {
      setShown(affiliate);
      setMethod("");
      setNote("");
    }
  }, [affiliate]);

  async function confirm() {
    if (!affiliate) return;
    try {
      const payout = await affiliatesRecordPayout(apiClient, workspaceId, affiliate.id, {
        method: method || undefined,
        note: note.trim() || undefined,
      });
      toast.success(fmt(t.paidToast, { amount: formatMoney(payout.amount, payout.currency) }));
    } catch (err) {
      throw new Error(err instanceof ApiError && err.code === "NOTHING_TO_PAY" ? t.nothingToPay : errorMessage(err));
    }
    onPaid();
  }

  return (
    <ConfirmDialog
      open={affiliate !== null}
      title={shown ? fmt(t.payTitle, { name: shown.name, amount: formatMoney(shown.totals?.approved ?? 0, currency) }) : ""}
      description={t.payDescription}
      confirmLabel={t.payConfirm}
      busyLabel={t.paying}
      cancelLabel={t.cancel}
      onCancel={onClose}
      onConfirm={confirm}
    >
      <div className="space-y-3">
        <Field label={t.payMethod}>
          {(props) => (
            <Select {...props} value={method} onChange={(e) => setMethod(e.target.value as PayoutMethod | "")} className="h-11 text-base md:text-sm">
              <option value="">{t.method_none}</option>
              {PAYOUT_METHODS.map((key) => (
                <option key={key} value={key}>
                  {t[`method_${key}`]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <TextField label={t.payNote} hint={t.payNoteHint} dir="auto" autoComplete="off" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={FIELD} />
      </div>
    </ConfirmDialog>
  );
}
