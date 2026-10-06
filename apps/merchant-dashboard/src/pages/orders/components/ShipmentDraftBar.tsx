import { useState } from "react";
import { Button } from "@store-builder/ui";
import {
  ordersDiscardShipmentDraft,
  ordersSaveShipmentDraft,
  shipmentDraftOf,
  type Order,
  type ShipmentDraftInput,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    save: "Save as draft",
    saving: "Saving…",
    saved: "Draft saved. Nothing was sent to the courier.",
    savedAt: "Draft saved {date}",
    savedAtBy: "Draft saved {date} by {name}",
    discard: "Discard draft",
    discarded: "Draft discarded.",
  },
  ar: {
    save: "حفظ كمسودة",
    saving: "بنحفظ…",
    saved: "اتحفظت المسودة. مفيش حاجة اتبعتت لشركة الشحن.",
    savedAt: "مسودة محفوظة {date}",
    savedAtBy: "مسودة محفوظة {date} بواسطة {name}",
    discard: "مسح المسودة",
    discarded: "اتمسحت المسودة.",
  },
} satisfies Messages;

/**
 * "Save as draft" for the shipment form (SPEC §4.4): keeps what the form
 * holds on the order without booking — allowed before the order can be
 * booked (not confirmed yet). Shows when a draft was saved and discards it.
 */
export function ShipmentDraftSaveButton({
  order,
  draft,
  disabled,
  onSaved,
}: {
  order: Order;
  /** What the form holds now, as a draft; null while there is nothing worth saving. */
  draft: () => ShipmentDraftInput | null;
  disabled?: boolean;
  onSaved: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);

  async function save() {
    const body = draft();
    if (!body) return;
    setBusy(true);
    try {
      await ordersSaveShipmentDraft(apiClient, workspaceId, order.id, body);
      toast.success(t.saved);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" className="min-h-11" disabled={disabled || busy} onClick={save}>
      {busy ? t.saving : t.save}
    </Button>
  );
}

/** "Draft saved … · Discard draft" above the form, while the order has one. */
export function ShipmentDraftNote({ order, onDiscarded }: { order: Order; onDiscarded: () => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const saved = shipmentDraftOf(order);
  if (!saved) return null;

  async function discard() {
    setBusy(true);
    try {
      await ordersDiscardShipmentDraft(apiClient, workspaceId, order.id);
      toast.success(t.discarded);
      onDiscarded();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const date = formatDateTime(saved.savedAt);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line bg-paper px-3 py-1 text-sm" role="status">
      <span className="text-ink-soft">
        {saved.savedBy?.name ? fmt(t.savedAtBy, { date, name: saved.savedBy.name }) : fmt(t.savedAt, { date })}
      </span>
      <Button type="button" variant="ghost" size="sm" className="min-h-11 text-danger" disabled={busy} onClick={discard}>
        {t.discard}
      </Button>
    </div>
  );
}
