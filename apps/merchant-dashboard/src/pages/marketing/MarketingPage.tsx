import { useCallback, useMemo, useState } from "react";
import { Link2 } from "lucide-react";
import { Card } from "@store-builder/ui";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { TextField } from "@/components/Field";
import { CopyButton } from "@/components/CopyButton";
import { TrackingPixelsSection } from "./TrackingPixelsSection";
import { PixelEventLogSection } from "./PixelEventLogSection";
import { PurchaseTimingSection } from "./PurchaseTimingSection";

const STRINGS = {
  en: {
    title: "Tracking tools",
    description: "Connect your pixels and tags, and build tracked links for your campaigns.",
    utmTitle: "Tracked link builder",
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
    utmTitle: "عمل لينك متتبع",
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
 * Marketing → "Tracking tools": the store's pixels and tags (their own
 * section, backed by the tracking_pixels table) and the tracked-link builder.
 */
export function MarketingPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  // A test event sent from the pixels table shows up in the log below.
  const [logVersion, setLogVersion] = useState(0);
  const bumpLog = useCallback(() => setLogVersion((n) => n + 1), []);

  // Pure client-side tool; nothing here is stored or sent anywhere.
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
    <div className="min-w-0 max-w-4xl">
      <PageHeader
        title={t.title} description={t.description} />

      <TrackingPixelsSection key={workspaceId} onEventsChanged={bumpLog} />
      <PurchaseTimingSection key={`timing-${workspaceId}`} />
      <PixelEventLogSection key={`log-${workspaceId}`} reloadKey={logVersion} />

      <Card className="gap-0 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Link2 className="size-4 text-primary" aria-hidden />
          {t.utmTitle}
        </h2>
        <p className="mt-0.5 text-xs text-ink-soft">{t.utmDesc}</p>
        <div className="mt-3 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t.path}
              dir="ltr"
              value={utm.path}
              hint={t.pathHint}
              onChange={(e) => setUtm((prev) => ({ ...prev, path: e.target.value }))}
            />
            <TextField
              label={t.source}
              dir="ltr"
              value={utm.source}
              onChange={(e) => setUtm((prev) => ({ ...prev, source: e.target.value }))}
            />
            <TextField
              label={t.medium}
              dir="ltr"
              value={utm.medium}
              onChange={(e) => setUtm((prev) => ({ ...prev, medium: e.target.value }))}
            />
            <TextField
              label={t.campaign}
              dir="ltr"
              value={utm.campaign}
              onChange={(e) => setUtm((prev) => ({ ...prev, campaign: e.target.value }))}
            />
            <TextField
              label={t.content}
              dir="ltr"
              value={utm.content}
              onChange={(e) => setUtm((prev) => ({ ...prev, content: e.target.value }))}
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">{t.result}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <code
                dir="ltr"
                className="min-w-0 flex-1 break-all rounded-lg bg-paper px-3 py-2 text-xs text-ink ring-1 ring-foreground/10"
              >
                {link}
              </code>
              <CopyButton
                value={link}
                label={t.copy}
                className="rounded-lg bg-paper-raised px-3 py-2 text-sm ring-1 ring-foreground/10"
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
