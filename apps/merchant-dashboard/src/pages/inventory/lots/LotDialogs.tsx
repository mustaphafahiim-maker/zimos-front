import { useEffect, useId, useState, type FormEvent } from "react";
import { IconWarning } from "@/components/icons";
import { Alert, AlertTitle, Button, Input } from "@store-builder/ui";
import {
  STOCK_LOT_CODE_MAX,
  STOCK_LOT_NOTE_MAX,
  STOCK_LOT_REASON_MAX,
  isApiErrorCode,
  stockLotSaveAlertDays,
  stockLotUnitsLeft,
  stockLotUpdate,
  stockLotWriteOff,
  type StockLot,
  type StockLotPatch,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { parseWholeNumber } from "@/lib/wholeNumber";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { num } from "../inventoryText";
import { useLast } from "../useLast";
import { LotExpiry } from "./LotParts";
import { LOT_STRINGS } from "./lotStrings";
import { LOT_DATE_INPUT } from "./lotText";

/**
 * «تعديل» / Edit lot (PATCH /stock-lots/:id): the code, the expiry date and
 * the note. Only what changed is sent — a new date makes the lot due for its
 * expiry warning again, so an untouched date is left out.
 */
export function EditLotDialog({
  lot,
  onClose,
  onSaved,
}: {
  /** The lot being edited; null closes the dialog. */
  lot: StockLot | null;
  onClose: () => void;
  onSaved: (saved: StockLot) => void;
}) {
  const t = useT(LOT_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const shown = useLast(lot);
  const [lotCode, setLotCode] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [note, setNote] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lot) return;
    setLotCode(lot.lotCode);
    setExpiresOn(lot.expiresOn ?? "");
    setNote(lot.note ?? "");
    setCodeError(null);
    setFailure(null);
  }, [lot]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !shown) return;
    const code = lotCode.trim();
    if (!code) {
      setCodeError(t.lotCodeError);
      return;
    }
    const patch: StockLotPatch = {};
    if (code !== shown.lotCode) patch.lotCode = code;
    if ((expiresOn || null) !== shown.expiresOn) patch.expiresOn = expiresOn || null;
    if ((note.trim() || null) !== (shown.note ?? null)) patch.note = note.trim() || null;
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      onSaved(await stockLotUpdate(apiClient, workspaceId, shown.id, patch));
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={lot !== null}
      onClose={saving ? () => {} : onClose}
      title={t.editTitle}
      description={t.editDescription}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={saving}>
            {saving ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <TextField
          label={t.lotCode}
          required
          dir="auto"
          autoComplete="off"
          maxLength={STOCK_LOT_CODE_MAX}
          value={lotCode}
          disabled={saving}
          onChange={(e) => {
            setLotCode(e.target.value);
            setCodeError(null);
          }}
          error={codeError ?? undefined}
          className="[&_input]:h-11"
        />
        <Field label={t.expiresOn} hint={t.expiresHint}>
          {(props) => (
            <input {...props} type="date" value={expiresOn} disabled={saving} onChange={(e) => setExpiresOn(e.target.value)} className={LOT_DATE_INPUT} />
          )}
        </Field>
        <TextField
          label={t.note}
          dir="auto"
          autoComplete="off"
          maxLength={STOCK_LOT_NOTE_MAX}
          value={note}
          disabled={saving}
          onChange={(e) => setNote(e.target.value)}
          className="[&_input]:h-11"
        />
        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}

/**
 * «إعدام / شطب» / Write off (POST /stock-lots/:id/write-off): expired or
 * damaged units leave stock — all that is left in the lot unless a smaller
 * quantity is typed — with an optional reason that names the stock movement.
 * The dialog is the confirmation: it says the units leave stock before the
 * button that does it.
 */
