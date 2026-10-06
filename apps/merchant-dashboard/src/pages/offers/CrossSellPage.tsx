import { useState } from "react";
import { Shuffle } from "lucide-react";
import { Alert, Button, Label } from "@store-builder/ui";
import {
  CROSS_SELL_PLACEMENTS,
  offersDeleteCrossSell,
  offersListCrossSell,
  offersSaveCrossSell,
  type CrossSellPlacement,
  type CrossSellRule,
  type Product,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { ProductChecklist, RuleCard, useStoreProducts } from "./OfferRuleParts";
import { OfferNumbers, useOfferStats } from "./OfferNumbers";

/**
 * Cross-sell rules (SPEC §10.2): "with these products, suggest those". With no
 * rule that fits, the store suggests what real orders show was bought
 * together — so the screen works empty, and a rule only overrides it.
 */

const STRINGS = {
  en: {
    back: "Offers",
    title: "Cross-sell",
    description:
      "Suggest products that go with what the customer is buying. Without a rule, your store suggests what past orders show was bought together.",
    newRule: "New rule",
    emptyTitle: "No cross-sell rules yet",
    emptyHint: "Your store already suggests what customers bought together. Add a rule to choose the suggestions yourself.",
    place_cart: "In the cart",
    place_checkout: "At checkout",
    place_thank_you: "On the thank-you page",
    when: "With: {names}",
    whenAny: "With any product",
    suggests: "Suggests: {names}",
    more: "+{count} more",
    createTitle: "New cross-sell rule",
    editTitle: "Edit cross-sell rule",
    name: "Rule name",
    namePlaceholder: "Accessories with phones",
    triggers: "When the cart has any of",
    triggersHint: "Leave empty to suggest with every cart.",
    suggestions: "Suggest these products",
    placement: "Where",
    maxItems: "How many to show",
    nameRequired: "Give the rule a name.",
    suggestionsRequired: "Choose at least one product to suggest.",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    saved: "Saved.",
    deleted: "Deleted.",
    deleteConfirm: "Delete “{name}”?",
  },
  ar: {
    back: "العروض",
    title: "منتجات مقترحة",
    description: "اقترح منتجات تناسب ما يشتريه العميل. بدون قاعدة، متجرك يقترح ما اشتراه العملاء معًا في الأوردرات السابقة.",
    newRule: "قاعدة جديدة",
    emptyTitle: "مفيش قواعد لسه",
    emptyHint: "متجرك يقترح بالفعل ما اشتراه العملاء معًا. أضف قاعدة لتختار الاقتراحات بنفسك.",
    place_cart: "في السلة",
    place_checkout: "عند إتمام الطلب",
    place_thank_you: "في صفحة الشكر",
    when: "مع: {names}",
    whenAny: "مع أي منتج",
    suggests: "يقترح: {names}",
    more: "+{count} أخرى",
    createTitle: "قاعدة اقتراح جديدة",
    editTitle: "تعديل قاعدة الاقتراح",
    name: "اسم القاعدة",
    namePlaceholder: "إكسسوارات مع الموبايلات",
    triggers: "عندما تحتوي السلة على أي من",
    triggersHint: "اتركها فارغة للاقتراح مع كل سلة.",
    suggestions: "اقترح هذه المنتجات",
    placement: "المكان",
    maxItems: "عدد المنتجات المعروضة",
    nameRequired: "اكتب اسمًا للقاعدة.",
    suggestionsRequired: "اختار منتجًا واحدًا على الأقل للاقتراح.",
    cancel: "إلغاء",
    save: "حفظ",
    saving: "بنحفظ…",
    saved: "اتحفظ.",
    deleted: "اتمسح.",
    deleteConfirm: "حذف «{name}»؟",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

function names(ids: string[], products: Product[], t: Strings): string {
  const found = ids.map((id) => products.find((p) => p.id === id)?.name).filter(Boolean) as string[];
  const shown = found.slice(0, 3).join("، ");
  return found.length > 3 ? `${shown} ${fmt(t.more, { count: found.length - 3 })}` : shown;
}

export function CrossSellPage() {
  // Each offer's views, acceptances and added revenue (SPEC §10.11).
  const stats = useOfferStats();
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => offersListCrossSell(apiClient, workspaceId), [workspaceId]);
  const products = useStoreProducts();
  const [editing, setEditing] = useState<CrossSellRule | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rules = list.data ?? [];
  const all = products.data ?? [];

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
      {t.newRule}
    </Button>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader title={t.title} description={t.description} back={{ to: "/offers", label: t.back }} actions={newButton} />
      <DataState loading={list.loading} error={list.error} onRetry={() => list.refresh()}>
        {rules.length === 0 ? (
          <EmptyState icon={<Shuffle />} title={t.emptyTitle} description={t.emptyHint} action={newButton} />
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const { id, ...payload } = rule;
              return (
                <RuleCard
                  key={id}
                  title={rule.name}
                  subtitle={t[`place_${rule.placement}`]}
                  isActive={rule.isActive}
                  busy={busyId === id}
                  onEdit={() => setEditing(rule)}
                  onToggle={() =>
                    void act(id, () => offersSaveCrossSell(apiClient, workspaceId, id, { ...payload, isActive: !rule.isActive }), t.saved)
                  }
                  onDelete={() => {
                    if (window.confirm(fmt(t.deleteConfirm, { name: rule.name }))) {
                      void act(id, () => offersDeleteCrossSell(apiClient, workspaceId, id), t.deleted);
                    }
                  }}
                >
                  <p className="text-sm text-ink-soft">
                    {rule.triggerProductIds.length > 0 ? fmt(t.when, { names: names(rule.triggerProductIds, all, t) }) : t.whenAny}
                  </p>
                  <p className="text-sm text-ink">{fmt(t.suggests, { names: names(rule.offerProductIds, all, t) })}</p>
                  <OfferNumbers stat={stats?.crossSell[id]} />
                </RuleCard>
              );
            })}
          </div>
        )}
      </DataState>

      {editing && (
        <CrossSellDialog
          rule={editing === "new" ? null : editing}
          products={all}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void list.refresh({ silent: true });
          }}
        />
      )}
    </div>
  );
}

