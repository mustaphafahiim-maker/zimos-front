import { useState, type FormEvent } from "react";
import { Check, FilePlus2 } from "lucide-react";
import { Alert, Button, Skeleton, cn } from "@store-builder/ui";
import type { WebsiteTemplateSummary } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { fmt, useT } from "@/i18n/LocaleContext";
import { useAsync } from "@/lib/useAsync";
import { useWorkspace } from "@/context/WorkspaceContext";
import { FALLBACK_TINT, blankHomeTree } from "./data";
import type { StepProps } from "./state";
import { STRINGS } from "./strings";

interface TemplateCard extends WebsiteTemplateSummary {
  primaryColor: string | null;
  fontFamily: string | null;
}

const BLANK = "blank";

export function StepLook({ state, next, update, setSaving, saving, formId }: StepProps) {
  const t = useT(STRINGS);
  const { workspaces } = useWorkspace();
  const workspaceId = state.workspaceId!;
  const storeName = state.basics?.name ?? workspaces.find((w) => w.id === workspaceId)?.name ?? "Store";

  const [choice, setChoice] = useState<string | null>(
    state.website ? state.website.templateVersionId ?? BLANK : null
  );
  const [error, setError] = useState<string | null>(null);

  // GET /templates, then GET /templates/:id for each to read globalStyles.primaryColor.
  const templates = useAsync(async (): Promise<TemplateCard[]> => {
    const list = await apiClient.listWebsiteTemplates();
    const details = await Promise.allSettled(list.map((tpl) => apiClient.getWebsiteTemplate(tpl.id)));
    return list.map((tpl, i) => {
      const d = details[i];
      const styles = d.status === "fulfilled" ? (d.value.globalStyles as Record<string, unknown>) : {};
      return {
        ...tpl,
        primaryColor: typeof styles?.primaryColor === "string" ? styles.primaryColor : null,
        fontFamily: typeof styles?.fontFamily === "string" ? styles.fontFamily : null,
      };
    });
  }, []);

  const categoryLabel = (c: string | null) => {
    if (!c) return t.tpl_other;
    const map: Record<string, string> = {
      fashion: t.cat_fashion,
      electronics: t.cat_electronics,
      food_beverage: t.cat_food,
      beauty: t.cat_beauty,
      home: t.cat_home,
      ecommerce: t.tpl_ecommerce,
      general: t.tpl_general,
    };
    return map[c] ?? c.replace(/_/g, " ");
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    if (!choice) {
      setError(t.pickOne);
      return;
    }
    const templateVersionId = choice === BLANK ? null : choice;
    const label =
      choice === BLANK ? t.blankLook : templates.data?.find((x) => x.templateVersionId === choice)?.name ?? "";

    // Already created on this run with the same choice → don't duplicate.
    if (state.website && state.website.templateVersionId === templateVersionId && state.website.ready) {
      next();
      return;
    }

    setSaving(true);
    try {
      let website = state.website;
      if (website && website.templateVersionId !== templateVersionId) {
        // The merchant changed their mind: drop the draft this run created.
        await apiClient.deleteWebsite(workspaceId, website.id).catch(() => undefined);
        website = undefined;
        update({ website: undefined });
      }
      if (!website) {
        const created = await apiClient.createWebsite(workspaceId, {
          name: storeName,
          ...(templateVersionId ? { templateVersionId } : {}),
        });
        website = { id: created.website.id, templateVersionId, label, ready: templateVersionId !== null };
        update({ website });
      }
      if (!website.ready) {
        await apiClient.createPage(workspaceId, website.id, {
          path: "/",
          title: storeName,
          pageType: "home",
          draftData: blankHomeTree(storeName, t.blankTagline),
        });
        website = { ...website, ready: true };
      }
      next({ website });
    } catch (err) {
      setError(getErrorMessage(err, t.lookError));
    } finally {
      setSaving(false);
    }
  }

  const cardBase =
    "group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-paper-raised text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
      {error && <Alert variant="danger">{error}</Alert>}
      {state.website?.ready && (
        <Alert>{fmt(t.lookCreated, { name: state.website.label })}</Alert>
      )}

      {templates.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label={t.saving}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      ) : templates.error ? (
        <Alert variant="danger">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{t.templatesError}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void templates.refresh()}>
              {t.retry}
            </Button>
          </div>
        </Alert>
      ) : null}

      {!templates.loading && (
        <div role="radiogroup" aria-label={t.lookTitle} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(templates.data ?? []).map((tpl) => {
            const active = choice === tpl.templateVersionId;
            const tint = tpl.primaryColor ?? FALLBACK_TINT;
            return (
              <button
                key={tpl.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setChoice(tpl.templateVersionId)}
                className={cn(cardBase, active ? "border-primary ring-2 ring-primary/30" : "border-line hover:border-line-strong")}
              >
                <TemplatePreview tint={tint} font={tpl.fontFamily} cta={t.previewCta} title={tpl.name} />
                <span className="flex items-center justify-between gap-2 p-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{tpl.name}</span>
                    <span className="block truncate text-xs text-ink-muted">{categoryLabel(tpl.category)}</span>
                  </span>
                  {active && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
                      <Check className="size-3" aria-hidden />
                      {t.selected}
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            role="radio"
            aria-checked={choice === BLANK}
            onClick={() => setChoice(BLANK)}
            className={cn(
              cardBase,
              "border-dashed",
              choice === BLANK ? "border-primary ring-2 ring-primary/30" : "border-line-strong hover:border-primary/50"
            )}
          >
            <span className="flex h-36 items-center justify-center bg-paper text-primary">
              <FilePlus2 className="size-10" aria-hidden />
            </span>
            <span className="p-3">
              <span className="block text-sm font-semibold text-ink">{t.blankName}</span>
              <span className="block text-xs text-ink-muted">{t.blankDesc}</span>
            </span>
          </button>
        </div>
      )}

      {!templates.loading && !templates.error && (templates.data ?? []).length === 0 && (
        <p className="text-sm text-ink-muted">{t.noTemplates}</p>
      )}
    </form>
  );
}

/** Pure-CSS mini storefront tinted with the template's primary colour. */
function TemplatePreview({ tint, font, cta, title }: { tint: string; font: string | null; cta: string; title: string }) {
  return (
    <span
      aria-hidden
      className="block h-36 overflow-hidden border-b border-line bg-white p-3"
      style={{ fontFamily: font ?? undefined }}
    >
      <span className="flex items-center justify-between">
        <span className="h-2 w-12 rounded-full" style={{ background: tint }} />
        <span className="flex gap-1">
          <span className="size-2 rounded-full bg-zinc-200" />
          <span className="size-2 rounded-full bg-zinc-200" />
        </span>
      </span>
      <span
        className="mt-2 flex h-14 flex-col justify-center rounded-lg px-3"
        style={{ background: `${tint}1A` }}
      >
        <span className="block truncate text-[10px] font-bold" style={{ color: tint }}>
          {title}
        </span>
        <span
          className="mt-1 inline-block w-fit rounded px-1.5 py-0.5 text-[8px] font-semibold text-white"
          style={{ background: tint }}
        >
          {cta}
        </span>
      </span>
      <span className="mt-2 grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-8 rounded-md bg-zinc-100" />
        ))}
      </span>
    </span>
  );
}
