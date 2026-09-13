import { useState } from "react";
import { Button, Card, CardContent } from "@store-builder/ui";
import type { Offer, Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, formatOptions } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { OfferForm } from "./OfferForm";

const STRINGS = {
  en: {
    title: "Offers",
    subtitle: "Priced bundles of one or more variants.",
    createOffer: "Create offer",
    editOffer: "Edit offer",
    empty: "No offers yet.",
    computedPrice: "Computed price",
    defaultBadge: "Default",
    variantFallback: "Variant {id}",
    lineItem: "{qty}× {name}",
    listSep: ", ",
    archivedToast: "Offer archived.",
    createdToast: "Offer created.",
    savedToast: "Offer saved.",
    confirmTitle: "Delete \"{name}\"?",
    confirmDescription: "It's archived, not removed, so any order placed through this offer keeps its record.",
    confirmLabel: "Archive offer",
  },
  ar: {
    title: "العروض",
    subtitle: "باقات مسعّرة من متغيّر واحد أو أكثر.",
    createOffer: "إنشاء عرض",
    editOffer: "تعديل العرض",
    empty: "لا توجد عروض بعد.",
    computedPrice: "سعر محسوب",
    defaultBadge: "افتراضي",
    variantFallback: "متغيّر {id}",
    lineItem: "{qty}× {name}",
    listSep: "، ",
    archivedToast: "تمت أرشفة العرض.",
    createdToast: "تم إنشاء العرض.",
    savedToast: "تم حفظ العرض.",
    confirmTitle: "حذف \"{name}\"؟",
    confirmDescription: "سيتم أرشفة العرض لا حذفه نهائيًا، لذلك تحتفظ الطلبات التي تمت من خلاله بسجلها.",
    confirmLabel: "أرشفة العرض",
  },
} satisfies Messages;

interface Props {
  productId: string;
  offers: Offer[];
  variants: Variant[];
  onChanged: () => void;
}

export function OffersSection({ productId, offers, variants, onChanged }: Props) {
  const t = useT(STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [deleting, setDeleting] = useState<Offer | null>(null);

  const variantName = (id: string) => {
    const v = variants.find((x) => x.id === id);
    if (!v) return fmt(t.variantFallback, { id: id.slice(0, 8) });
    return formatOptions(v.optionValues) || v.sku || fmt(t.variantFallback, { id: v.id.slice(0, 8) });
  };

  async function confirmDelete() {
    if (!deleting) return;
    await apiClient.deleteOffer(workspaceId, deleting.id);
    toast.success(t.archivedToast);
    setDeleting(null);
    onChanged();
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="pt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">{t.title}</h2>
            <p className="text-sm text-ink-soft">{t.subtitle}</p>
          </div>
          <Button size="sm" onClick={() => setAdding(true)}>
            {t.createOffer}
          </Button>
        </div>

        {offers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
            {t.empty}
          </p>
        ) : (
          <ul className="space-y-2">
            {offers.map((offer) => (
              <li
                key={offer.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{offer.name}</span>
                    {offer.isDefault && (
                      <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                        {t.defaultBadge}
                      </span>
                    )}
                    <StatusBadge value={offer.status} />
                  </div>
                  <div className="mt-1 text-sm text-ink-soft">
                    {offer.pricingMode === "fixed" ? (
                      <bdi dir="ltr">{formatMoney(offer.priceAmount, offer.currency)}</bdi>
                    ) : (
                      t.computedPrice
                    )}
                    {" · "}
                    {offer.lines
                      .map((l) => fmt(t.lineItem, { qty: l.quantity, name: variantName(l.variantId) }))
                      .join(t.listSep)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(offer)}>
                    {c.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger-soft"
                    onClick={() => setDeleting(offer)}
                  >
                    {c.delete}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Modal open={adding} onClose={() => setAdding(false)} title={t.createOffer}>
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

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={t.editOffer}>
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
        title={fmt(t.confirmTitle, { name: deleting?.name ?? "" })}
        description={t.confirmDescription}
        confirmLabel={t.confirmLabel}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
