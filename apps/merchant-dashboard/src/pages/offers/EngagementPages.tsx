import { useState, type ReactNode } from "react";
import { Copy } from "lucide-react";
import { Alert, Button, Card, Input, Label } from "@store-builder/ui";
import {
  engagementGetNewsletter,
  engagementGetSocialProof,
  engagementReferrals,
  engagementSaveNewsletter,
  engagementSaveSocialProof,
  type EngagementNewsletter,
  type EngagementSocialProof,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney } from "@/lib/format";
import { storeUrl } from "@/lib/storeAddress";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Select } from "@/components/Select";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { ProductSelect, useStoreProducts } from "./OfferRuleParts";

/**
 * Three small screens of the offers hub (SPEC §10.7–10.9): sales
 * notifications built from real orders, the newsletter sign-up form, and
 * referral links with what each one brought in.
 */

const STRINGS = {
  en: {
    back: "Offers",
    save: "Save",
    saving: "Saving…",
    saved: "Saved.",
    seconds: "seconds",
    // social proof
    spTitle: "Sales notifications",
    spDescription: "A small popup: “Ahmed from Mansoura bought this 12 minutes ago”. Only real, confirmed orders of the last 7 days are ever shown.",
    spEnabled: "Show sales notifications",
    spEnough: "{count} confirmed orders in the last 7 days can be shown.",
    spNotEnough: "Only {count} confirmed orders in the last 7 days. With fewer than {min}, your store shows nothing — it never invents names.",
    spPosition: "Corner",
    spPosition_bottom_start: "Bottom, start side",
    spPosition_bottom_end: "Bottom, end side",
    spPages: "On",
    spPages_all: "Every page",
    spPages_product: "Product pages",
    spDelay: "First one after (seconds)",
    spInterval: "Then every (seconds)",
    spMax: "At most per visit",
    spShowName: "Show the customer's first name",
    spShowCity: "Show the governorate",
    // newsletter
    nlTitle: "Newsletter sign-up",
    nlDescription: "A form that collects a mobile number (and name or email) from visitors who want to hear from you. Each one becomes a contact with marketing consent.",
    nlEnabled: "Show the sign-up form",
    nlPlacement: "Where",
    nlPlacement_footer: "Above the footer",
    nlPlacement_popup: "A popup after a delay",
    nlDelay: "Popup delay (seconds)",
    nlHeading: "Title",
    nlHeadingPlaceholder: "Be the first to know",
    nlText: "Text",
    nlTextPlaceholder: "New arrivals and offers, on WhatsApp.",
    nlAskName: "Ask for the name",
    nlAskEmail: "Ask for the email",
    nlCoupon: "Coupon for subscribers",
    nlCouponNone: "No coupon",
    nlCouponHint: "Shown to the visitor right after they subscribe.",
    // referrals
    rfTitle: "Referral links",
    rfDescription: "Give each marketer a link of their own and see the orders it brought.",
    rfBuild: "Build a link",
    rfCode: "Marketer's code",
    rfCodePlaceholder: "ahmed1",
    rfCodeHint: "Letters, digits, - and _. It is what appears in the report.",
    rfProduct: "Send visitors to",
    rfWholeStore: "The store's home page",
    rfLink: "The link",
    rfCopy: "Copy link",
    rfCopied: "Link copied.",
    rfResults: "Results — last {days} days",
    rfEmpty: "No orders have come through a referral link yet.",
    rfColCode: "Code",
    rfColOrders: "Orders",
    rfColConfirmed: "Confirmed",
    rfColRevenue: "Sales",
    rfColLast: "Last order",
  },
  ar: {
    back: "العروض",
    save: "حفظ",
    saving: "بنحفظ…",
    saved: "اتحفظ.",
    seconds: "ثانية",
    spTitle: "إشعارات المبيعات",
    spDescription: "نافذة صغيرة: «أحمد من المنصورة اشترى هذا منذ 12 دقيقة». لا يُعرض إلا أوردرات حقيقية مؤكدة من آخر 7 أيام.",
    spEnabled: "إظهار إشعارات المبيعات",
    spEnough: "{count} أوردر مؤكد في آخر 7 أيام يمكن عرضه.",
    spNotEnough: "{count} أوردر مؤكد فقط في آخر 7 أيام. بأقل من {min} لا يعرض متجرك شيئًا — لا يختلق أسماء أبدًا.",
    spPosition: "المكان",
    spPosition_bottom_start: "أسفل، جهة البداية",
    spPosition_bottom_end: "أسفل، جهة النهاية",
    spPages: "في",
    spPages_all: "كل الصفحات",
    spPages_product: "صفحات المنتجات",
    spDelay: "أول إشعار بعد (ثانية)",
    spInterval: "ثم كل (ثانية)",
    spMax: "الحد الأقصى في الزيارة",
    spShowName: "إظهار الاسم الأول للعميل",
    spShowCity: "إظهار المحافظة",
    nlTitle: "الاشتراك في النشرة",
    nlDescription: "فورم يجمع رقم الموبايل (والاسم أو الإيميل) من الزوار الذين يريدون متابعتك. كل مشترك يصبح جهة اتصال موافقة على التسويق.",
    nlEnabled: "إظهار فورم الاشتراك",
    nlPlacement: "المكان",
    nlPlacement_footer: "فوق الفوتر",
    nlPlacement_popup: "نافذة بعد مدة",
    nlDelay: "مدة ظهور النافذة (ثانية)",
    nlHeading: "العنوان",
    nlHeadingPlaceholder: "كن أول من يعرف",
    nlText: "النص",
    nlTextPlaceholder: "المنتجات الجديدة والعروض، على واتساب.",
    nlAskName: "طلب الاسم",
    nlAskEmail: "طلب الإيميل",
    nlCoupon: "كوبون للمشتركين",
    nlCouponNone: "بدون كوبون",
    nlCouponHint: "يظهر للزائر فور اشتراكه.",
    rfTitle: "روابط الإحالة",
    rfDescription: "أعطِ كل مسوّق رابطًا خاصًا به وشاهد الأوردرات التي جاءت منه.",
    rfBuild: "إنشاء رابط",
    rfCode: "كود المسوّق",
    rfCodePlaceholder: "ahmed1",
    rfCodeHint: "حروف وأرقام و- و_. هو ما يظهر في التقرير.",
    rfProduct: "يوجّه الزائر إلى",
    rfWholeStore: "الصفحة الرئيسية للمتجر",
    rfLink: "الرابط",
    rfCopy: "نسخ الرابط",
    rfCopied: "اتنسخ اللينك.",
    rfResults: "النتائج — آخر {days} يوم",
    rfEmpty: "لم تأتِ أوردرات من روابط الإحالة بعد.",
    rfColCode: "الكود",
    rfColOrders: "الأوردرات",
    rfColConfirmed: "المؤكدة",
    rfColRevenue: "المبيعات",
    rfColLast: "آخر أوردر",
  },
} satisfies Messages;

