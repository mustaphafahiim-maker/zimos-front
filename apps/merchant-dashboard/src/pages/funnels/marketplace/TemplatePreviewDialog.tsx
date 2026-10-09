import { Button } from "@store-builder/ui";
import { apiErrorCode, marketplaceTemplate, type MarketplaceTemplateCard } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useMarketplaceErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { IconInfo } from "@/components/icons";
import { DataState } from "@/components/DataState";
import { Sheet } from "@/components/Sheet";
import { STEP_TYPE_LABELS } from "../FunnelEditorPage.strings";
import type { UiStepType } from "../funnelAdapter";
import { TemplatePages } from "./TemplatePages";
import { MARKET_STRINGS, categoryLabel, countsLine, languageLabel } from "./marketplaceStrings";

/**
 * A listed template before anyone copies it, in a sheet: what it is, then its
 * pages as a row to swipe through, each rendered by the storefront exactly as
 * a copy would get it (./TemplatePages.tsx). «استخدمه» hands the card back to
 * the caller (the name prompt, or the wizard's choice).
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
  const typeLabel = (key: string) => {
    const type = data?.steps.find((s) => s.key === key)?.stepType as UiStepType | undefined;
    return type ? (STEP_TYPE_LABELS[locale][type] ?? "") : "";
  };

  return (
    <Sheet
      open={template !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={template?.name ?? t.previewTitle}
      description={template ? fmt(t.by, { author: template.authorName }) : undefined}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
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
        {data && template && data.id === template.id && (
          <div className="space-y-4">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
              <span className="rounded-full bg-paper-sunken px-2 py-0.5 text-ink">{categoryLabel(t, data.category)}</span>
              {data.language && <span>{languageLabel(t, data.language)}</span>}
              <span>{countsLine(t, data.stepCount, data.usesCount)}</span>
            </p>
            {data.description && (
              <p className="text-sm leading-6 whitespace-pre-line text-ink" dir="auto">
                {data.description}
              </p>
            )}
            {data.tags.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label={t.tagsLabel}>
                {data.tags.map((tag) => (
                  <li key={tag} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs text-primary-dark dark:text-primary" dir="auto">
                    {tag}
                  </li>
                ))}
              </ul>
            )}
            <p className="zimos-funnel-warn flex items-start gap-2 rounded-[0.875rem] bg-accent-soft px-3 py-2 text-sm leading-6 text-accent-dark">
              <IconInfo className="mt-1 size-4 shrink-0" aria-hidden />
              {t.notCopied}
            </p>

            <TemplatePages
              key={data.id}
              workspaceId={workspaceId}
              previewId={`market-${data.id}`}
              templateName={data.name}
              pages={data.pages.map((p) => ({ key: p.key, name: p.name, typeLabel: typeLabel(p.key), tree: p.builderData }))}
            />
          </div>
        )}
      </DataState>
    </Sheet>
  );
}
