import { useEffect, useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import {
  ApiError,
  affiliatesCreate,
  affiliatesRecordPayout,
  affiliatesUpdate,
  type Affiliate,
  type AffiliateCommissionType,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { useT, fmt, useCommon } from "@/i18n/LocaleContext";
import { Field, TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
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

/** Add or edit an affiliate. A new one is handed back so the page can open "send link" next. */
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
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const existing = affiliate && affiliate !== "new" ? affiliate : null;
  const [form, setForm] = useState(EMPTY_FORM);
  // Until the merchant types a code of their own, it follows the name and phone.
  const [codeTouched, setCodeTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (affiliate === null) return;
    setError(null);
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

  const code = codeTouched ? form.code : suggestCode(form.name, form.phone);
  const commissionValue = form.type === "percent" ? Math.round(Number(form.value) * 100) : majorToMinor(form.value);
  const rateValid = Number.isFinite(commissionValue) && commissionValue > 0 && (form.type !== "percent" || commissionValue <= 10000);
  const valid = form.name.trim().length >= 2 && form.phone.trim().length > 0 && code.length >= 2 && rateValid;
  const exampleAmount = form.type === "percent" ? Math.round((EXAMPLE_BASE * commissionValue) / 10000) : commissionValue;

  async function submit(e: FormEvent) {
    e.preventDefault();
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
      setError(
        errorCode === "AFFILIATE_CODE_TAKEN"
          ? t.codeTaken
          : errorCode === "AFFILIATE_PHONE_TAKEN"
            ? t.phoneTaken
            : errorCode === "INVALID_PHONE"
              ? t.invalidPhone
              : errorMessage(err)
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={affiliate !== null} onClose={onClose} title={existing ? t.editTitle : t.createTitle}>
      <form onSubmit={submit} className="space-y-5">
        {error && <Alert variant="danger">{error}</Alert>}

        <div role="group" aria-labelledby="affiliate-who" className="space-y-3">
          <h3 id="affiliate-who" className="text-xs font-semibold text-ink-soft">
            {t.sectionWho}
          </h3>
          <TextField label={t.name} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} />
          <TextField
            label={t.phone}
            hint={t.phoneHint}
            required
            type="tel"
            inputMode="tel"
            dir="ltr"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            maxLength={32}
          />
        </div>

        <div role="group" aria-labelledby="affiliate-rate" className="space-y-3 border-t border-line pt-4">
          <h3 id="affiliate-rate" className="text-xs font-semibold text-ink-soft">
            {t.sectionRate}
          </h3>
          <Field label={t.type}>
            {(props) => (
              <Select {...props} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AffiliateCommissionType })}>
                <option value="percent">{t.type_percent}</option>
                <option value="fixed">{t.type_fixed}</option>
              </Select>
            )}
          </Field>
          <TextField
            label={form.type === "percent" ? t.percentValue : fmt(t.fixedValue, { currency })}
            hint={rateValid ? fmt(t.example, { base: formatMoney(EXAMPLE_BASE, currency), amount: formatMoney(exampleAmount, currency) }) : undefined}
            required
            inputMode="decimal"
            dir="ltr"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
          />
        </div>

        <div role="group" aria-labelledby="affiliate-link" className="space-y-3 border-t border-line pt-4">
          <h3 id="affiliate-link" className="text-xs font-semibold text-ink-soft">
            {t.sectionLink}
          </h3>
          <TextField
            label={t.code}
            hint={t.codeHint}
            required
            dir="ltr"
            value={code}
            onChange={(e) => {
              setCodeTouched(true);
              setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") });
            }}
            maxLength={40}
          />
          {code.length >= 2 && (
            <p className="text-xs text-ink-soft">
              {t.linkPreview}:{" "}
              <bdi dir="ltr" className="break-all font-medium text-ink">
                {storeBase}?ref={code}
              </bdi>
            </p>
          )}
        </div>

        <div className="space-y-3 border-t border-line pt-4">
          <TextField label={t.notes} hint={t.notesHint} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} />
          {existing && (
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" className="mt-1" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              <span>
                {t.active}
                <span className="block text-xs text-ink-soft">{t.activeHint}</span>
              </span>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            {common.cancel}
          </Button>
          <Button type="submit" disabled={busy || !valid}>
            {busy ? common.saving : common.save}
          </Button>
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
    <Modal open={affiliate !== null} onClose={onClose} title={shown ? fmt(t.shareTitle, { name: shown.name }) : ""} description={t.shareDescription}>
      {shown && (
        <div className="space-y-4">
          <ShareRow label={t.theirLink} hint={t.theirLinkHint} value={link} copyLabel={t.copyLink} />
          <ShareRow label={t.portalLink} hint={fmt(t.portalLinkHint, { phone: `+${shown.phone}` })} value={portal} copyLabel={t.copyLink} />
          <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4">
            <Button variant="outline" onClick={onClose}>
              {t.done}
            </Button>
            <Button asChild>
              <a href={`https://wa.me/${shown.phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" aria-hidden />
                {t.whatsapp}
              </a>
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ShareRow({ label, hint, value, copyLabel }: { label: string; hint: string; value: string; copyLabel: string }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="text-xs text-ink-soft">{hint}</p>
        </div>
        <CopyButton value={value} label={copyLabel} />
      </div>
      <p dir="ltr" className="mt-2 break-all text-start text-xs text-ink-soft">
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

  useEffect(() => {
    if (affiliate) {
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
      title={affiliate ? fmt(t.payTitle, { name: affiliate.name, amount: formatMoney(affiliate.totals?.approved ?? 0, currency) }) : ""}
      description={t.payDescription}
      confirmLabel={t.payConfirm}
      busyLabel={t.paying}
      onCancel={onClose}
      onConfirm={confirm}
    >
      <div className="space-y-3">
        <Field label={t.payMethod}>
          {(props) => (
            <Select {...props} value={method} onChange={(e) => setMethod(e.target.value as PayoutMethod | "")}>
              <option value="">{t.method_none}</option>
              {PAYOUT_METHODS.map((key) => (
                <option key={key} value={key}>
                  {t[`method_${key}`]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <TextField label={t.payNote} hint={t.payNoteHint} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      </div>
    </ConfirmDialog>
  );
}