function Toggle({ checked, onChange, disabled, children }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
      <input type="checkbox" className="size-4 accent-primary" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

const clampInt = (value: string, min: number, max: number) => Math.min(max, Math.max(min, Number.parseInt(value, 10) || min));

/** The save row every settings card ends with. */
function SaveRow({ busy, error, onSave }: { busy: boolean; error: string | null; onSave: () => void }) {
  const t = useT(STRINGS);
  return (
    <>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="flex justify-end">
        <Button type="button" disabled={busy} onClick={onSave}>
          {busy ? t.saving : t.save}
        </Button>
      </div>
    </>
  );
}

// ------------------------------------------------------------ social proof --

export function SocialProofPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [draft, setDraft] = useState<EngagementSocialProof | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = useAsync(async () => {
    const loaded = await engagementGetSocialProof(apiClient, workspaceId);
    setDraft(loaded.socialProof);
    return loaded;
  }, [workspaceId]);
  const set = <K extends keyof EngagementSocialProof>(key: K, value: EngagementSocialProof[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      setDraft(await engagementSaveSocialProof(apiClient, workspaceId, draft));
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const real = state.data?.realOrders ?? 0;
  const min = state.data?.minimumOrders ?? 3;

  return (
    <div className="max-w-2xl">
      <PageHeader title={t.spTitle} description={t.spDescription} back={{ to: "/offers", label: t.back }} />
      <DataState loading={state.loading} error={state.error} onRetry={() => state.refresh()}>
        {draft && (
          <Card className="space-y-4 p-5">
            <Alert variant={real >= min ? "success" : "info"}>
              {fmt(real >= min ? t.spEnough : t.spNotEnough, { count: real, min })}
            </Alert>
            <Toggle checked={draft.enabled} disabled={busy} onChange={(v) => set("enabled", v)}>
              <span className="font-medium">{t.spEnabled}</span>
            </Toggle>
            <fieldset disabled={busy || !draft.enabled} className="space-y-4 disabled:opacity-60">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sp-position">{t.spPosition}</Label>
                  <Select id="sp-position" value={draft.position} onChange={(e) => set("position", e.target.value as EngagementSocialProof["position"])}>
                    <option value="bottom_start">{t.spPosition_bottom_start}</option>
                    <option value="bottom_end">{t.spPosition_bottom_end}</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sp-pages">{t.spPages}</Label>
                  <Select id="sp-pages" value={draft.pages} onChange={(e) => set("pages", e.target.value as EngagementSocialProof["pages"])}>
                    <option value="all">{t.spPages_all}</option>
                    <option value="product">{t.spPages_product}</option>
                  </Select>
                </div>
                <TextField label={t.spDelay} type="number" inputMode="numeric" min={1} max={120} value={String(draft.delaySeconds)} onChange={(e) => set("delaySeconds", clampInt(e.target.value, 1, 120))} />
                <TextField label={t.spInterval} type="number" inputMode="numeric" min={5} max={300} value={String(draft.intervalSeconds)} onChange={(e) => set("intervalSeconds", clampInt(e.target.value, 5, 300))} />
                <TextField label={t.spMax} type="number" inputMode="numeric" min={1} max={20} value={String(draft.maxPerSession)} onChange={(e) => set("maxPerSession", clampInt(e.target.value, 1, 20))} />
              </div>
              <div>
                <Toggle checked={draft.showName} onChange={(v) => set("showName", v)}>
                  {t.spShowName}
                </Toggle>
                <Toggle checked={draft.showCity} onChange={(v) => set("showCity", v)}>
                  {t.spShowCity}
                </Toggle>
              </div>
            </fieldset>
            <SaveRow busy={busy} error={error} onSave={() => void save()} />
          </Card>
        )}
      </DataState>
    </div>
  );
}

// --------------------------------------------------------------- newsletter --

export function NewsletterPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [draft, setDraft] = useState<EngagementNewsletter | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = useAsync(async () => {
    const [settings, discounts] = await Promise.all([engagementGetNewsletter(apiClient, workspaceId), apiClient.listDiscounts(workspaceId)]);
    setDraft(settings);
    return discounts.filter((d) => d.code);
  }, [workspaceId]);
  const set = <K extends keyof EngagementNewsletter>(key: K, value: EngagementNewsletter[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      setDraft(await engagementSaveNewsletter(apiClient, workspaceId, draft));
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title={t.nlTitle} description={t.nlDescription} back={{ to: "/offers", label: t.back }} />
      <DataState loading={data.loading} error={data.error} onRetry={() => data.refresh()}>
        {draft && (
          <Card className="space-y-4 p-5">
            <Toggle checked={draft.enabled} disabled={busy} onChange={(v) => set("enabled", v)}>
              <span className="font-medium">{t.nlEnabled}</span>
            </Toggle>
            <fieldset disabled={busy || !draft.enabled} className="space-y-4 disabled:opacity-60">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nl-placement">{t.nlPlacement}</Label>
                  <Select id="nl-placement" value={draft.placement} onChange={(e) => set("placement", e.target.value as EngagementNewsletter["placement"])}>
                    <option value="footer">{t.nlPlacement_footer}</option>
                    <option value="popup">{t.nlPlacement_popup}</option>
                  </Select>
                </div>
                {draft.placement === "popup" && (
                  <TextField label={t.nlDelay} type="number" inputMode="numeric" min={3} max={600} value={String(draft.delaySeconds)} onChange={(e) => set("delaySeconds", clampInt(e.target.value, 3, 600))} />
                )}
              </div>
              <TextField label={t.nlHeading} maxLength={120} placeholder={t.nlHeadingPlaceholder} value={draft.title ?? ""} onChange={(e) => set("title", e.target.value)} />
              <TextField label={t.nlText} maxLength={300} placeholder={t.nlTextPlaceholder} value={draft.text ?? ""} onChange={(e) => set("text", e.target.value)} />
              <div>
                <Toggle checked={draft.askName} onChange={(v) => set("askName", v)}>
                  {t.nlAskName}
                </Toggle>
                <Toggle checked={draft.askEmail} onChange={(v) => set("askEmail", v)}>
                  {t.nlAskEmail}
                </Toggle>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-coupon">{t.nlCoupon}</Label>
                <Select id="nl-coupon" value={draft.discountId ?? ""} onChange={(e) => set("discountId", e.target.value || null)}>
                  <option value="">{t.nlCouponNone}</option>
                  {(data.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-ink-soft">{t.nlCouponHint}</p>
              </div>
            </fieldset>
            <SaveRow busy={busy} error={error} onSave={() => void save()} />
          </Card>
        )}
      </DataState>
    </div>
  );
}

// ---------------------------------------------------------------- referrals --

const REFERRAL_DAYS = 30;

export function ReferralLinksPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const toast = useToast();
  const products = useStoreProducts();
  const results = useAsync(() => engagementReferrals(apiClient, workspaceId, REFERRAL_DAYS), [workspaceId]);
  const [code, setCode] = useState("");
  const [productId, setProductId] = useState<string | null>(null);

  const cleanCode = code.trim().replace(/[^A-Za-z0-9_-]/g, "");
  const product = (products.data ?? []).find((p) => p.id === productId);
  const baseUrl = currentWorkspace?.slug ? storeUrl(currentWorkspace.slug) : "";
  const link = cleanCode && baseUrl ? `${baseUrl}${product ? `/products/${product.slug}` : "/"}?ref=${encodeURIComponent(cleanCode)}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t.rfCopied);
    } catch {
      /* the link is on screen to select */
    }
  }

  const rows = results.data ?? [];

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title={t.rfTitle} description={t.rfDescription} back={{ to: "/offers", label: t.back }} />

      <Card className="space-y-4 p-5">
        <h2 className="font-medium text-ink">{t.rfBuild}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t.rfCode} hint={t.rfCodeHint} dir="ltr" maxLength={60} placeholder={t.rfCodePlaceholder} value={code} onChange={(e) => setCode(e.target.value)} />
          <ProductSelect
            id="ref-product"
            label={t.rfProduct}
            anyLabel={t.rfWholeStore}
            products={products.data ?? []}
            value={productId}
            onChange={setProductId}
            disabled={products.loading}
          />
        </div>
        {link && (
          <div className="space-y-1.5">
            <Label htmlFor="ref-link">{t.rfLink}</Label>
            <div className="flex gap-2">
              <Input id="ref-link" dir="ltr" readOnly value={link} onFocus={(e) => e.target.select()} className="min-w-0 flex-1" />
              <Button type="button" className="shrink-0" onClick={() => void copy()}>
                <Copy className="size-4" aria-hidden />
                {t.rfCopy}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-0">
        <h2 className="px-5 pt-5 font-medium text-ink">{fmt(t.rfResults, { days: REFERRAL_DAYS })}</h2>
        <div className="mt-3">
          <DataState loading={results.loading} error={results.error} onRetry={() => results.refresh()} empty={rows.length === 0} emptyMessage={t.rfEmpty}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-y border-line bg-paper text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-5 py-2 text-start font-medium">{t.rfColCode}</th>
                    <th className="px-3 py-2 text-start font-medium">{t.rfColOrders}</th>
                    <th className="px-3 py-2 text-start font-medium">{t.rfColConfirmed}</th>
                    <th className="px-3 py-2 text-start font-medium">{t.rfColRevenue}</th>
                    <th className="px-5 py-2 text-start font-medium">{t.rfColLast}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.ref} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 font-medium text-ink" dir="ltr">
                        {row.ref}
                      </td>
                      <td className="px-3 py-3 text-ink">{row.orders}</td>
                      <td className="px-3 py-3 text-ink">{row.confirmedOrders}</td>
                      <td className="px-3 py-3 text-ink">{formatMoney(row.revenue)}</td>
                      <td className="px-5 py-3 text-ink-soft">{formatDate(row.lastOrderAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataState>
        </div>
      </Card>
    </div>
  );
}
