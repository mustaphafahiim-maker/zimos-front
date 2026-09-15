import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Copy, Link2, Radio } from "lucide-react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@store-builder/ui";
import type { TrackingPixelIds } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";

const STOREFRONT_URL = ((import.meta.env.VITE_STOREFRONT_URL as string | undefined) ?? "http://localhost:3000").replace(/\/+$/, "");

type PlatformKey = keyof TrackingPixelIds;

const PLATFORMS: Array<{ key: PlatformKey; name: string; pattern: RegExp; example: string }> = [
  { key: "meta", name: "Meta (Facebook & Instagram)", pattern: /^\d{5,20}$/, example: "123456789012345" },
  { key: "tiktok", name: "TikTok", pattern: /^[A-Z0-9]{10,30}$/, example: "C4ABCDEF1234567890" },
  { key: "snapchat", name: "Snapchat", pattern: /^[a-f0-9-]{20,40}$/i, example: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d" },
  { key: "google_tag", name: "Google (GA4 / Ads)", pattern: /^(G|AW|GT)-[A-Z0-9]{4,20}$/, example: "G-ABC123XYZ" },
];

const STRINGS = {
  en: {
    title: "Marketing",
    description: "Connect your ad pixels and build tracked links for your campaigns.",
    pixelsTitle: "Ad pixels",
    pixelsDesc: "Paste the pixel ID from each ad platform. It loads on every page of your store.",
    eventsNote: "Events sent automatically: page view, product view, add to cart, checkout started and purchase (with the real order total, once per order).",
    idHint: "Example: {example}",
    invalid: "This doesn't look like a valid ID.",
    connected: "Connected",
    notConnected: "Not connected",
    save: "Save pixels",
    saving: "Saving…",
    saved: "Pixels saved. They're live on your store now.",
    serverSide: "Server-side conversions (Conversions API) aren't available yet — browser pixels only.",
    utmTitle: "Tracked link builder",
    utmDesc: "Add UTM tags so you can tell which ad brought each visit.",
    path: "Store page",
    pathHint: "e.g. / or /products/your-product",
    source: "Source (utm_source)",
    medium: "Medium (utm_medium)",
    campaign: "Campaign (utm_campaign)",
    content: "Ad / creative (utm_content)",
    result: "Your link",
    copy: "Copy link",
    copied: "Copied",
  },
  ar: {
    title: "التسويق",
    description: "اربط بيكسلات الإعلانات واعمل لينكات متتبعة لحملاتك.",
    pixelsTitle: "بيكسلات الإعلانات",
    pixelsDesc: "حط رقم البيكسل من كل منصة إعلانات، وهيشتغل في كل صفحات متجرك.",
    eventsNote: "الأحداث بتتبعت لوحدها: فتح صفحة، مشاهدة منتج، إضافة للسلة، بدء الطلب، والشراء (بقيمة الطلب الحقيقية، مرة واحدة لكل طلب).",
    idHint: "مثال: {example}",
    invalid: "الرقم ده مش شكله صح.",
    connected: "متوصل",
    notConnected: "مش متوصل",
    save: "احفظ البيكسلات",
    saving: "بيحفظ…",
    saved: "اتحفظت، والبيكسلات شغالة في متجرك دلوقتي.",
    serverSide: "التتبع من السيرفر (Conversions API) لسه مش متاح — البيكسل من المتصفح بس.",
    utmTitle: "عمل لينك متتبع",
    utmDesc: "ضيف علامات UTM علشان تعرف أنهي إعلان جاب كل زيارة.",
    path: "صفحة المتجر",
    pathHint: "مثلًا / أو /products/اسم-المنتج",
    source: "المصدر (utm_source)",
    medium: "الوسيلة (utm_medium)",
    campaign: "الحملة (utm_campaign)",
    content: "الإعلان (utm_content)",
    result: "اللينك بتاعك",
    copy: "انسخ اللينك",
    copied: "اتنسخ",
  },
} satisfies Messages;

const fmtHint = (template: string, example: string) => template.replace("{example}", example);

export function MarketingPage() {
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace, refresh } = useWorkspace();
  const saved = (currentWorkspace?.settings?.tracking_pixels ?? {}) as TrackingPixelIds;

  const [ids, setIds] = useState<Record<PlatformKey, string>>({ meta: "", tiktok: "", snapchat: "", google_tag: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setIds({ meta: saved.meta ?? "", tiktok: saved.tiktok ?? "", snapchat: saved.snapchat ?? "", google_tag: saved.google_tag ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace?.id, JSON.stringify(saved)]);

  const invalid = PLATFORMS.filter((p) => ids[p.key].trim() && !p.pattern.test(ids[p.key].trim()));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (invalid.length > 0) return;
    setSaving(true);
    setFormError(null);
    try {
      const tracking_pixels = Object.fromEntries(PLATFORMS.map((p) => [p.key, ids[p.key].trim() || null])) as TrackingPixelIds;
      await apiClient.updateWorkspace(workspaceId, { settings: { tracking_pixels } });
      await refresh();
      toast.success(t.saved);
    } catch (err) {
      const fields = getFieldErrors(err);
      setFormError(Object.values(fields)[0] ?? getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // UTM link builder (pure client tool, nothing stored).
  const [utm, setUtm] = useState({ path: "/", source: "facebook", medium: "paid_social", campaign: "", content: "" });
  const [copied, setCopied] = useState(false);
  const link = useMemo(() => {
    const path = utm.path.trim().startsWith("/") ? utm.path.trim() : `/${utm.path.trim()}`;
    const q = new URLSearchParams();
    if (utm.source) q.set("utm_source", utm.source.trim());
    if (utm.medium) q.set("utm_medium", utm.medium.trim());
    if (utm.campaign) q.set("utm_campaign", utm.campaign.trim());
    if (utm.content) q.set("utm_content", utm.content.trim());
    const base = `${STOREFRONT_URL}/store/${currentWorkspace?.slug || workspaceId}${path === "/" ? "" : path}`;
    return q.toString() ? `${base}?${q.toString()}` : base;
  }, [utm, workspaceId, currentWorkspace?.slug]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={t.title} description={t.description} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="size-4 text-primary" aria-hidden />
            {t.pixelsTitle}
          </CardTitle>
          <CardDescription>{t.pixelsDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4" noValidate>
            {formError && <Alert variant="danger">{formError}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              {PLATFORMS.map((p) => {
                const value = ids[p.key];
                const bad = value.trim() !== "" && !p.pattern.test(value.trim());
                const live = !!saved[p.key];
                return (
                  <div key={p.key} className="rounded-xl border border-line p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{p.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${live ? "bg-success-soft text-success" : "bg-paper text-ink-soft"}`}>
                        {live ? t.connected : t.notConnected}
                      </span>
                    </div>
                    <TextField
                      label={p.name}
                      dir="ltr"
                      value={value}
                      placeholder={p.example}
                      onChange={(e) => setIds((prev) => ({ ...prev, [p.key]: e.target.value }))}
                      error={bad ? t.invalid : undefined}
                      hint={bad ? undefined : fmtHint(t.idHint, p.example)}
                    />
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-ink-soft">{t.eventsNote}</p>
            <p className="text-xs text-ink-muted">{t.serverSide}</p>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || invalid.length > 0}>
                {saving ? t.saving : t.save}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-4 text-primary" aria-hidden />
            {t.utmTitle}
          </CardTitle>
          <CardDescription>{t.utmDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={t.path} dir="ltr" value={utm.path} hint={t.pathHint} onChange={(e) => setUtm({ ...utm, path: e.target.value })} />
            <TextField label={t.source} dir="ltr" value={utm.source} onChange={(e) => setUtm({ ...utm, source: e.target.value })} />
            <TextField label={t.medium} dir="ltr" value={utm.medium} onChange={(e) => setUtm({ ...utm, medium: e.target.value })} />
            <TextField label={t.campaign} dir="ltr" value={utm.campaign} onChange={(e) => setUtm({ ...utm, campaign: e.target.value })} />
            <TextField label={t.content} dir="ltr" value={utm.content} onChange={(e) => setUtm({ ...utm, content: e.target.value })} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">{t.result}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <code dir="ltr" className="min-w-0 flex-1 break-all rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink">
                {link}
              </code>
              <Button type="button" variant="outline" onClick={() => void copyLink()}>
                {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied ? t.copied : t.copy}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
