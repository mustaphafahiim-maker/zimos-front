import { useMemo, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  shippingProfileCreate,
  shippingProfileDelete,
  shippingProfileGet,
  shippingProfileSetProducts,
  shippingProfileUpdate,
  shippingProfilesList,
  type ShippingGovernorate,
  type ShippingProfile,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { MoneyInput } from "@/components/MoneyInput";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Shipping groups",
    description:
      "Products that cost more (or less) to send, with prices of their own — a sofa next to T-shirts. An order pays the highest price among its products; products in no group use the prices above.",
    add: "New group",
    empty: "No shipping groups. Every product uses the store's prices.",
    products: "{count} products",
    anywhere: "{price} anywhere",
    noFlat: "Only in the listed governorates",
    governorates: "+ {count} governorate prices",
    edit: "Edit",
    remove: "Delete",
    removeTitle: "Delete “{name}”?",
    removeBody: "Its products go back to the store's shipping prices.",
    cancel: "Cancel",
    working: "Working…",
    formTitle: "Shipping group",
    name: "Name",
    namePlaceholder: "Heavy items",
    flat: "Price anywhere",
    flatHint: "Leave blank to price only the governorates below.",
    perGov: "Price per governorate",
    perGovHint: "Blank = the price anywhere.",
    pick: "Products in this group",
    pickHint: "A product is in one group at most; ticking it here moves it.",
    save: "Save",
    saving: "Saving…",
    saved: "Shipping group saved.",
    deleted: "Shipping group deleted.",
  },
  ar: {
    title: "مجموعات الشحن",
    description:
      "منتجات تكلفة شحنها مختلفة ولها أسعار خاصة — كنبة جنب التيشيرتات. الطلب يدفع أعلى سعر بين منتجاته، والمنتجات اللي مش في مجموعة تستخدم الأسعار اللي فوق.",
    add: "مجموعة جديدة",
    empty: "لا توجد مجموعات شحن. كل المنتجات تستخدم أسعار المتجر.",
    products: "{count} منتج",
    anywhere: "{price} لأي مكان",
    noFlat: "في المحافظات المحددة فقط",
    governorates: "+ أسعار {count} محافظة",
    edit: "تعديل",
    remove: "حذف",
    removeTitle: "حذف «{name}»؟",
    removeBody: "منتجاتها ترجع لأسعار الشحن الخاصة بالمتجر.",
    cancel: "إلغاء",
    working: "جارٍ التنفيذ…",
    formTitle: "مجموعة شحن",
    name: "الاسم",
    namePlaceholder: "منتجات ثقيلة",
    flat: "السعر لأي مكان",
    flatHint: "اتركه فارغًا لتسعير المحافظات بالأسفل فقط.",
    perGov: "السعر حسب المحافظة",
    perGovHint: "فارغ = السعر لأي مكان.",
    pick: "منتجات المجموعة",
    pickHint: "المنتج في مجموعة واحدة فقط؛ تحديده هنا ينقله إليها.",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ مجموعة الشحن.",
    deleted: "تم حذف مجموعة الشحن.",
  },
} satisfies Messages;

