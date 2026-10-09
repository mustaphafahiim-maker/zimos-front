import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { isApiErrorCode, marketplaceUseTemplate, type MarketplaceTemplateCard } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useMarketplaceErrorMessage } from "@/lib/errorMessages";
import { pluralOf } from "@/lib/plural";
import { useViewNavigate } from "@/lib/viewTransition";
import { fmt, useT } from "@/i18n/LocaleContext";
import { IconInfo } from "@/components/icons";
import { TextField } from "@/components/Field";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { MARKET_STRINGS } from "./marketplaceStrings";

/**
 * «استخدمه» (handoff 192), a small sheet: a name for the copy, then
 * POST /templates/:id/use makes it a new draft funnel and its editor opens —
 * the editor's issues list then says which pages need a product or an offer.
 * The copy counts against the plan like any new funnel: at the plan's limit
 * the sheet says so in words, with the way to a bigger plan.
 */
export function UseTemplateDialog({ template, onClose }: { template: MarketplaceTemplateCard | null; onClose: () => void }) {
  const t = useT(MARKET_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const toast = useToast();
  const marketError = useMarketplaceErrorMessage();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; planLimit: boolean } | null>(null);

  useEffect(() => {
    if (!template) return;
    setName(template.name);
    setError(null);
    setBusy(false);
  }, [template]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!template || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await marketplaceUseTemplate(apiClient, workspaceId, template.id, name.trim() ? { name: name.trim() } : {});
      toast.success(fmt(t.usedToast, { name: created.funnel.name }));
      navigate(`/funnels/${created.funnel.id}`);
    } catch (err) {
      setError({ message: marketError(err, "template"), planLimit: isApiErrorCode(err, "PLAN_LIMIT_REACHED") });
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={template !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={template ? fmt(t.useTitle, { name: template.name }) : t.use}
      description={template ? fmt(t.useBody, { pages: pluralOf(t, "pages", template.stepCount) }) : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" form="use-market-template" disabled={busy}>
            {busy ? t.using : t.useShort}
          </Button>
        </>
      }
    >
      <form id="use-market-template" onSubmit={submit} className="space-y-3">
        <TextField label={t.funnelName} dir="auto" maxLength={200} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
        <p className="zimos-funnel-warn flex items-start gap-2 rounded-[0.875rem] bg-accent-soft px-3 py-2 text-sm leading-6 text-accent-dark">
          <IconInfo className="mt-1 size-4 shrink-0" aria-hidden />
          {t.notCopied}
        </p>
        <p className="text-xs leading-5 text-ink-soft">{t.planNote}</p>
        {error && (
          <Alert variant="danger" className="space-y-1">
            <p>{error.message}</p>
            {error.planLimit && (
              <ViewLink to="/settings?tab=billing" className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">
                {t.upgrade}
              </ViewLink>
            )}
          </Alert>
        )}
      </form>
    </Sheet>
  );
}
