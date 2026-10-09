import { useState } from "react";
import { Button } from "@store-builder/ui";
import { IconEdit, IconDelete, IconPlus } from "@/components/icons";
import type { Offer, Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, variantLabel } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { useCatalogLabels } from "../catalogLabels";
import { OfferForm } from "./OfferForm";
import { ProductPageCard } from "./ProductPageCard";

const STRINGS = {
  en: {
    title: "Bundles",
    description: "Priced bundles of one or more variants: “2 for 400”, “buy 3, pay less”.",
    create: "Add a bundle",
    empty: "No bundles yet. A bundle sells several pieces at one price.",
    editName: "Edit “{name}”",
    deleteName: "Archive “{name}”",
    computedPrice: "Computed price",
    variantFallback: "Variant {id}",
    archivedWithProduct: "Archived with product",
    edit: "Edit",
    delete: "Delete",
    createTitle: "Create offer",
    editTitle: "Edit offer",
    deleteTitle: "Delete “{name}”?",
    deleteDescription: "It's archived, not removed, so any order placed through this offer keeps its record.",
    deleteConfirm: "Archive offer",
    working: "Archiving…",
    cancel: "Cancel",
    archivedToast: "Offer archived.",
    createdToast: "Offer created.",
    savedToast: "Offer saved.",
  },
  ar: {
    title: "الباقات",
    description: "باقات بسعر واحد من متغير أو أكتر: «قطعتين بـ٤٠٠»، «اشتري ٣ وادفع أقل».",
    create: "ضيف باقة",
    empty: "مفيش باقات لسه. الباقة بتبيع كذا قطعة بسعر واحد.",
    editName: "عدّل «{name}»",
    deleteName: "أرشف «{name}»",
    computedPrice: "سعر محسوب",
    variantFallback: "متغير {id}",
    archivedWithProduct: "مؤرشف مع المنتج",
    edit: "تعديل",
    delete: "حذف",
    createTitle: "إنشاء عرض",
    editTitle: "تعديل العرض",
    deleteTitle: "حذف «{name}»؟",
    deleteDescription: "تتم أرشفته وليس حذفه، لذلك يحتفظ أي أوردر تم من خلال هذا العرض بسجله.",
    deleteConfirm: "أرشفة العرض",
    working: "بنأرشف…",
    cancel: "إلغاء",
    archivedToast: "تمت أرشفة العرض.",
    createdToast: "تم إنشاء العرض.",
    savedToast: "تم حفظ العرض.",
  },
} satisfies Messages;

const rowButton =
  "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none";

interface Props {
  productId: string;
  offers: Offer[];
  variants: Variant[];
  onChanged: () => void;
}

export function OffersSection({ productId, offers, variants, onChanged }: Props) {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [deleting, setDeleting] = useState<Offer | null>(null);

  const variantName = (id: string) => {
    const v = variants.find((x) => x.id === id);
    return v ? variantLabel(v) : fmt(t.variantFallback, { id: id.slice(0, 8) });
  };

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await apiClient.deleteOffer(workspaceId, deleting.id);
    } catch (err) {
      throw new Error(errorMessage(err));
    }
    toast.success(t.archivedToast);
    setDeleting(null);
    onChanged();
  }

  return (
    <ProductPageCard
      title={t.title}
      description={t.description}
      actions={
        <Button type="button" variant="outline" className="min-h-11 md:min-h-9" onClick={() => setAdding(true)}>
          <IconPlus className="size-4" weight="bold" aria-hidden />
          {t.create}
        </Button>
      }
    >
      {offers.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">{t.empty}</p>
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius)] ring-1 ring-line">
          {offers.map((offer) => (
            <li key={offer.id} className="flex items-center gap-2 py-2 ps-3.5 pe-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <bdi className="min-w-0 truncate text-sm font-medium text-ink">{offer.name}</bdi>
                  {offer.isDefault && <StatusBadge value="default" tone="info" text={labels.defaultOffer} />}
                  <StatusBadge value={offer.status} text={offer.archivedWithProduct ? t.archivedWithProduct : labels.status(offer.status)} />
                </div>
                <p className="mt-0.5 text-[13px] leading-5 text-ink-soft">
                  <span className="font-medium whitespace-nowrap text-ink tabular-nums">
                    {offer.pricingMode === "fixed" ? formatMoney(offer.priceAmount, offer.currency) : t.computedPrice}
                  </span>
                  {" · "}
                  {offer.lines.map((l) => `${l.quantity}× ${variantName(l.variantId)}`).join(", ")}
                </p>
              </div>
              <button type="button" className={rowButton} aria-label={fmt(t.editName, { name: offer.name })} title={t.edit} onClick={() => setEditing(offer)}>
                <IconEdit className="size-[18px]" aria-hidden />
              </button>
              <button
                type="button"
                className={`${rowButton} hover:bg-danger-soft hover:text-danger`}
                aria-label={fmt(t.deleteName, { name: offer.name })}
                title={t.delete}
                onClick={() => setDeleting(offer)}
              >
                <IconDelete className="size-[18px]" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title={t.createTitle}>
        <OfferForm
          productId={productId}
          variants={variants}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            toast.success(t.createdToast);
            onChanged();
          }}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={t.editTitle}>
        {editing && (
          <OfferForm
            productId={productId}
            variants={variants}
            offer={editing}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null);
              toast.success(t.savedToast);
              onChanged();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={fmt(t.deleteTitle, { name: deleting?.name ?? "" })}
        description={t.deleteDescription}
        confirmLabel={t.deleteConfirm}
        busyLabel={t.working}
        cancelLabel={t.cancel}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </ProductPageCard>
  );
}
