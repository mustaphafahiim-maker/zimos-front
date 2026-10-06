import { useState } from "react";
import { PackagePlus } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import {
  offersDeleteBump,
  offersListBumps,
  offersListUpsells,
  offersDeleteUpsell,
  offersSaveBump,
  offersSaveUpsell,
  type OrderBumpRule,
  type UpsellRule,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { OfferPicker } from "@/components/OfferPicker";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { ProductSelect, RuleCard, useStoreProducts } from "./OfferRuleParts";
import { OfferNumbers, useOfferStats } from "./OfferNumbers";

/**
 * Two screens with one shape (SPEC §10.3, §10.4): an order bump is an offer
 * ticked on a product's order form; a post-purchase upsell is an offer added
 * with one tap on the thank-you page. Each rule is "on this product (or
 * all) → sell this offer", with a headline and a description.
 */

const STRINGS = {
  en: {
    back: "Offers",
    bumpsTitle: "Order bumps",
    bumpsDescription: "A tick box above the order button: “add this to your order”. Up to three on a product.",
    upsellsTitle: "Post-purchase upsell",
    upsellsDescription:
      "One offer on the thank-you page, added to the same cash-on-delivery order with one tap — before anyone confirms it.",
    newBump: "New order bump",
    newUpsell: "New upsell",
    emptyBumps: "No order bumps yet",
    emptyBumpsHint: "Offer a small add-on right where the customer orders — a charger, a second colour, a gift box.",
    emptyUpsells: "No upsells yet",
    emptyUpsellsHint: "Right after the order, offer one more thing that goes with it.",
    onProduct: "On: {name}",
    onAll: "On every product",
    afterProduct: "After an order of: {name}",
    afterAll: "After any order",
    sells: "{offer} — {price}",
    offerGone: "Offer unavailable",
    preChecked: "Ticked by default",
    createBump: "New order bump",
    editBump: "Edit order bump",
    createUpsell: "New upsell",
    editUpsell: "Edit upsell",
    bumpProduct: "Show on",
    bumpProductHint: "Leave on “Every product” to offer it everywhere.",
    upsellProduct: "Show after an order of",
    upsellAny: "Any product",
    offer: "The offer to sell",
    offerHint: "An offer with a set price, created on a product's page. Its price is what the customer pays.",
    headline: "Headline",
    bumpHeadlinePlaceholder: "Add a charger for only 99",
    upsellHeadlinePlaceholder: "Add this before we ship your order",
    details: "Description",
    preCheckedLabel: "Ticked by default",
    preCheckedHint: "The customer can still untick it. Use with care: an add-on nobody asked for raises refusals at the door.",
    offerRequired: "Choose the offer to sell.",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    saved: "Saved.",
    deleted: "Deleted.",
    deleteConfirm: "Delete this rule?",
  },
  ar: {
    back: "العروض",
    bumpsTitle: "إضافات الطلب",
    bumpsDescription: "مربع اختيار فوق زر الطلب: «أضف هذا إلى طلبك». حتى ثلاثة على المنتج.",
    upsellsTitle: "عرض بعد الشراء",
    upsellsDescription: "عرض واحد في صفحة الشكر، يُضاف لنفس أوردر الدفع عند الاستلام بضغطة — قبل أن يؤكده أحد.",
    newBump: "إضافة طلب جديدة",
    newUpsell: "عرض جديد",
    emptyBumps: "مفيش إضافات طلب لسه",
    emptyBumpsHint: "اعرض إضافة صغيرة في مكان الطلب نفسه — شاحن، لون ثانٍ، علبة هدية.",
    emptyUpsells: "مفيش عروض بعد الشراء",
    emptyUpsellsHint: "بعد الأوردر مباشرة، اعرض شيئًا آخر يناسبه.",
    onProduct: "على: {name}",
    onAll: "على كل المنتجات",
    afterProduct: "بعد أوردر فيه: {name}",
    afterAll: "بعد أي أوردر",
    sells: "{offer} — {price}",
    offerGone: "العرض غير متاح",
    preChecked: "محدد افتراضيًا",
    createBump: "إضافة طلب جديدة",
    editBump: "تعديل إضافة الطلب",
    createUpsell: "عرض جديد",
    editUpsell: "تعديل العرض",
    bumpProduct: "يظهر على",
    bumpProductHint: "اتركه على «كل المنتجات» ليظهر في كل مكان.",
    upsellProduct: "يظهر بعد أوردر فيه",
    upsellAny: "أي منتج",
    offer: "العرض الذي يُباع",
    offerHint: "عرض بسعر محدد، يُنشأ من صفحة المنتج. سعره هو ما يدفعه العميل.",
    headline: "العنوان",
    bumpHeadlinePlaceholder: "أضف شاحنًا بـ 99 فقط",
    upsellHeadlinePlaceholder: "أضف هذا قبل شحن طلبك",
    details: "الوصف",
    preCheckedLabel: "محدد افتراضيًا",
    preCheckedHint: "العميل يقدر يلغي التحديد. استخدمه بحذر: إضافة لم يطلبها أحد تزيد الرفض عند الاستلام.",
    offerRequired: "اختار العرض الذي يُباع.",
    cancel: "إلغاء",
    save: "حفظ",
    saving: "بنحفظ…",
    saved: "اتحفظ.",
    deleted: "اتمسح.",
    deleteConfirm: "حذف هذه القاعدة؟",
  },
} satisfies Messages;

type Kind = "bump" | "upsell";

/** The two rule types read through one shape. */
interface Row {
  id: string;
  productId: string | null;
  offerId: string;
  headline: string | null;
  description: string | null;
  preChecked: boolean;
  position: number;
  isActive: boolean;
  offer: OrderBumpRule["offer"];
  product: OrderBumpRule["product"];
}

const fromBump = (r: OrderBumpRule): Row => ({ ...r });
const fromUpsell = (r: UpsellRule): Row => ({ ...r, productId: r.triggerProductId, preChecked: false });

function useRules(kind: Kind) {
  const workspaceId = useWorkspaceId();
  const list = useAsync(
    () =>
      kind === "bump"
        ? offersListBumps(apiClient, workspaceId).then((rows) => rows.map(fromBump))
        : offersListUpsells(apiClient, workspaceId).then((rows) => rows.map(fromUpsell)),
    [workspaceId, kind]
  );
  const save = (id: string | null, row: Omit<Row, "id" | "offer" | "product">) => {
    const common = { offerId: row.offerId, headline: row.headline, description: row.description, position: row.position, isActive: row.isActive };
    return kind === "bump"
      ? offersSaveBump(apiClient, workspaceId, id, { ...common, productId: row.productId, preChecked: row.preChecked })
      : offersSaveUpsell(apiClient, workspaceId, id, { ...common, triggerProductId: row.productId });
  };
  const remove = (id: string) =>
    kind === "bump" ? offersDeleteBump(apiClient, workspaceId, id) : offersDeleteUpsell(apiClient, workspaceId, id);
  return { list, save, remove };
}

function OfferRulesPage({ kind }: { kind: Kind }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { list, save, remove } = useRules(kind);
  // Each rule's views, acceptances and added revenue (SPEC §10.11).
  const stats = useOfferStats();
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rows = list.data ?? [];
  const isBump = kind === "bump";

  async function act(id: string, run: () => Promise<unknown>, done: string) {
    setBusyId(id);
    try {
      await run();
      toast.success(done);
      await list.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const newButton = (
    <Button type="button" onClick={() => setEditing("new")}>
      {isBump ? t.newBump : t.newUpsell}
    </Button>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={isBump ? t.bumpsTitle : t.upsellsTitle}
        description={isBump ? t.bumpsDescription : t.upsellsDescription}
        back={{ to: "/offers", label: t.back }}
        actions={newButton}
      />
      <DataState loading={list.loading} error={list.error} onRetry={() => list.refresh()}>
        {rows.length === 0 ? (
          <EmptyState
            icon={<PackagePlus />}
            title={isBump ? t.emptyBumps : t.emptyUpsells}
            description={isBump ? t.emptyBumpsHint : t.emptyUpsellsHint}
            action={newButton}
          />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <RuleCard
                key={row.id}
                title={row.headline || row.offer?.name || t.offerGone}
                subtitle={
                  row.product
                    ? fmt(isBump ? t.onProduct : t.afterProduct, { name: row.product.name })
                    : isBump
                      ? t.onAll
                      : t.afterAll
                }
                isActive={row.isActive}
                warning={row.offer?.usable ? undefined : t.offerGone}
                busy={busyId === row.id}
                onEdit={() => setEditing(row)}
                onToggle={() => void act(row.id, () => save(row.id, { ...row, isActive: !row.isActive }), t.saved)}
                onDelete={() => {
                  if (window.confirm(t.deleteConfirm)) void act(row.id, () => remove(row.id), t.deleted);
                }}
              >
                {row.offer && (
                  <p className="text-sm text-ink">
                    {fmt(t.sells, {
                      offer: row.offer.productName ? `${row.offer.productName} · ${row.offer.name}` : row.offer.name,
                      price: formatMoney(row.offer.priceAmount, row.offer.currency),
                    })}
                    {row.preChecked && <span className="ms-2 text-xs text-ink-soft">· {t.preChecked}</span>}
                  </p>
                )}
                <OfferNumbers stat={(isBump ? stats?.bumps : stats?.upsells)?.[row.id]} />
              </RuleCard>
            ))}
          </div>
        )}
      </DataState>

      {editing && (
        <RuleDialog
          kind={kind}
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          save={save}
          onSaved={() => {
            setEditing(null);
            void list.refresh({ silent: true });
          }}
        />
      )}
    </div>
  );
}

