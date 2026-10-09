import { useCallback, useMemo, useState } from "react";
import { IconLink } from "@/components/icons";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { AccordionGroup, AccordionSection } from "@/components/Accordion";
import { PageHeader } from "@/components/PageHeader";
import { AppOffNotice } from "@/components/AppOffNotice";
import { TextField } from "@/components/Field";
import { CopyButton } from "@/components/CopyButton";
import { useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { useTrackingPixels } from "./TrackingPixelsSection";
import { PixelEventLogSection } from "./PixelEventLogSection";
import { PurchaseTimingSection } from "./PurchaseTimingSection";
import { UtmSourceSuggestions } from "./UtmSourceSuggestions";

const STRINGS = {
  en: {
    title: "Tracking tools",
    description: "Connect your pixels and tags, and build tracked links for your campaigns.",
    utmTitle: "Tracked link builder",
    utmSummary: "Add UTM tags to a store link and copy it into your ad",
    utmDesc:
      "Add UTM tags to a store link so your ad platform can tell you which ad brought each visit. Nothing is saved — copy the link and use it in your ad.",
    path: "Store page",
    pathHint: "e.g. / or /products/your-product",
    source: "Source (utm_source)",
    medium: "Medium (utm_medium)",
    campaign: "Campaign (utm_campaign)",
    content: "Ad or creative (utm_content)",
    result: "Your link",
    copy: "Copy link",
  },
  ar: {
    title: "أدوات التتبع",
    description: "اربط البيكسلات والأكواد واعمل لينكات متتبعة لحملاتك.",
    utmTitle: "اعمل لينك متتبع",
    utmSummary: "ضيف UTM على لينك متجرك وانسخه في الإعلان",
    utmDesc:
      "ضيف علامات UTM على لينك متجرك عشان منصة الإعلانات تقولك أنهي إعلان جاب كل زيارة. مفيش حاجة بتتحفظ — انسخ اللينك واستخدمه في الإعلان.",
    path: "صفحة المتجر",
    pathHint: "مثلاً / أو /products/اسم-المنتج",
    source: "المصدر (utm_source)",
    medium: "الوسيلة (utm_medium)",
    campaign: "الحملة (utm_campaign)",
    content: "الإعلان أو التصميم (utm_content)",
    result: "اللينك بتاعك",
    copy: "انسخ اللينك",
  },
} satisfies Messages;

/**
 * Marketing → "Tracking tools". The pixels are the page: their list comes
 * first, with «ضيف بيكسل» as the one action of the header. What is set once or
 * looked at rarely folds under it, one tap away: the ready-made GTM container,
 * when a purchase is reported, the server event log, the tracked-link builder.
 */
export function MarketingPage() {
  const workspaceId = useWorkspaceId();
  // A store switch starts the page again: no pixel of the other store stays open in a sheet.
  return <TrackingTools key={workspaceId} workspaceId={workspaceId} />;
}

function TrackingTools({ workspaceId }: { workspaceId: string }) {
  const t = useT(STRINGS);
  const phone = useIsPhone();
  // A test event sent from the pixels list shows up in the log below.
  const [logVersion, setLogVersion] = useState(0);
  const bumpLog = useCallback(() => setLogVersion((n) => n + 1), []);
  const pixels = useTrackingPixels({ onEventsChanged: bumpLog });

  return (
    <div className="min-w-0 max-w-5xl">
      <PageHeader
        tutorial="marketing"
        title={t.title}
        // A phone keeps the first screen for the pixels: the sentence is for wider screens.
        description={phone ? undefined : t.description}
        primaryAction={pixels.addAction}
      />
      <AppOffNotice app="tracking_pixels" />

      <div className="flex flex-col gap-[var(--bento-gap)]">
        {pixels.list}
        <AccordionGroup>
          {pixels.gtm}
          <PurchaseTimingSection />
          <PixelEventLogSection reloadKey={logVersion} />
          <UtmLinkBuilder workspaceId={workspaceId} />
        </AccordionGroup>
      </div>

      {pixels.sheets}
    </div>
  );
}

/** Pure client-side tool; nothing here is stored or sent anywhere. */
function UtmLinkBuilder({ workspaceId }: { workspaceId: string }) {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  const [utm, setUtm] = useState({
    path: "/",
    source: "facebook",
    medium: "paid_social",
    campaign: "",
    content: "",
  });

  const link = useMemo(() => {
    const trimmed = utm.path.trim();
    const path = trimmed === "" || trimmed === "/" ? "" : trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    const query = new URLSearchParams();
    for (const [key, value] of [
      ["utm_source", utm.source],
      ["utm_medium", utm.medium],
      ["utm_campaign", utm.campaign],
      ["utm_content", utm.content],
    ] as const) {
      if (value.trim()) query.set(key, value.trim());
    }
    const base = `${STOREFRONT_URL}/store/${currentWorkspace?.slug || workspaceId}${path}`;
    const qs = query.toString();
    return qs ? `${base}?${qs}` : base;
  }, [utm, workspaceId, currentWorkspace?.slug]);

  return (
    <AccordionSection title={t.utmTitle} summary={t.utmSummary} icon={IconLink} persistKey="marketing:utm" keepMounted>
      <p className="text-[13px] leading-5 text-ink-soft">{t.utmDesc}</p>
      <div className="mt-4 space-y-4">
        {/* utm_source per ad platform, the newer ones included (handoff 254). */}
        <UtmSourceSuggestions source={utm.source} onPick={(source) => setUtm((prev) => ({ ...prev, source }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t.path} dir="ltr" value={utm.path} hint={t.pathHint} onChange={(e) => setUtm((prev) => ({ ...prev, path: e.target.value }))} />
          <TextField label={t.source} dir="ltr" value={utm.source} onChange={(e) => setUtm((prev) => ({ ...prev, source: e.target.value }))} />
          <TextField label={t.medium} dir="ltr" value={utm.medium} onChange={(e) => setUtm((prev) => ({ ...prev, medium: e.target.value }))} />
          <TextField label={t.campaign} dir="ltr" value={utm.campaign} onChange={(e) => setUtm((prev) => ({ ...prev, campaign: e.target.value }))} />
          <TextField label={t.content} dir="ltr" value={utm.content} onChange={(e) => setUtm((prev) => ({ ...prev, content: e.target.value }))} />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">{t.result}</p>
          <div data-slot="sweep-well" className="flex flex-col gap-2 rounded-2xl bg-paper-sunken p-3 sm:flex-row sm:items-center">
            <code dir="ltr" className="min-w-0 flex-1 text-start text-xs leading-5 break-all text-ink">
              {link}
            </code>
            <CopyButton value={link} label={t.copy} className="shrink-0 self-start bg-paper-raised px-3 ring-1 ring-line sm:self-center" />
          </div>
        </div>
      </div>
    </AccordionSection>
  );
}
