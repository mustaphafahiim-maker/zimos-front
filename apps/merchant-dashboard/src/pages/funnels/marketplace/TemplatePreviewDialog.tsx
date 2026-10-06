import { useState } from "react";
import { Info, LayoutTemplate, Monitor, Smartphone } from "lucide-react";
import { Button } from "@store-builder/ui";
import { apiErrorCode, marketplaceTemplate, type MarketplaceTemplateCard, type PageTree } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useMarketplaceErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { FilterTabs } from "@/components/FilterTabs";
import { Modal } from "@/components/Modal";
import { TemplateLivePreview } from "@/components/TemplateLivePreview";
import { columnTitle, sectionIcon, sectionLabel } from "../../website/editor/blocks";
import { STEP_TYPE_LABELS } from "../FunnelEditorPage.strings";
import type { UiStepType } from "../funnelAdapter";
import { MARKET_STRINGS, categoryLabel, countsLine, languageLabel } from "./marketplaceStrings";

/**
 * A listed template before anyone copies it: its pages one tab at a time,
 * each rendered by the storefront exactly as a copy would get it (computer or
 * phone width), with the page's sections listed underneath — so the merchant
 * can read what is on it even when the live render can't load. "Use this
 * template" hands the card back to the caller (the name prompt, or the
 * wizard's choice).
 */
export function TemplatePreviewDialog({
  template,
  onClose,
  onUse,
  useLabel,
}: {
  template: MarketplaceTemplateCard | null;
  onClose: () => void;
  onUse?: (template: MarketplaceTemplateCard) => void;
  useLabel?: string;
}) {
  const t = useT(MARKET_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const marketError = useMarketplaceErrorMessage();
  const [pageKey, setPageKey] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const detail = useAsync(
    () =>
      template
        ? marketplaceTemplate(apiClient, workspaceId, template.id).catch((err) => {
            // Unlisted or withdrawn since the grid loaded: say so, not "not found".
            throw apiErrorCode(err) === "NOT_FOUND" ? new Error(marketError(err, "template")) : err;
          })
        : Promise.resolve(null),
    [workspaceId, template?.id]
  );

  const data = detail.data;
  const pages = data?.pages ?? [];
  const page = pages.find((p) => p.key === pageKey) ?? pages[0] ?? null;
  const stepType = (key: string) => data?.steps.find((s) => s.key === key)?.stepType as UiStepType | undefined;
  const typeLabel = (key: string) => {
    const type = stepType(key);
    return type ? (STEP_TYPE_LABELS[locale][type] ?? "") : "";
  };
  const close = () => {
    setPageKey(null);
    onClose();
  };

  return (
    <Modal
      open={template !== null}
      onClose={close}
      title={template?.name ?? t.previewTitle}
      description={template ? fmt(t.by, { author: template.authorName }) : undefined}
      className="sm:max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={close}>
            {t.close}
          </Button>
          {onUse && template && (
            <Button onClick={() => onUse(template)} disabled={!data}>
              {useLabel ?? t.use}
            </Button>
          )}
        </>
      }
    >
      <DataState loading={detail.loading} error={detail.error} onRetry={() => void detail.refresh()}>
        {data && (
          <div className="space-y-4">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
              <span className="rounded-full bg-paper-sunken px-2 py-0.5 text-ink">{categoryLabel(t, data.category)}</span>
              {data.language && <span>{languageLabel(t, data.language)}</span>}
              <span>{countsLine(t, data.stepCount, data.usesCount)}</span>
            </p>
            {data.description && (
              <p className="whitespace-pre-line text-sm text-ink" dir="auto">
                {data.description}
              </p>
            )}
            {data.tags.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label={t.tagsLabel}>
                {data.tags.map((tag) => (
                  <li key={tag} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs text-primary-dark" dir="auto">
                    {tag}
                  </li>
                ))}
              </ul>
            )}
            <p className="flex items-start gap-2 rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent-dark">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t.notCopied}
            </p>

            {page && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {pages.length > 1 ? (
                    <FilterTabs
                      label={t.pagesLabel}
                      value={page.key}
                      onChange={setPageKey}
                      className="flex max-w-full flex-nowrap overflow-x-auto"
                      buttonClassName="shrink-0 whitespace-nowrap"
                      // The name isolated (FSI…PDI): a name in the other script would pull the number to its far side.
                      tabs={pages.map((p, i) => ({ value: p.key, label: `${fmt("{n}", { n: i + 1 })}. \u2068${p.name}\u2069` }))}
                    />
                  ) : (
                    <p className="text-sm font-medium text-ink" dir="auto">
                      {page.name}
                    </p>
                  )}
                  <div role="group" aria-label={t.device} className="ms-auto flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant={device === "desktop" ? "secondary" : "ghost"}
                      aria-label={t.desktop}
                      aria-pressed={device === "desktop"}
                      onClick={() => setDevice("desktop")}
                    >
                      <Monitor className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant={device === "mobile" ? "secondary" : "ghost"}
                      aria-label={t.mobile}
                      aria-pressed={device === "mobile"}
                      onClick={() => setDevice("mobile")}
                    >
                      <Smartphone className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
                {typeLabel(page.key) && <p className="-mt-2 text-xs text-ink-soft">{typeLabel(page.key)}</p>}
                <div className="h-[min(60vh,34rem)] overflow-hidden rounded-xl border border-line">
                  <TemplateLivePreview
                    key={page.key}
                    variant="full"
                    device={device}
                    workspaceId={workspaceId}
                    templateId={`market-${data.id}-${page.key}`}
                    page={page.builderData}
                    title={fmt(t.livePreview, { name: data.name, page: page.name })}
                    fallback={
                      <div className="flex h-full items-center justify-center bg-paper-sunken text-ink-soft">
                        <LayoutTemplate className="size-8" aria-hidden />
                      </div>
                    }
                  />
                </div>
                <PageOutline tree={page.builderData} />
              </>
            )}
          </div>
        )}
      </DataState>
    </Modal>
  );
}

/** The page's sections in order — what each one is and the first words it says. */
function PageOutline({ tree }: { tree: PageTree | null }) {
  const t = useT(MARKET_STRINGS);
  const { locale } = useLocale();
  const sections = tree?.sections ?? [];
  if (sections.length === 0) return <p className="text-sm text-ink-soft">{t.emptyPage}</p>;
  return (
    <section>
      <h3 className="text-sm font-semibold text-ink">{t.onThisPage}</h3>
      <ol className="mt-2 space-y-1.5">
        {sections.map((section, i) => {
          const Icon = sectionIcon(section);
          const words = (section.rows ?? [])
            .flatMap((row) => row.columns ?? [])
            .map((column) => columnTitle(column, 80))
            .find(Boolean);
          return (
            <li key={section.id ?? i} className="flex items-start gap-2.5 rounded-xl bg-paper-sunken px-3 py-2">
              <Icon className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{sectionLabel(section, locale)}</span>
                {words && (
                  <span className="block truncate text-xs text-ink-soft" dir="auto">
                    {words}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
