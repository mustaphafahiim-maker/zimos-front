import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import { marketplaceUseTemplate, type MarketplaceTemplateCard } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useMarketplaceErrorMessage } from "@/lib/errorMessages";
import { pluralOf } from "@/lib/plural";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { MARKET_STRINGS } from "./marketplaceStrings";

/**
 * "Use this template" (handoff 192): a name for the copy, then
 * POST /templates/:id/use makes it a new draft funnel and its editor opens —
 * the editor's issues list then says which pages need a product or an offer.
 * The copy counts against the plan like any new funnel (PLAN_LIMIT_REACHED
 * gets the shared plan-limit sentence).
 */
export function UseTemplateDialog({ template, onClose }: { template: MarketplaceTemplateCard | null; onClose: () => void }) {
  const t = useT(MARKET_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const toast = useToast();
  const marketError = useMarketplaceErrorMessage();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(marketError(err, "template"));
      setBusy(false);
    }
  }

  return (
    <Modal
      open={template !== null}
      onClose={() => !busy && onClose()}
      title={template ? fmt(t.useTitle, { name: template.name }) : t.use}
      description={template ? fmt(t.useBody, { pages: pluralOf(t, "pages", template.stepCount) }) : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" form="use-market-template" disabled={busy}>
            {busy ? t.using : t.use}
          </Button>
        </>
      }
    >
      <form id="use-market-template" onSubmit={submit} className="space-y-3">
        <TextField label={t.funnelName} dir="auto" maxLength={200} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} autoFocus />
        <p className="flex items-start gap-2 rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent-dark">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t.notCopied}
        </p>
        <p className="text-xs text-ink-soft">{t.planNote}</p>
        {error && <Alert variant="danger">{error}</Alert>}
      </form>
    </Modal>
  );
}