function CrossSellDialog({
  rule,
  products,
  onClose,
  onSaved,
}: {
  rule: CrossSellRule | null;
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState(rule?.name ?? "");
  const [triggers, setTriggers] = useState<string[]>(rule?.triggerProductIds ?? []);
  const [suggestions, setSuggestions] = useState<string[]>(rule?.offerProductIds ?? []);
  const [placement, setPlacement] = useState<CrossSellPlacement>(rule?.placement ?? "cart");
  const [maxItems, setMaxItems] = useState(String(rule?.maxItems ?? 4));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return setError(t.nameRequired);
    if (suggestions.length === 0) return setError(t.suggestionsRequired);
    setBusy(true);
    setError(null);
    try {
      await offersSaveCrossSell(apiClient, workspaceId, rule?.id ?? null, {
        name: name.trim(),
        triggerProductIds: triggers,
        triggerCollectionIds: rule?.triggerCollectionIds ?? [],
        offerProductIds: suggestions,
        placement,
        maxItems: Math.min(8, Math.max(1, Number.parseInt(maxItems, 10) || 4)),
        isActive: rule?.isActive ?? true,
      });
      toast.success(t.saved);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
    return undefined;
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={rule ? t.editTitle : t.createTitle}
      className="max-w-2xl"
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
        <TextField
          label={t.name}
          required
          maxLength={120}
          placeholder={t.namePlaceholder}
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cross-placement">{t.placement}</Label>
            <Select id="cross-placement" value={placement} disabled={busy} onChange={(e) => setPlacement(e.target.value as CrossSellPlacement)}>
              {CROSS_SELL_PLACEMENTS.map((p) => (
                <option key={p} value={p}>
                  {t[`place_${p}`]}
                </option>
              ))}
            </Select>
          </div>
          <TextField
            label={t.maxItems}
            type="number"
            inputMode="numeric"
            min={1}
            max={8}
            value={maxItems}
            disabled={busy}
            onChange={(e) => setMaxItems(e.target.value)}
          />
        </div>
        <ProductChecklist label={t.triggers} hint={t.triggersHint} products={products} value={triggers} onChange={setTriggers} disabled={busy} max={100} />
        <ProductChecklist label={t.suggestions} products={products} value={suggestions} onChange={setSuggestions} disabled={busy} max={20} />
        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
