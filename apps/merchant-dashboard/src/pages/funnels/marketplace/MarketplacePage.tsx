import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Upload } from "lucide-react";
import { Button } from "@store-builder/ui";
import type { MarketplaceTemplateCard } from "@store-builder/api-client";
import { useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { SectionTabs } from "@/components/SectionTabs";
import { MarketplaceBrowser } from "./MarketplaceBrowser";
import { MySubmissions } from "./MySubmissions";
import { ShareTemplateDialog } from "./ShareTemplateDialog";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";
import { UseTemplateDialog } from "./UseTemplateDialog";
import { MARKET_STRINGS } from "./marketplaceStrings";

type Tab = "browse" | "mine";

/**
 * Funnels → «سوق القوالب» (handoff 192, funnels.manage): the templates other
 * stores shared and the platform listed — preview, then "Use this template"
 * for a draft copy — and «قوالبك», this store's own submissions with their
 * review. The tab lives in ?tab= so "Your templates" can be linked to.
 */
export function MarketplacePage() {
  const t = useT(MARKET_STRINGS);
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "mine" ? "mine" : "browse";
  const setTab = (next: Tab) => setParams(next === "mine" ? { tab: "mine" } : {}, { replace: true });

  const [previewing, setPreviewing] = useState<MarketplaceTemplateCard | null>(null);
  const [using, setUsing] = useState<MarketplaceTemplateCard | null>(null);
  const [sharing, setSharing] = useState<{ funnelId?: string } | null>(null);
  // Bumped after a submission so "Your templates" reloads.
  const [version, setVersion] = useState(0);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        back={{ to: "/funnels", label: t.backToFunnels }}
        actions={
          <Button variant="outline" onClick={() => setSharing({})}>
            <Upload className="size-4" aria-hidden /> {t.share}
          </Button>
        }
      />

      <SectionTabs
        label={t.sections}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "browse", label: t.tabBrowse },
          { value: "mine", label: t.tabMine },
        ]}
      />

      <div className="mt-4">
        {tab === "browse" ? (
          <MarketplaceBrowser mode="page" onPreview={setPreviewing} onUse={setUsing} onShare={() => setSharing({})} />
        ) : (
          <MySubmissions version={version} onShare={(funnelId) => setSharing({ funnelId })} />
        )}
      </div>

      <TemplatePreviewDialog
        template={previewing}
        onClose={() => setPreviewing(null)}
        onUse={(template) => {
          setPreviewing(null);
          setUsing(template);
        }}
      />
      <UseTemplateDialog template={using} onClose={() => setUsing(null)} />
      <ShareTemplateDialog
        open={sharing !== null}
        funnelId={sharing?.funnelId}
        onClose={() => setSharing(null)}
        onSaved={() => {
          setVersion((v) => v + 1);
          setTab("mine");
        }}
      />
    </div>
  );
}