/** SPEC §12.1 shipping groups: prices for specific products, under the store's own. */
export function ShippingProfilesSection({ currency = "EGP" }: { currency?: string }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => shippingProfilesList(apiClient, workspaceId), [workspaceId]);
  const governorates = useAsync(
    () => apiClient.getShippingSettings(workspaceId).then((s) => s.governorates).catch(() => [] as ShippingGovernorate[]),
    [workspaceId]
  );
  const [editing, setEditing] = useState<ShippingProfile | "new" | null>(null);
  const [removing, setRemoving] = useState<ShippingProfile | null>(null);

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
          <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
        </div>
        <Button className="min-h-11" onClick={() => setEditing("new")}>
          {t.add}
        </Button>
      </div>
      <div className="mt-4">
        <DataState
          loading={list.loading && !list.data}
          error={list.error}
          onRetry={() => void list.refresh()}
          empty={list.data?.length === 0}
          emptyMessage={t.empty}
        >
          <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line">
            {(list.data ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-ink-soft">
                    {fmt(t.products, { count: p.productCount })} ·{" "}
                    {p.flatAmount !== null ? fmt(t.anywhere, { price: formatMoney(p.flatAmount, currency) }) : t.noFlat}
                    {Object.keys(p.governorateAmounts).length > 0 &&
                      ` ${fmt(t.governorates, { count: Object.keys(p.governorateAmounts).length })}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="min-h-11" onClick={() => setEditing(p)}>
                    {t.edit}
                  </Button>
                  <Button size="sm" variant="ghost" className="min-h-11 text-danger" onClick={() => setRemoving(p)}>
                    {t.remove}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </DataState>
      </div>

      {editing && (
        <ProfileDialog
          profile={editing === "new" ? null : editing}
          governorates={governorates.data ?? []}
          currency={currency}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.success(t.saved);
            void list.refresh({ silent: true });
          }}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        title={fmt(t.removeTitle, { name: removing?.name ?? "" })}
        description={t.removeBody}
        confirmLabel={t.remove}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await shippingProfileDelete(apiClient, workspaceId, removing.id);
            toast.success(t.deleted);
            void list.refresh({ silent: true });
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setRemoving(null);
          }
        }}
      />
    </section>
  );
}

function ProfileDialog({
  profile,
  governorates,
  currency,
  onClose,
  onSaved,
}: {
  profile: ShippingProfile | null;
  governorates: ShippingGovernorate[];
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState(profile?.name ?? "");
  const [flat, setFlat] = useState(minorToMajorInput(profile?.flatAmount ?? null));
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(profile?.governorateAmounts ?? {}).map(([code, v]) => [code, minorToMajorInput(v)]))
  );
  const [picked, setPicked] = useState<Set<string> | null>(profile ? null : new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const products = useAsync(() => apiClient.listProducts(workspaceId, { status: ["active", "draft"], limit: 200 }), [workspaceId]);
  // The group's current products, once, to start the ticks from.
  useAsync(async () => {
    if (!profile) return null;
    const res = await shippingProfileGet(apiClient, workspaceId, profile.id);
    setPicked((current) => current ?? new Set(res.products.map((p) => p.id)));
    return res;
  }, [workspaceId, profile?.id]);

  const items = useMemo(() => products.data?.products ?? [], [products.data]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const governorateAmounts = Object.fromEntries(
        Object.entries(rates)
          .filter(([, v]) => v.trim() !== "")
          .map(([code, v]) => [code, majorToMinor(v)])
      );
      const input = { name: name.trim(), flatAmount: flat.trim() === "" ? null : majorToMinor(flat), governorateAmounts };
      const saved = profile
        ? await shippingProfileUpdate(apiClient, workspaceId, profile.id, input)
        : await shippingProfileCreate(apiClient, workspaceId, input);
      if (picked) await shippingProfileSetProducts(apiClient, workspaceId, saved.id, [...picked]);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={busy ? () => undefined : onClose} title={t.formTitle} className="max-w-3xl">
      <form onSubmit={save} className="space-y-5">
        <TextField label={t.name} placeholder={t.namePlaceholder} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        <MoneyInput label={t.flat} hint={t.flatHint} currency={currency} value={flat} onChange={setFlat} placeholder="—" />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">{t.perGov}</legend>
          <p className="text-xs text-ink-soft">{t.perGovHint}</p>
          <div className="grid max-h-64 gap-x-4 gap-y-3 overflow-y-auto pe-1 sm:grid-cols-2 lg:grid-cols-3">
            {governorates.map((g) => (
              <MoneyInput
                key={g.code}
                label={locale === "ar" ? g.ar : g.en}
                currency={currency}
                value={rates[g.code] ?? ""}
                onChange={(value) => setRates((prev) => ({ ...prev, [g.code]: value }))}
                placeholder={flat.trim() || "—"}
              />
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">{t.pick}</legend>
          <p className="text-xs text-ink-soft">{t.pickHint}</p>
          <div className="grid max-h-56 gap-x-4 gap-y-1 overflow-y-auto rounded-lg border border-line p-3 sm:grid-cols-2">
            {items.map((p) => (
              <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  disabled={picked === null}
                  checked={Boolean(picked?.has(p.id))}
                  onChange={(e) =>
                    setPicked((prev) => {
                      const next = new Set(prev ?? []);
                      if (e.target.checked) next.add(p.id);
                      else next.delete(p.id);
                      return next;
                    })
                  }
                />
                <span className="min-w-0 truncate">{p.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" className="min-h-11" disabled={busy || !name.trim()}>
            {busy ? t.saving : t.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
