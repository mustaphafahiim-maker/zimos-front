import { useState } from "react";
import { Button, Card, CardContent } from "@store-builder/ui";
import type { Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, formatOptions } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { VariantForm } from "./VariantForm";

const STRINGS = {
  en: {
    title: "Variants",
    subtitle: "Each buyable row — size / colour, its price and stock.",
    addVariant: "Add variant",
    editVariant: "Edit variant",
    empty: "No variants yet. Add at least one so the product can be sold.",
    colVariant: "Variant",
    colPrice: "Price",
    colStock: "Stock",
    reservedTitle: "Reserved",
    archivedToast: "Variant archived.",
    addedToast: "Variant added.",
    savedToast: "Variant saved.",
    confirmTitle: "Delete this variant?",
    confirmDescription:
      "It's archived, not removed, so order lines and inventory history that reference it stay intact.",
    confirmLabel: "Archive variant",
  },
  ar: {
    title: "المتغيّرات",
    subtitle: "كل خيار قابل للشراء — المقاس / اللون، وسعره ومخزونه.",
    addVariant: "إضافة متغيّر",
    editVariant: "تعديل المتغيّر",
    empty: "لا توجد متغيّرات بعد. أضف متغيّرًا واحدًا على الأقل ليصبح المنتج قابلًا للبيع.",
    colVariant: "المتغيّر",
    colPrice: "السعر",
    colStock: "المخزون",
    reservedTitle: "محجوز",
    archivedToast: "تمت أرشفة المتغيّر.",
    addedToast: "تمت إضافة المتغيّر.",
    savedToast: "تم حفظ المتغيّر.",
    confirmTitle: "حذف هذا المتغيّر؟",
    confirmDescription:
      "سيتم أرشفة المتغيّر لا حذفه نهائيًا، لذلك تبقى بنود الطلبات وسجل المخزون المرتبطة به كما هي.",
    confirmLabel: "أرشفة المتغيّر",
  },
} satisfies Messages;

interface Props {
  productId: string;
  variants: Variant[];
  onChanged: () => void;
}

export function VariantsSection({ productId, variants, onChanged }: Props) {
  const t = useT(STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Variant | null>(null);
  const [deleting, setDeleting] = useState<Variant | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    await apiClient.deleteVariant(workspaceId, deleting.id);
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
            {t.addVariant}
          </Button>
        </div>

        {variants.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
            {t.empty}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-3 py-2 text-start font-medium">{t.colVariant}</th>
                  <th className="px-3 py-2 text-start font-medium">SKU</th>
                  <th className="px-3 py-2 text-start font-medium">{t.colPrice}</th>
                  <th className="px-3 py-2 text-start font-medium">{t.colStock}</th>
                  <th className="px-3 py-2 text-start font-medium">{c.status}</th>
                  <th className="px-3 py-2 font-medium">
                    <span className="sr-only">{c.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-ink">
                      {formatOptions(v.optionValues) ? (
                        <bdi>{formatOptions(v.optionValues)}</bdi>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-ink-soft">
                      <bdi dir="ltr">{v.sku || "—"}</bdi>
                    </td>
                    <td className="px-3 py-2 text-ink-soft">
                      <bdi dir="ltr">{formatMoney(v.priceAmount, v.currency)}</bdi>
                    </td>
                    <td className="px-3 py-2 text-ink-soft">
                      <bdi dir="ltr">
                        {v.stockOnHand}
                        {v.reservedStock ? (
                          <span title={t.reservedTitle}>{` (−${v.reservedStock})`}</span>
                        ) : null}
                      </bdi>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge value={v.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>
                        {c.edit}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger hover:bg-danger-soft"
                        onClick={() => setDeleting(v)}
                      >
                        {c.delete}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Modal open={adding} onClose={() => setAdding(false)} title={t.addVariant}>
        <VariantForm
          productId={productId}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            toast.success(t.addedToast);
            onChanged();
          }}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={t.editVariant}>
        {editing && (
          <VariantForm
            productId={productId}
            variant={editing}
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
        title={t.confirmTitle}
        description={t.confirmDescription}
        confirmLabel={t.confirmLabel}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
