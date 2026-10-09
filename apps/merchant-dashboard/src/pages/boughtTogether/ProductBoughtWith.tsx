import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  boughtTogetherForProduct,
  boughtTogetherGet,
  boughtTogetherSave,
  offersListCrossSell,
  type BoughtTogetherState,
  type BoughtWithProduct,
  type CrossSellRule,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { canManageProducts, canViewProducts } from "@/lib/productAccess";
import { pluralOf } from "@/lib/plural";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ProductPageCard } from "@/pages/catalog/components/ProductPageCard";
import { BOUGHT_TOGETHER_STRINGS } from "./boughtTogetherStrings";

/** What the toast says after the switch saved; it carries «تراجع» (the same save, the other way). */
const TOAST_STRINGS = {
  en: { hidden: "“{name}” won't be suggested any more.", shown: "“{name}” is suggested again." },
  ar: { hidden: "«{name}» مش هيتقترح تاني.", shown: "«{name}» رجع يتقترح." },
} satisfies Messages;

interface Loaded {
  products: BoughtWithProduct[];
  settings: BoughtTogetherState;
  /** The merchant's own rules for this product's page: their pins. */
  pins: CrossSellRule[];
}

/**
 * The product page's «بيتشري مع» (handoff 223): what real orders show this
 * product is bought with, each with its order count and a «متقترحوش» switch
 * (the store-wide "don't suggest" list), and the way to pin products instead —
 * a cross-sell rule for the product page, which wins over this list.
 *
 * Nothing is drawn for a product nobody bought with another yet and that has
 * no pin, while it loads, or when it can't be read.
 */
export function ProductBoughtWith({ productId }: { productId: string }) {
  const t = useT(BOUGHT_TOGETHER_STRINGS);
  const said = useT(TOAST_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const canView = canViewProducts(currentWorkspace?.role);
  const canManage = canManageProducts(currentWorkspace?.role);
  const toast = useToast();
  // The box that was just ticked, shown as ticked while the save is on its way (and put back if it fails).
  const [saving, setSaving] = useState<{ productId: string; excluded: boolean } | null>(null);

  const loaded = useAsync<Loaded | null>(async () => {
    if (!canView) return null;
    try {
      const [products, settings, rules] = await Promise.all([
        boughtTogetherForProduct(apiClient, workspaceId, productId),
        boughtTogetherGet(apiClient, workspaceId),
        offersListCrossSell(apiClient, workspaceId).catch(() => [] as CrossSellRule[]),
      ]);
      return { products, settings, pins: rules.filter((r) => r.placement === "product" && r.isActive && r.triggerProductIds.includes(productId)) };
    } catch {
      // An extra on a page that works without it.
      return null;
    }
  }, [workspaceId, productId, canView]);

  const data = loaded.data;
  // «تراجع» is pressed seconds later, from a toast that outlives this render: it saves over the list as it is then.
  const latest = useRef<{ data: Loaded | null; setData: (next: Loaded | null) => void }>({ data: data ?? null, setData: loaded.setData });
  useEffect(() => {
    latest.current = { data: data ?? null, setData: loaded.setData };
  });
  if (!data || (data.products.length === 0 && data.pins.length === 0)) return null;

  /** Adds the product to, or takes it off, the store's "don't suggest" list. */
  async function toggle(row: BoughtWithProduct, excluded: boolean, undoing = false) {
    const data = latest.current.data;
    if (!data || saving) return;
    const { settings } = data;
    const ids = excluded ? [...new Set([...settings.excludedProductIds, row.productId])] : settings.excludedProductIds.filter((id) => id !== row.productId);
    setSaving({ productId: row.productId, excluded });
    try {
      const next = await boughtTogetherSave(apiClient, workspaceId, {
        enabled: settings.enabled,
        windowDays: settings.windowDays,
        minOrders: settings.minOrders,
        excludedProductIds: ids,
      });
      latest.current.setData({
        ...data,
        settings: { ...settings, ...next },
        products: data.products.map((p) => (p.productId === row.productId ? { ...p, excluded } : p)),
      });
      // Saved at once, so the answer is a toast; Undo is the same save with the box the other way.
      if (!undoing) toast.undo(fmt(excluded ? said.hidden : said.shown, { name: row.name }), () => toggle(row, !excluded, true));
    } catch (err) {
      // A failed undo rejects: the toast then says the change is still in place.
      if (undoing) throw err;
      toast.error(t.toggleFailed);
    } finally {
      setSaving(null);
    }
  }

  return (
    <ProductPageCard title={t.productTitle} description={t.productHint}>
      {!data.settings.enabled && <p className="mb-3 rounded-[var(--radius)] bg-paper-sunken px-3 py-2 text-sm text-ink-soft">{t.switchedOff}</p>}

      {data.products.length > 0 && (
        <ul className="divide-y divide-line rounded-[var(--radius)] ring-1 ring-line">
          {data.products.map((row) => (
            <li key={row.productId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 basis-40">
                <Link to={`/catalog/${row.productId}`} className="font-medium text-ink hover:text-primary hover:underline">
                  <bdi>{row.name}</bdi>
                </Link>
                <span className="block text-xs text-ink-soft">{pluralOf(t, "inOrders", row.orders)}</span>
              </span>
              {canManage ? (
                <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 text-sm text-ink has-[:disabled]:cursor-default">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-default"
                    checked={saving?.productId === row.productId ? saving.excluded : row.excluded}
                    disabled={saving !== null}
                    aria-label={fmt(t.dontSuggestName, { name: row.name })}
                    onChange={(e) => void toggle(row, e.target.checked)}
                  />
                  {t.dontSuggest}
                </label>
              ) : (
                row.excluded && <StatusBadge value="excluded" tone="neutral" text={t.notSuggested} />
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 space-y-1">
        {data.pins.map((rule) => (
          <p key={rule.id} className="flex flex-wrap items-center gap-x-3 text-sm text-ink">
            <span>
              <bdi>{fmt(t.pinned, { rule: rule.name })}</bdi>
            </span>
            <Link to="/offers/cross-sell" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline md:min-h-0">
              {t.pinnedManage}
            </Link>
          </p>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          {canManage && data.pins.length === 0 ? (
            <p className="text-sm text-ink-soft">
              <Link to={`/offers/cross-sell?pin=${productId}`} className="inline-flex min-h-11 items-center font-medium text-primary hover:underline md:min-h-0">
                {t.pin}
              </Link>
              <span className="ms-2 text-xs">{t.pinHint}</span>
            </p>
          ) : (
            <span />
          )}
          <Link to="/offers/cross-sell" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline md:min-h-0">
            {t.settingsLink}
          </Link>
        </div>
      </div>
    </ProductPageCard>
  );
}