function RuleDialog({
  kind,
  row,
  onClose,
  save,
  onSaved,
}: {
  kind: Kind;
  row: Row | null;
  onClose: () => void;
  save: (id: string | null, row: Omit<Row, "id" | "offer" | "product">) => Promise<unknown>;
  onSaved: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const products = useStoreProducts();
  const isBump = kind === "bump";
  const [productId, setProductId] = useState<string | null>(row?.productId ?? null);
  const [offerId, setOfferId] = useState<string | null>(row?.offerId ?? null);
  const [headline, setHeadline] = useState(row?.headline ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [preChecked, setPreChecked] = useState(row?.preChecked ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!offerId) {
      setError(t.offerRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await save(row?.id ?? null, {
        productId,
        offerId,
        headline: headline.trim() || null,
        description: description.trim() || null,
        preChecked,
        position: row?.position ?? 0,
        isActive: row?.isActive ?? true,
      });
      toast.success(t.saved);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={isBump ? (row ? t.editBump : t.createBump) : row ? t.editUpsell : t.createUpsell}
      footer={
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ProductSelect
          id="rule-product"
          label={isBump ? t.bumpProduct : t.upsellProduct}
          hint={isBump ? t.bumpProductHint : undefined}
          anyLabel={isBump ? undefined : t.upsellAny}
          products={products.data ?? []}
          value={productId}
          onChange={setProductId}
          disabled={busy || products.loading}
        />
        <OfferPicker workspaceId={workspaceId} value={offerId} onChange={setOfferId} disabled={busy} label={t.offer} hint={t.offerHint} />
        <TextField
          label={t.headline}
          maxLength={120}
          placeholder={isBump ? t.bumpHeadlinePlaceholder : t.upsellHeadlinePlaceholder}
          value={headline}
          disabled={busy}
          onChange={(e) => setHeadline(e.target.value)}
        />
        <TextField label={t.details} maxLength={300} value={description} disabled={busy} onChange={(e) => setDescription(e.target.value)} />
        {isBump && (
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-primary"
              checked={preChecked}
              disabled={busy}
              onChange={(e) => setPreChecked(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-ink">{t.preCheckedLabel}</span>
              <span className="block text-xs text-ink-soft">{t.preCheckedHint}</span>
            </span>
          </label>
        )}
        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

export function OrderBumpsPage() {
  return <OfferRulesPage kind="bump" />;
}

export function UpsellsPage() {
  return <OfferRulesPage kind="upsell" />;
}
