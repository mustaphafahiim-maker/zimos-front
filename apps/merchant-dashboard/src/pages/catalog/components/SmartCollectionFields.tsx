import { useId, useState, type KeyboardEvent } from "react";
import { IconClose, IconFolder, IconRefresh, IconSparkle } from "@/components/icons";
import { Button, Input, cn } from "@store-builder/ui";
import {
  SMART_COLLECTION_MAX_TAGS,
  SMART_COLLECTION_TAG_MAX_LENGTH,
  smartCollectionRulesOf,
  smartCollectionsEnsureAllProducts,
  smartCollectionsKnownTags,
  smartCollectionsSync,
  type CollectionSummary,
  type SmartCollectionMatch,
  type SmartCollectionRules,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";

/*
 * Smart collections (frontend-handoff 162): the collection form's type
 * choice, the rule note and Refresh on a smart collection, the "Automatic"
 * badge, and the empty list's "All products" button. Rules travel on the
 * ordinary collection create / update calls (endpoints/smartCollections.ts).
 */

const STRINGS = {
  en: {
    type: "Collection type",
    manual: "Manual",
    manualHint: "You add the products yourself.",
    tags: "Automatic (by tags)",
    tagsHint: "Products carrying the tags you pick.",
    allProducts: "All products",
    allProductsHint: "Every product in your store.",
    fillsItself: "This collection fills itself from its rules.",
    tagsLabel: "Tags",
    tagPlaceholder: "Type a tag",
    addTag: "Add",
    removeTag: "Remove tag {tag}",
    suggestions: "Your products' tags",
    noTags: "Add at least one tag.",
    maxTags: "Enter or a comma adds it. Up to {n} tags.",
    match: "Products must match",
    matchAny: "any tag",
    matchAll: "all tags",
    badge: "Automatic",
    ruleNote: "Products tagged {tags} join this collection by themselves.",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    refreshed: "Collection refreshed: {added} added, {removed} removed.",
    createAll: "Create \"All products\" collection",
    creatingAll: "Creating…",
    allCreated: "\"All products\" is ready.",
    emptyHint: "Start with \"All products\": it holds every product in your store and fills itself.",
  },
  ar: {
    type: "نوع المجموعة",
    manual: "يدوي",
    manualHint: "إنت اللي بتضيف المنتجات بنفسك.",
    tags: "تلقائي (بالتاجز)",
    tagsHint: "المنتجات اللي عليها التاجز اللي تختارها.",
    allProducts: "كل المنتجات",
    allProductsHint: "كل منتجات متجرك.",
    fillsItself: "المجموعة دي بتتملى لوحدها من الشروط بتاعتها.",
    tagsLabel: "التاجز",
    tagPlaceholder: "اكتب تاج",
    addTag: "إضافة",
    removeTag: "شيل التاج {tag}",
    suggestions: "تاجز منتجاتك",
    noTags: "ضيف تاج واحد على الأقل.",
    maxTags: "دوس إنتر أو حط فاصلة عشان يتضاف. لحد {n} تاج.",
    match: "المنتجات لازم تطابق",
    matchAny: "أي تاج",
    matchAll: "كل التاجز",
    badge: "تلقائي",
    ruleNote: "المنتجات اللي عليها {tags} بتدخل المجموعة لوحدها.",
    refresh: "تحديث",
    refreshing: "بيحدّث…",
    refreshed: "المجموعة اتحدثت: {added} اتضافوا و{removed} اتشالوا.",
    createAll: "اعمل مجموعة \"كل المنتجات\"",
    creatingAll: "بيتعمل…",
    allCreated: "مجموعة \"كل المنتجات\" جاهزة.",
    emptyHint: "ابدأ بمجموعة \"كل المنتجات\": فيها كل منتجات متجرك وبتتملى لوحدها.",
  },
} satisfies Messages;

export type SmartCollectionKind = "manual" | "tags" | "all_products";

/** What the form edits; `match` and `tags` are kept while switching kinds, so nothing typed is lost. */
export interface SmartCollectionDraft {
  kind: SmartCollectionKind;
  match: SmartCollectionMatch;
  tags: string[];
}

export function smartDraftOf(collection: CollectionSummary | undefined): SmartCollectionDraft {
  const rules = smartCollectionRulesOf(collection);
  if (!rules) return { kind: "manual", match: "any", tags: [] };
  if (rules.type === "all_products") return { kind: "all_products", match: "any", tags: [] };
  return { kind: "tags", match: rules.match, tags: rules.tags };
}

/** The `rules` the API takes for this draft (null: a manual collection). */
export function smartRulesOf(draft: SmartCollectionDraft): SmartCollectionRules | null {
  if (draft.kind === "all_products") return { type: "all_products" };
  if (draft.kind === "tags") return { type: "tags", match: draft.match, tags: draft.tags };
  return null;
}

/** False while an automatic collection has no tag yet (the save button waits). */
export function smartDraftReady(draft: SmartCollectionDraft): boolean {
  return draft.kind !== "tags" || draft.tags.length > 0;
}

/** Whether the draft changes the collection's saved rules (unchanged rules are not sent, so nothing re-fills by accident). */
export function smartRulesChanged(collection: CollectionSummary | undefined, draft: SmartCollectionDraft): boolean {
  const before = smartCollectionRulesOf(collection);
  const after = smartRulesOf(draft);
  if (!before || !after) return before !== after;
  if (before.type !== after.type) return true;
  if (before.type === "tags" && after.type === "tags") {
    return (
      before.match !== after.match ||
      before.tags.length !== after.tags.length ||
      before.tags.some((tag, i) => tag.toLowerCase() !== after.tags[i].toLowerCase())
    );
  }
  return false;
}

/** The form's "Collection type" choice, with the tag rule under it. */
export function SmartCollectionFields({
  value,
  onChange,
  disabled,
  error,
}: {
  value: SmartCollectionDraft;
  onChange: (next: SmartCollectionDraft) => void;
  disabled?: boolean;
  error?: string;
}) {
  const t = useT(STRINGS);
  const name = useId();
  const kinds: Array<{ kind: SmartCollectionKind; label: string; hint: string }> = [
    { kind: "manual", label: t.manual, hint: t.manualHint },
    { kind: "tags", label: t.tags, hint: t.tagsHint },
    { kind: "all_products", label: t.allProducts, hint: t.allProductsHint },
  ];

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium text-ink">{t.type}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {kinds.map((option) => {
          const checked = value.kind === option.kind;
          return (
            <label
              key={option.kind}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-2.5 rounded-[var(--radius)] border p-3 transition-colors",
                checked ? "border-primary bg-primary-soft/60" : "border-line hover:border-line-strong"
              )}
            >
              <input
                type="radio"
                name={name}
                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
                checked={checked}
                onChange={() => onChange({ ...value, kind: option.kind })}
              />
              <span className="min-w-0">
                <span className={cn("block text-sm font-medium", checked ? "text-primary-dark" : "text-ink")}>{option.label}</span>
                <span className="block text-xs text-ink-soft">{option.hint}</span>
              </span>
            </label>
          );
        })}
      </div>

      {value.kind !== "manual" && (
        <p className="flex items-start gap-2 text-xs text-ink-soft">
          <IconSparkle className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          {t.fillsItself}
        </p>
      )}

      {value.kind === "tags" && <TagRule value={value} onChange={onChange} disabled={disabled} />}

      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </fieldset>
  );
}

