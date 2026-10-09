import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import type { MarketplaceTemplateCard } from "@store-builder/api-client";
import { useT } from "@/i18n/LocaleContext";
import { IconUpload } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/Segmented";
import { useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { MarketplaceBrowser } from "./MarketplaceBrowser";
import { MySubmissions } from "./MySubmissions";
import { ShareTemplateDialog } from "./ShareTemplateDialog";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";
import { UseTemplateDialog } from "./UseTemplateDialog";
import { MARKET_STRINGS } from "./marketplaceStrings";

type Tab = "browse" | "mine";

/**
 * Funnels → «سوق التمبلتات» (handoff 192, funnels.manage): the templates other
 * stores shared and the platform listed — a grid to look through, a preview
 * sheet, then «استخدمه» for a draft copy — and «تمبلتاتي», this store's own
 * submissions with their review. The tab lives in ?tab= so «تمبلتاتي» can be
 * linked to. Sharing one of the store's funnels is the page's one action.
 */
export function MarketplacePage() {
  const t = useT(MARKET_STRINGS);
  const phone = useIsPhone();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "mine" ? "mine" : "browse";
  const setTab = (next: Tab) => setParams(next === "mine" ? { tab: "mine" } : {}, { replace: true });

  const [previewing, setPreviewing] = useState<MarketplaceTemplateCard | null>(null);
  const [using, setUsing] = useState<MarketplaceTemplateCard | null>(null);
  const [sharing, setSharing] = useState<{ funnelId?: string } | null>(null);
  // Bumped after a submission so «تمبلتاتي» reloads.
  const [version, setVersion] = useState(0);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        // A phone keeps the first screen for the templates: the sentence is for wider screens.
        description={phone ? undefined : t.description}
        back={{ to: "/funnels", label: t.backToFunnels }}
        primaryAction={
          <Button className="min-h-11 rounded-full px-5" onClick={() => setSharing({})}>
            <IconUpload className="size-4" weight="bold" aria-hidden /> {t.shareShort}
          </Button>
        }
      />

      <div className="flex min-w-0 flex-col gap-3">
        <Segmented
          label={t.sections}
          value={tab}
          onChange={setTab}
          className="max-sm:w-full sm:self-start"
          options={[
            { value: "browse", label: t.tabBrowse },
            { value: "mine", label: t.tabMine },
          ]}
        />

        {tab === "browse" ? (
          <MarketplaceBrowser mode="page" onPreview={setPreviewing} onUse={setUsing} onShare={() => setSharing({})} />
        ) : (
          <MySubmissions version={version} onShare={(funnelId) => setSharing({ funnelId })} />
        )}
      </div>

      <TemplatePreviewDialog
        template={previewing}
        onClose={() => setPreviewing(null)}
        useLabel={t.useShort}
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
