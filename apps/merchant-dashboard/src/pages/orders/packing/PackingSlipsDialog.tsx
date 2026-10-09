import { useId, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  ORDER_PACKING_NOTE_MAX,
  orderPackingNothingToPrint,
  orderPackingSlipsPdf,
  type OrderPackingSlipSize,
} from "@store-builder/api-client";
import { Field } from "@/components/Field";
import { IconPrint, IconSpinner } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { Segmented } from "@/components/Segmented";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { pluralOf } from "@/lib/plural";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useOrderErrorMessage } from "../orderErrors";
import { readPackingSlipPrefs, savePackingSlipPrefs } from "./packingStorage";
import { PACKING_STRINGS } from "./packingStrings";

/** Opens a PDF the API sent in a new tab, as the waybill and invoice buttons do. */
export function openPdf(pdf: Blob) {
  const url = URL.createObjectURL(pdf);
  window.open(url, "_blank", "noopener");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Packing slips for the given orders (handoff 244, 294): the paper size and an
 * optional note for the bottom of every slip — the last note and size are kept
 * on this browser. Cancelled orders get no slip: the count left out is said in
 * a toast, and a selection of only cancelled orders says so here.
 *
 * A sheet: it rises from the bottom on a phone, with «اطبع» pinned under the
 * two fields.
 */
export function PackingSlipsDialog({
  open,
  orderIds,
  onClose,
  single = false,
}: {
  open: boolean;
  orderIds: string[];
  onClose: () => void;
  /** One order, from its own page: the title says "Print packing slip". */
  single?: boolean;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(PACKING_STRINGS);
  const toast = useToast();
  const errorMessage = useOrderErrorMessage();
  const formId = useId();
  const [size, setSize] = useState<OrderPackingSlipSize>("A5");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedFor, setOpenedFor] = useState(false);

  // Each opening starts from what this browser printed with last time.
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      const prefs = readPackingSlipPrefs();
      setSize(prefs.size);
      setNote(prefs.note);
      setBusy(false);
      setError(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const text = note.trim().slice(0, ORDER_PACKING_NOTE_MAX);
    savePackingSlipPrefs({ note: text, size });
    try {
      const { pdf, skipped } = await orderPackingSlipsPdf(apiClient, workspaceId, orderIds, { size, note: text });
      openPdf(pdf);
      if (skipped.length > 0) toast.error(pluralOf(t, "skipped", skipped.length));
      onClose();
    } catch (err) {
      setError(orderPackingNothingToPrint(err) ? t.allCancelled : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={single ? t.printPackingSlip : t.packingSlips}
      description={t.slipsDescription}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="gap-2 rounded-full px-5" disabled={busy} aria-busy={busy || undefined}>
            {busy ? (
              <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" weight="bold" aria-hidden />
            ) : (
              <IconPrint className="size-4" weight="bold" aria-hidden />
            )}
            {busy ? t.preparing : t.print}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-5" noValidate>
        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">{t.size}</p>
          {/* Two choices: a switch whose thumb slides, not a menu to open. */}
          <Segmented
            value={size}
            onChange={setSize}
            label={t.size}
            options={[
              { value: "A5", label: t.sizeA5 },
              { value: "A4", label: t.sizeA4 },
            ]}
            className="w-full"
          />
        </div>
        <Field label={t.note} hint={t.noteHint}>
          {({ id }) => (
            <Textarea
              id={id}
              value={note}
              rows={3}
              dir="auto"
              maxLength={ORDER_PACKING_NOTE_MAX}
              placeholder={t.notePlaceholder}
              className="text-base md:text-sm"
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