export function WriteOffLotDialog({
  lot,
  alertDays,
  onClose,
  onDone,
  onStale,
}: {
  /** The lot to write off; null closes the dialog. */
  lot: StockLot | null;
  alertDays: number;
  onClose: () => void;
  onDone: (next: StockLot, writtenOff: number) => void;
  /** The lot holds fewer units than the dialog showed (422 LOT_NOT_ENOUGH). */
  onStale: () => void;
}) {
  const t = useT(LOT_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const shown = useLast(lot);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Each opening starts with everything that is left.
  useEffect(() => {
    if (!lot) return;
    setQuantity(String(lot.quantityRemaining));
    setReason("");
    setQuantityError(null);
    setFailure(null);
  }, [lot]);

  const left = shown?.quantityRemaining ?? 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !shown) return;
    const count = parseWholeNumber(quantity, 1, left);
    if (count === null || Number.isNaN(count)) {
      setQuantityError(fmt(t.writeOffQuantityError, { n: left }));
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      const answer = await stockLotWriteOff(apiClient, workspaceId, shown.id, { quantity: count, reason: reason.trim() || null });
      onDone(answer.lot, answer.writtenOff);
    } catch (err) {
      if (isApiErrorCode(err, "LOT_NOT_ENOUGH")) {
        // Orders or another write-off took units meanwhile.
        const now = stockLotUnitsLeft(err);
        setQuantityError(now === null ? t.lotChanged : fmt(t.lotNotEnough, { n: now }));
        onStale();
      } else {
        setFailure(errorMessage(err, { INSUFFICIENT_STOCK: t.stockShort }));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={lot !== null}
      onClose={saving ? () => {} : onClose}
      title={t.writeOffTitle}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} variant="danger" className="rounded-full px-5" disabled={saving}>
            {saving ? t.writingOff : t.writeOffSubmit}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        {shown && (
          <div className="rounded-[var(--radius)] bg-paper-sunken px-3 py-2">
            <p className="text-sm font-medium text-ink">
              <bdi>{shown.productName ?? t.unknownProduct}</bdi>
              {" · "}
              <bdi>{shown.lotCode}</bdi>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
              <span>
                {t.remaining}: <span className="font-semibold tabular-nums text-ink">{num(left)}</span>
              </span>
              <LotExpiry lot={shown} alertDays={alertDays} />
            </p>
          </div>
        )}

        <Alert>
          <IconWarning aria-hidden />
          <AlertTitle>{t.writeOffConfirm}</AlertTitle>
        </Alert>

        <Field label={t.writeOffQuantity} required error={quantityError ?? undefined}>
          {(props) => (
            <Input
              {...props}
              inputMode="numeric"
              dir="ltr"
              autoComplete="off"
              maxLength={7}
              value={quantity}
              disabled={saving}
              onChange={(e) => {
                setQuantity(e.target.value);
                setQuantityError(null);
              }}
              className="h-11 w-28 text-center tabular-nums"
            />
          )}
        </Field>

        <TextField
          label={t.reason}
          dir="auto"
          autoComplete="off"
          maxLength={STOCK_LOT_REASON_MAX}
          placeholder={t.reasonPlaceholder}
          value={reason}
          disabled={saving}
          onChange={(e) => setReason(e.target.value)}
          className="[&_input]:h-11"
        />

        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}

/**
 * «تنبيه الصلاحية» / Expiry warning (PUT /stock-lots/settings): how many days
 * before a lot's date the team is told — the sentence «نبّهني قبل الانتهاء بـ
 * … يوم» with its number field in the gap.
 */
export function LotAlertDialog({
  open,
  alertDays,
  onClose,
  onSaved,
}: {
  open: boolean;
  alertDays: number;
  onClose: () => void;
  onSaved: (alertDays: number) => void;
}) {
  const t = useT(LOT_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const fieldId = useId();
  const hintId = useId();
  const [days, setDays] = useState(String(alertDays));
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDays(String(alertDays));
    setError(null);
    setFailure(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const value = parseWholeNumber(days, 1, 365);
    if (value === null || Number.isNaN(value)) {
      setError(t.alertError);
      document.getElementById(fieldId)?.focus();
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      onSaved(await stockLotSaveAlertDays(apiClient, workspaceId, value));
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const [before, after = ""] = t.alertSentence.split("{n}");

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={t.alertTitle}
      description={t.alertDescription}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={saving}>
            {saving ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor={fieldId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-ink">
            <span>{before.trim()}</span>
            <Input
              id={fieldId}
              inputMode="numeric"
              dir="ltr"
              autoComplete="off"
              maxLength={3}
              value={days}
              disabled={saving}
              aria-invalid={error ? true : undefined}
              aria-describedby={hintId}
              onChange={(e) => {
                setDays(e.target.value);
                setError(null);
              }}
              className="h-11 w-20 text-center tabular-nums"
            />
            {after.trim() && <span>{after.trim()}</span>}
          </label>
          <p id={hintId} className={error ? "mt-1 text-xs font-medium text-danger" : "mt-1 text-xs text-ink-soft"}>
            {error ?? t.alertRange}
          </p>
        </div>
        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
