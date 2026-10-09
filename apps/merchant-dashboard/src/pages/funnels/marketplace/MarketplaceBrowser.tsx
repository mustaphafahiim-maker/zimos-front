import { useEffect, useId, useState } from "react";
import { Button, cn } from "@store-builder/ui";
import {
  MARKETPLACE_CATEGORIES,
  marketplaceBrowse,
  type MarketplaceCategory,
  type MarketplaceLanguage,
  type MarketplaceTemplateCard,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { pluralOf } from "@/lib/plural";
import { fmt, useT } from "@/i18n/LocaleContext";
import { IconEye, IconLayout, IconSearch, IconUpload } from "@/components/icons";
import { DataState, SkeletonBar } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { ChipRow, ListToolbar } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { ChoiceCard } from "../wizard/ChoiceCard";
import { LANGUAGES, MARKET_STRINGS, categoryLabel, countsLine, languageLabel, type MarketStrings } from "./marketplaceStrings";

const PAGE_SIZE = 24;

type Sort = "popular" | "new";

/**
 * The listed templates (handoff 192): one toolbar — search, order, language —
 * then the kinds as one row of chips, then the cards. `mode="page"` is the
 * marketplace page: a grid of one, two or three columns, each card with
 * «عاين» and «استخدمه». `mode="pick"` is the new-funnel wizard's gallery tab:
 * a card is a choice (a radio) the wizard creates from, with «عاين» beside it.
 */
export function MarketplaceBrowser({
  mode,
  selectedId,
  onPick,
  onPreview,
  onUse,
  onShare,
}: {
  mode: "page" | "pick";
  selectedId?: string | null;
  onPick?: (template: MarketplaceTemplateCard) => void;
  onPreview: (template: MarketplaceTemplateCard) => void;
  onUse?: (template: MarketplaceTemplateCard) => void;
  /** Offered on the empty marketplace: be the first to share. */
  onShare?: () => void;
}) {
  const t = useT(MARKET_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const sortId = useId();
  const languageId = useId();

  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<"all" | MarketplaceCategory>("all");
  const [sort, setSort] = useState<Sort>("popular");
  const [language, setLanguage] = useState<"" | MarketplaceLanguage>("");
  // The search runs once typing pauses; the field itself never waits.
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(draft.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const filtered = q !== "" || category !== "all" || language !== "";
  const params = { q: q || undefined, category: category === "all" ? undefined : category, language: language || undefined, sort, limit: PAGE_SIZE };
  const first = useAsync(() => marketplaceBrowse(apiClient, workspaceId, { ...params, page: 1 }), [workspaceId, q, category, sort, language]);
  // Later pages, appended under the first one; a new filter starts over.
  const [more, setMore] = useState<{ items: MarketplaceTemplateCard[]; page: number; loading: boolean }>({ items: [], page: 1, loading: false });
  useEffect(() => setMore({ items: [], page: 1, loading: false }), [first.data]);

  const templates = [...(first.data?.templates ?? []), ...more.items];
  const total = first.data?.total ?? 0;

  async function loadMore() {
    setMore((m) => ({ ...m, loading: true }));
    try {
      const next = await marketplaceBrowse(apiClient, workspaceId, { ...params, page: more.page + 1 });
      setMore((m) => ({ items: [...m.items, ...next.templates], page: m.page + 1, loading: false }));
    } catch (err) {
      setMore((m) => ({ ...m, loading: false }));
      toast.error(errorMessage(err));
    }
  }

  function clearFilters() {
    setDraft("");
    setQ("");
    setCategory("all");
    setLanguage("");
  }

  const grid = cn("grid gap-3", mode === "page" ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2");
  const PILL_SELECT = "h-11 w-auto max-w-[11rem] rounded-full ps-4 font-medium";

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ListToolbar search={{ value: draft, onChange: setDraft, placeholder: t.searchPlaceholder, label: t.search }}>
        <label htmlFor={sortId} className="sr-only">
          {t.sort}
        </label>
        <Select id={sortId} value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={PILL_SELECT}>
          <option value="popular">{t.sortPopular}</option>
          <option value="new">{t.sortNew}</option>
        </Select>
        <label htmlFor={languageId} className="sr-only">
          {t.language}
        </label>
        <Select id={languageId} value={language} onChange={(e) => setLanguage(e.target.value as "" | MarketplaceLanguage)} className={PILL_SELECT}>
          <option value="">{t.anyLanguage}</option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {languageLabel(t, l)}
            </option>
          ))}
        </Select>
      </ListToolbar>

      <ChipRow
        label={t.category}
        value={category}
        onChange={setCategory}
        collapseEmpty={false}
        items={[{ value: "all", label: t.all }, ...MARKETPLACE_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(t, c) }))]}
      />

      <DataState
        loading={first.loading && !first.data}
        error={first.error}
        onRetry={() => void first.refresh()}
        skeleton={<GridSkeleton className={grid} mode={mode} />}
      >
        {templates.length === 0 ? (
          first.loading ? (
            <GridSkeleton className={grid} mode={mode} />
          ) : filtered ? (
            <EmptyState
              icon={<IconSearch aria-hidden />}
              title={t.noneFitTitle}
              description={t.noneFitBody}
              action={
                <Button variant="outline" className="min-h-11 rounded-full px-5" onClick={clearFilters}>
                  {t.clearFilters}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<IconLayout aria-hidden />}
              title={t.emptyTitle}
              description={t.emptyBody}
              action={
                onShare ? (
                  <Button className="min-h-11 rounded-full px-5" onClick={onShare}>
                    <IconUpload className="size-4" aria-hidden /> {t.share}
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          <div
            aria-busy={first.loading || undefined}
            className={cn("transition-opacity duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none", first.loading && "opacity-60")}
          >
            {mode === "page" ? (
              <div className={grid}>
                {templates.map((tpl) => (
                  <TemplateCard key={tpl.id} t={t} template={tpl} onPreview={() => onPreview(tpl)} onUse={() => onUse?.(tpl)} />
                ))}
              </div>
            ) : (
              <div role="radiogroup" aria-label={t.tabBrowse} className={grid}>
                {templates.map((tpl) => (
                  <PickCard key={tpl.id} t={t} template={tpl} active={selectedId === tpl.id} onPick={() => onPick?.(tpl)} onPreview={() => onPreview(tpl)} />
                ))}
              </div>
            )}
            <LoadMore hasMore={templates.length < total} loading={more.loading} onClick={() => void loadMore()} />
            {mode === "page" && (
              <p className="pt-3 text-center text-xs text-ink-soft tabular-nums" role="status">
                {pluralOf(t, "count", total)}
              </p>
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}

/** The grid while its first page loads: cards in the shape of the real ones, so nothing jumps when they arrive. */
function GridSkeleton({ className, mode }: { className: string; mode: "page" | "pick" }) {
  return (
    <div aria-hidden className={className}>
      {Array.from({ length: mode === "page" ? 6 : 4 }, (_, i) =>
        mode === "page" ? (
          <div key={i} className="zimos-template-card overflow-hidden rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line">
            <div className="aspect-[16/9] bg-paper-sunken" />
            <div className="space-y-2.5 p-4">
              <SkeletonBar className="h-4 w-3/5" />
              <SkeletonBar className="w-2/5" />
              <SkeletonBar className="w-4/5" />
              <div className="grid grid-cols-2 gap-2 pt-2">
                <SkeletonBar className="h-11 rounded-full" />
                <SkeletonBar className="h-11 rounded-full" />
              </div>
            </div>
          </div>
        ) : (
          <div key={i} className="zimos-wizard-choice flex min-h-[5.5rem] items-center gap-3 rounded-[1.125rem] bg-paper-raised px-3.5 py-3 ring-1 ring-line">
            <div className="size-14 shrink-0 rounded-[0.875rem] bg-paper-sunken" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBar className="h-4 w-3/5" />
              <SkeletonBar className="w-2/5" />
            </div>
          </div>
        )
      )}
    </div>
  );
}

/** The template's picture, or a calm tile with its kind when it has none. */
export function TemplatePicture({ t, template, className }: { t: MarketStrings; template: MarketplaceTemplateCard; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (template.thumbnailUrl && !broken) {
    return (
      <img
        src={template.thumbnailUrl}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className={cn("block w-full bg-paper-sunken object-cover", className)}
      />
    );
  }
  return (
    <div aria-hidden className={cn("zimos-template-tile flex w-full flex-col items-center justify-center gap-1.5 bg-primary-soft text-primary-dark dark:text-primary", className)}>
      <IconLayout className="size-6" weight="duotone" />
      <span className="text-xs font-medium">{categoryLabel(t, template.category)}</span>
    </div>
  );
}

function CardMeta({ t, template }: { t: MarketStrings; template: MarketplaceTemplateCard }) {
  return (
    // Spans, not paragraphs: the wizard's card puts this inside its <label>.
    <>
      <span className="block truncate text-xs leading-5 text-ink-soft" dir="auto">
        {fmt(t.by, { author: template.authorName })}
      </span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-ink-soft">
        <span className="rounded-full bg-paper-sunken px-2 py-0.5 text-ink">{categoryLabel(t, template.category)}</span>
        {template.language && <span>{languageLabel(t, template.language)}</span>}
        <span>{countsLine(t, template.stepCount, template.usesCount)}</span>
      </span>
    </>
  );
}

function TemplateCard({
  t,
  template,
  onPreview,
  onUse,
}: {
  t: MarketStrings;
  template: MarketplaceTemplateCard;
  onPreview: () => void;
  onUse: () => void;
}) {
  return (
    <article
      data-slot="template-card"
      className="zimos-template-card flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line"
    >
      <button
        type="button"
        onClick={onPreview}
        aria-label={fmt(t.previewOf, { name: template.name })}
        className="block cursor-pointer overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <TemplatePicture t={t} template={template} className="aspect-[16/9]" />
      </button>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="line-clamp-2 text-[15px] leading-6 font-semibold text-ink" dir="auto">
          {template.name}
        </h3>
        <CardMeta t={t} template={template} />
        {template.description && (
          <p className="line-clamp-2 text-sm leading-6 text-ink-soft" dir="auto">
            {template.description}
          </p>
        )}
        <div className="mt-auto grid grid-cols-2 gap-2 pt-2.5">
          <Button variant="outline" className="min-h-11 rounded-full" onClick={onPreview} aria-label={fmt(t.previewOf, { name: template.name })}>
            <IconEye className="size-4" aria-hidden /> {t.preview}
          </Button>
          <Button className="min-h-11 rounded-full" onClick={onUse}>
            {t.useShort}
          </Button>
        </div>
      </div>
    </article>
  );
}

function PickCard({
  t,
  template,
  active,
  onPick,
  onPreview,
}: {
  t: MarketStrings;
  template: MarketplaceTemplateCard;
  active: boolean;
  onPick: () => void;
  onPreview: () => void;
}) {
  return (
    <ChoiceCard
      name="funnel-template"
      checked={active}
      onSelect={onPick}
      leading={<TemplatePicture t={t} template={template} className="size-14 rounded-[0.875rem] [&>span]:hidden" />}
      title={template.name}
      hint={<CardMeta t={t} template={template} />}
    >
      <div className="-mb-1.5 flex items-center justify-end">
        <button
          type="button"
          onClick={onPreview}
          aria-label={fmt(t.previewOf, { name: template.name })}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium text-primary transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
        >
          <IconEye className="size-4" aria-hidden /> {t.preview}
        </button>
      </div>
    </ChoiceCard>
  );
}