/** The chips, the tag box with the store's tags as suggestions, and any / all. */
function TagRule({
  value,
  onChange,
  disabled,
}: {
  value: SmartCollectionDraft;
  onChange: (next: SmartCollectionDraft) => void;
  disabled?: boolean;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const inputId = useId();
  const hintId = useId();
  const matchName = useId();
  const [draft, setDraft] = useState("");
  const known = useAsync(() => smartCollectionsKnownTags(apiClient, workspaceId), [workspaceId]);

  const chosen = new Set(value.tags.map((tag) => tag.toLowerCase()));
  const full = value.tags.length >= SMART_COLLECTION_MAX_TAGS;
  const typed = draft.trim().toLowerCase();
  const suggestions = (known.data ?? [])
    .filter((tag) => !chosen.has(tag.toLowerCase()) && (!typed || tag.toLowerCase().includes(typed)))
    .slice(0, 12);

  function add(raw: string) {
    // A pasted "summer, sale" adds both.
    const next = [...value.tags];
    const seen = new Set(chosen);
    for (const part of raw.split(/[,،]/)) {
      const tag = part.trim().slice(0, SMART_COLLECTION_TAG_MAX_LENGTH);
      if (!tag || seen.has(tag.toLowerCase()) || next.length >= SMART_COLLECTION_MAX_TAGS) continue;
      seen.add(tag.toLowerCase());
      next.push(tag);
    }
    setDraft("");
    if (next.length !== value.tags.length) onChange({ ...value, tags: next });
  }

  function remove(tag: string) {
    onChange({ ...value, tags: value.tags.filter((t2) => t2 !== tag) });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Enter adds the tag instead of saving the form; a comma does the same.
    if (e.key === "Enter" || e.key === "," || e.key === "،") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.tags.length > 0) {
      remove(value.tags[value.tags.length - 1]);
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--radius)] bg-paper-sunken/60 p-3">
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {t.tagsLabel}
        </label>
        {value.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {value.tags.map((tag) => (
              <li
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft py-0.5 ps-2.5 pe-1 text-sm text-primary-dark dark:text-primary"
              >
                <bdi>{tag}</bdi>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => remove(tag)}
                  aria-label={fmt(t.removeTag, { tag })}
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-paper-raised focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <IconClose className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            id={inputId}
            value={draft}
            maxLength={SMART_COLLECTION_TAG_MAX_LENGTH}
            placeholder={t.tagPlaceholder}
            disabled={disabled || full}
            aria-describedby={hintId}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            // Typed but not added yet: kept when leaving the box, unless a suggestion was picked from the filter.
            onBlur={(e) => {
              if (draft.trim() && !(e.relatedTarget as HTMLElement | null)?.dataset.tagSuggestion) add(draft);
            }}
            className="h-11 bg-paper-raised"
          />
          <Button type="button" variant="outline" className="min-h-11" disabled={disabled || full || !draft.trim()} onClick={() => add(draft)}>
            {t.addTag}
          </Button>
        </div>
        <p id={hintId} className="text-xs text-ink-soft">
          {value.tags.length === 0 && `${t.noTags} `}
          {fmt(t.maxTags, { n: SMART_COLLECTION_MAX_TAGS })}
        </p>
        {suggestions.length > 0 && !full && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-soft">{t.suggestions}:</span>
            {suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                data-tag-suggestion="true"
                disabled={disabled}
                onClick={() => add(tag)}
                className="min-h-8 cursor-pointer rounded-full border border-line bg-paper-raised px-2.5 text-xs text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
              >
                + <bdi>{tag}</bdi>
              </button>
            ))}
          </div>
        )}
      </div>

      <div role="radiogroup" aria-label={t.match} className="space-y-1.5">
        <p className="text-sm font-medium text-ink" aria-hidden>
          {t.match}
        </p>
        <div className="inline-flex rounded-full bg-paper-raised p-1 ring-1 ring-line">
          {(["any", "all"] as const).map((match) => {
            const checked = value.match === match;
            return (
              <label
                key={match}
                className={cn(
                  "inline-flex min-h-9 cursor-pointer items-center rounded-full px-3.5 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary",
                  checked ? "bg-primary-soft font-medium text-primary-dark" : "text-ink-soft hover:text-ink"
                )}
              >
                <input
                  type="radio"
                  name={matchName}
                  className="sr-only"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onChange({ ...value, match })}
                />
                {match === "any" ? t.matchAny : t.matchAll}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** The "Automatic" badge of a smart collection's row. */
export function SmartCollectionBadge() {
  const t = useT(STRINGS);
  return <StatusBadge value="automatic" tone="info" text={t.badge} />;
}

/** The rule in words: "Products tagged summer or sale join this collection by themselves." */
export function useSmartRuleSentence() {
  const t = useT(STRINGS);
  const { intlLocale } = useLocale();
  return (rules: SmartCollectionRules | null): string | null => {
    if (!rules) return null;
    if (rules.type === "all_products") return t.fillsItself;
    const list = new Intl.ListFormat(intlLocale, { type: rules.match === "all" ? "conjunction" : "disjunction" });
    return fmt(t.ruleNote, { tags: list.format(rules.tags) });
  };
}

/**
 * On a smart collection's product list: the rule in words and a Refresh
 * button that re-fills it from its rules. Nothing for a manual collection.
 */
export function SmartCollectionNote({ collection, onSynced }: { collection: CollectionSummary; onSynced: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const sentence = useSmartRuleSentence();
  const [busy, setBusy] = useState(false);
  const text = sentence(smartCollectionRulesOf(collection));
  if (!text) return null;

  async function refresh() {
    setBusy(true);
    try {
      const result = await smartCollectionsSync(apiClient, workspaceId, collection.id);
      toast.success(fmt(t.refreshed, { added: result.added, removed: result.removed }));
      onSynced();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-[var(--radius)] bg-primary-soft/60 px-3 py-2.5 ring-1 ring-primary/20">
      <IconSparkle className="size-4 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1 text-sm text-ink">{text}</p>
      <Button type="button" variant="outline" size="sm" className="min-h-11 bg-paper-raised" disabled={busy} onClick={() => void refresh()}>
        <IconRefresh className={cn("size-4", busy && "animate-spin motion-reduce:animate-none")} aria-hidden />
        {busy ? t.refreshing : t.refresh}
      </Button>
    </div>
  );
}

/** The collections list when there are none: start one, or make "All products" in one tap. */
export function CollectionsEmpty({
  title,
  createLabel,
  onCreate,
  onCreated,
}: {
  title: string;
  createLabel: string;
  onCreate: () => void;
  onCreated: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);

  async function createAll() {
    setBusy(true);
    try {
      await smartCollectionsEnsureAllProducts(apiClient, workspaceId, t.allProducts);
      toast.success(t.allCreated);
      onCreated();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <EmptyState
      icon={<IconFolder />}
      title={title}
      description={t.emptyHint}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button className="min-h-11" disabled={busy} onClick={() => void createAll()}>
            <IconSparkle className="size-4" aria-hidden />
            {busy ? t.creatingAll : t.createAll}
          </Button>
          <Button variant="outline" className="min-h-11" disabled={busy} onClick={onCreate}>
            {createLabel}
          </Button>
        </div>
      }
    />
  );
}
