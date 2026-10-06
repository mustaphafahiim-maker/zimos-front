import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { Button } from "@store-builder/ui";
import {
  ApiError,
  aiApply,
  funnelsList,
  funnelsListSteps,
  type AiAdBanner,
  type AiAdCreativesOutput,
  type AiDialect,
  type AiPageReviewOutput,
  type AiStoreBuilderOutput,
  type Product,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "@/components/CopyButton";
import { useToast } from "@/components/Toast";
import { DialectField, SubmitRow, ToolLayout, useGeneration } from "./AiStudioPage";
import { ApplyPoliciesButton } from "./ApplyPoliciesButton";

/**
 * The AI studio's P2 tools (SPEC §19.2, item 97; backend ai/featuresP2.js):
 * page review, ad creatives and the store builder. The fourth P2 feature,
 * the suggested WhatsApp reply, lives in the inbox (SuggestReplyButton).
 */

const STRINGS = {
  en: {
    reviewSource: "What to review",
    reviewPage: "A store page",
    reviewStep: "A funnel step",
    page: "Page",
    choosePage: "Choose a page…",
    funnel: "Funnel",
    chooseFunnel: "Choose a funnel…",
    step: "Step",
    chooseStep: "Choose a step…",
    score: "Score",
    reviewNote: "Read from the page and its last 30 days. Change the page in the editor, then review it again.",
    severity_high: "Important",
    severity_medium: "Worth doing",
    severity_low: "Nice to have",
    noRecommendations: "Nothing to fix — the basics are there.",
    product: "Product",
    chooseProduct: "Choose a product…",
    platform: "Platform",
    angle: "Angle (optional)",
    angleHint: "e.g. a gift for mothers, back to school.",
    headlines: "Headlines",
    texts: "Ad texts",
    banners: "Banners",
    noBanners: "Add pictures to the product to get banners on them.",
    download: "Download PNG",
    downloadFailed: "This picture can't be saved from here — take a screenshot of the banner instead.",
    niche: "What the store sells",
    storeName: "Store name",
    color: "Brand colour",
    theme: "Suggested theme",
    themeHint: "Switch it on from Website → theme gallery when you like it.",
    home: "Home page",
    collections: "Collections",
    policies: "Policies",
    policy_shipping: "Shipping",
    policy_returns: "Returns",
    policy_privacy: "Privacy",
    sections: "{count} sections",
    createDrafts: "Create the drafts",
    draftsHint: "Adds the home page as an unpublished page and the collections as hidden ones. Your live store doesn't change.",
    draftsCreated: "Drafts created.",
    openPage: "Open the page in the editor",
    openCollections: "Open collections",
    goPolicies: "Open store policies",
    websiteRequired: "Create your store website first.",
    copy: "Copy",
  },
  ar: {
    reviewSource: "عايز تقيّم إيه",
    reviewPage: "صفحة في المتجر",
    reviewStep: "خطوة في مسار بيع",
    page: "الصفحة",
    choosePage: "اختر صفحة…",
    funnel: "مسار البيع",
    chooseFunnel: "اختر مسار بيع…",
    step: "الخطوة",
    chooseStep: "اختر خطوة…",
    score: "التقييم",
    reviewNote: "محسوب من الصفحة وآخر 30 يوم. عدّل الصفحة في المحرر وقيّمها تاني.",
    severity_high: "مهم",
    severity_medium: "يستاهل",
    severity_low: "إضافة حلوة",
    noRecommendations: "مفيش حاجة تتصلح — الأساسيات موجودة.",
    product: "المنتج",
    chooseProduct: "اختر منتج…",
    platform: "المنصة",
    angle: "الزاوية (اختياري)",
    angleHint: "مثلًا: هدية لعيد الأم، العودة للمدارس.",
    headlines: "العناوين",
    texts: "نصوص الإعلان",
    banners: "البانرات",
    noBanners: "ضيف صور للمنتج عشان تطلع بانرات عليها.",
    download: "تحميل PNG",
    downloadFailed: "الصورة دي مينفعش تتحفظ من هنا — خد سكرين شوت للبانر.",
    niche: "المتجر بيبيع إيه",
    storeName: "اسم المتجر",
    color: "لون البراند",
    theme: "الثيم المقترح",
    themeHint: "شغّله من الموقع ← معرض الثيمات لو عجبك.",
    home: "الصفحة الرئيسية",
    collections: "الأقسام",
    policies: "السياسات",
    policy_shipping: "الشحن",
    policy_returns: "الإرجاع",
    policy_privacy: "الخصوصية",
    sections: "{count} أقسام",
    createDrafts: "اعمل المسودات",
    draftsHint: "بيضيف الصفحة الرئيسية كصفحة مش منشورة والأقسام مخفية. متجرك اللايف مش بيتغير.",
    draftsCreated: "المسودات اتعملت.",
    openPage: "افتح الصفحة في المحرر",
    openCollections: "افتح الأقسام",
    goPolicies: "افتح سياسات المتجر",
    websiteRequired: "اعمل موقع متجرك الأول.",
    copy: "نسخ",
  },
} satisfies Messages;

const TONE = { high: "danger", medium: "warning", low: "neutral" } as const;

// --- page review -------------------------------------------------------------

export function PageReviewTool({ onDone }: { onDone: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const gen = useGeneration("page_review", onDone);
  const [source, setSource] = useState<"page" | "step">("page");
  const [pageId, setPageId] = useState("");
  const [funnelId, setFunnelId] = useState("");
  const [stepKey, setStepKey] = useState("");
  const [dialect, setDialect] = useState<AiDialect>("egyptian");
  const pages = useAsync(async () => {
    const websites = await apiClient.listWebsites(workspaceId);
    const site = websites[0];
    return site ? (await apiClient.getWebsite(workspaceId, site.id)).pages : [];
  }, [workspaceId]);
  const funnels = useAsync(() => funnelsList(apiClient, workspaceId), [workspaceId]);
  const steps = useAsync(async () => (funnelId ? funnelsListSteps(apiClient, workspaceId, funnelId) : []), [workspaceId, funnelId]);
  const output: AiPageReviewOutput | null = gen.job?.output ?? null;
  const ready = source === "page" ? Boolean(pageId) : Boolean(funnelId && stepKey);

  function submit(e: FormEvent) {
    e.preventDefault();
    void gen.run(source === "page" ? { source, pageId, dialect } : { source, funnelId, stepKey, dialect });
  }

  return (
    <ToolLayout
      busy={gen.busy}
      error={gen.error}
      form={
        <form onSubmit={submit} className="space-y-4">
          <Field label={t.reviewSource}>
            {(props) => (
              <Select {...props} value={source} onChange={(e) => setSource(e.target.value as "page" | "step")}>
                <option value="page">{t.reviewPage}</option>
                <option value="step">{t.reviewStep}</option>
              </Select>
            )}
          </Field>
          {source === "page" ? (
            <Field label={t.page} required>
              {(props) => (
                <Select {...props} value={pageId} onChange={(e) => setPageId(e.target.value)}>
                  <option value="">{t.choosePage}</option>
                  {(pages.data ?? []).map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.title || page.path} ({page.path})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : (
            <>
              <Field label={t.funnel} required>
                {(props) => (
                  <Select
                    {...props}
                    value={funnelId}
                    onChange={(e) => {
                      setFunnelId(e.target.value);
                      setStepKey("");
                    }}
                  >
                    <option value="">{t.chooseFunnel}</option>
                    {(funnels.data ?? []).map((funnel) => (
                      <option key={funnel.id} value={funnel.id}>
                        {funnel.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t.step} required>
                {(props) => (
                  <Select {...props} value={stepKey} onChange={(e) => setStepKey(e.target.value)} disabled={!funnelId}>
                    <option value="">{t.chooseStep}</option>
                    {(steps.data ?? []).map((step) => (
                      <option key={step.key} value={step.key}>
                        {step.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </>
          )}
          <DialectField value={dialect} onChange={setDialect} />
          <SubmitRow busy={gen.busy} hasResult={Boolean(gen.job)} disabled={!ready} />
        </form>
      }
      result={
        output && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div
                className={`flex size-16 shrink-0 items-center justify-center rounded-full border-4 text-xl font-bold ${output.score >= 75 ? "border-success text-success" : output.score >= 50 ? "border-warning text-warning" : "border-danger text-danger"}`}
                aria-label={`${t.score}: ${output.score}/100`}
              >
                {output.score}
              </div>
              <p dir="auto" className="text-sm text-ink">
                {output.summary}
              </p>
            </div>
            {output.recommendations.length === 0 ? (
              <p className="text-sm text-ink-soft">{t.noRecommendations}</p>
            ) : (
              <ol className="space-y-2">
                {output.recommendations.map((rec, i) => (
                  <li key={i} className="rounded-[var(--radius-card)] border border-line p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={rec.severity} tone={TONE[rec.severity]} text={t[`severity_${rec.severity}`]} />
                      <span dir="auto" className="text-sm font-semibold text-ink">
                        {rec.title}
                      </span>
                    </div>
                    {rec.detail && (
                      <p dir="auto" className="mt-1 text-sm text-ink-soft">
                        {rec.detail}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <p className="text-xs text-ink-soft">{t.reviewNote}</p>
          </div>
        )
      }
    />
  );
}

// --- ad creatives ------------------------------------------------------------

const BANNER_SIZE: Record<AiAdBanner["format"], { w: number; h: number; aspect: string }> = {
  square: { w: 1080, h: 1080, aspect: "aspect-square" },
  story: { w: 1080, h: 1920, aspect: "aspect-[9/16]" },
  landscape: { w: 1200, h: 628, aspect: "aspect-[1200/628]" },
};

/** Draws the banner (picture, darkened foot, headline, line, badge) at the platform's size and saves it. */
async function downloadBanner(banner: AiAdBanner, rtl: boolean): Promise<void> {
  const size = BANNER_SIZE[banner.format];
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = banner.imageUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  const scale = Math.max(size.w / img.width, size.h / img.height);
  ctx.drawImage(img, (size.w - img.width * scale) / 2, (size.h - img.height * scale) / 2, img.width * scale, img.height * scale);
  const foot = ctx.createLinearGradient(0, size.h * 0.5, 0, size.h);
  foot.addColorStop(0, "rgba(0,0,0,0)");
  foot.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = foot;
  ctx.fillRect(0, 0, size.w, size.h);
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  const x = rtl ? size.w - 60 : 60;
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.round(size.w / 14)}px system-ui, sans-serif`;
  ctx.fillText(banner.headline, x, size.h - 140, size.w - 120);
  ctx.font = `${Math.round(size.w / 26)}px system-ui, sans-serif`;
  ctx.fillText(banner.subline, x, size.h - 80, size.w - 120);
  if (banner.badge) {
    ctx.font = `bold ${Math.round(size.w / 30)}px system-ui, sans-serif`;
    const width = ctx.measureText(banner.badge).width + 40;
    const bx = rtl ? size.w - 40 - width : 40;
    ctx.fillStyle = "#facc15";
    ctx.fillRect(bx, 40, width, 64);
    ctx.fillStyle = "#111";
    ctx.fillText(banner.badge, rtl ? bx + width - 20 : bx + 20, 84);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("not saved");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `banner-${banner.format}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdCreativesTool({ onDone }: { onDone: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const gen = useGeneration("ad_creatives", onDone);
  const products = useAsync(() => apiClient.listProducts(workspaceId, { limit: 100 }).then((r) => r.products), [workspaceId]);
  const [productId, setProductId] = useState("");
  const [platform, setPlatform] = useState<"facebook" | "instagram" | "tiktok">("facebook");
  const [angle, setAngle] = useState("");
  const [dialect, setDialect] = useState<AiDialect>("egyptian");
  const output: AiAdCreativesOutput | null = gen.job?.output ?? null;
  const rtl = dialect !== "english" && dialect !== "french";

  function submit(e: FormEvent) {
    e.preventDefault();
    void gen.run({ productId, platform, angle: angle.trim() || undefined, dialect });
  }

  return (
    <ToolLayout
      busy={gen.busy}
      error={gen.error}
      form={
        <form onSubmit={submit} className="space-y-4">
          <Field label={t.product} required>
            {(props) => (
              <Select {...props} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">{t.chooseProduct}</option>
                {(products.data ?? []).map((product: Product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.platform}>
            {(props) => (
              <Select {...props} value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)}>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
              </Select>
            )}
          </Field>
          <TextField label={t.angle} hint={t.angleHint} value={angle} onChange={(e) => setAngle(e.target.value)} maxLength={300} />
          <DialectField value={dialect} onChange={setDialect} />
          <SubmitRow busy={gen.busy} hasResult={Boolean(gen.job)} disabled={!productId} />
        </form>
      }
      result={
        output && (
          <div className="space-y-5">
            <section>
              <h3 className="text-sm font-semibold text-ink">{t.headlines}</h3>
              <ul className="mt-2 space-y-1.5">
                {output.headlines.map((line, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-[0.5rem] bg-paper px-3 py-2">
                    <span dir="auto" className="text-sm text-ink">
                      {line}
                    </span>
                    <CopyButton value={line} label={t.copy} />
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-ink">{t.texts}</h3>
              <ul className="mt-2 space-y-2">
                {output.primaryTexts.map((text, i) => (
                  <li key={i} className="rounded-[0.5rem] bg-paper px-3 py-2">
                    <div className="flex justify-end">
                      <CopyButton value={text} label={t.copy} />
                    </div>
                    <p dir="auto" className="whitespace-pre-wrap text-sm text-ink">
                      {text}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-ink">{t.banners}</h3>
              {output.banners.length === 0 ? (
                <p className="mt-1 text-sm text-ink-soft">{t.noBanners}</p>
              ) : (
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {output.banners.map((banner, i) => (
                    <figure key={i} className="space-y-2">
                      <div dir={rtl ? "rtl" : "ltr"} className={`relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper ${BANNER_SIZE[banner.format].aspect}`}>
                        <img src={banner.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/75" />
                        {banner.badge && <span className="absolute start-3 top-3 rounded bg-yellow-400 px-2 py-1 text-xs font-bold text-black">{banner.badge}</span>}
                        <figcaption className="absolute inset-x-3 bottom-3 text-white">
                          <p className="text-lg font-bold leading-tight">{banner.headline}</p>
                          {banner.subline && <p className="text-sm opacity-90">{banner.subline}</p>}
                        </figcaption>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void downloadBanner(banner, rtl).catch(() => toast.error(t.downloadFailed))}
                      >
                        <Download className="size-4" aria-hidden /> {t.download}
                      </Button>
                    </figure>
                  ))}
                </div>
              )}
            </section>
          </div>
        )
      }
    />
  );
}

// --- store builder -----------------------------------------------------------

export function StoreBuilderTool({ onDone }: { onDone: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const gen = useGeneration("store_builder", onDone);
  const [niche, setNiche] = useState("");
  const [storeName, setStoreName] = useState(currentWorkspace?.name ?? "");
  const [color, setColor] = useState("#2563eb");
  const [dialect, setDialect] = useState<AiDialect>("egyptian");
  const [applying, setApplying] = useState(false);
  const output: AiStoreBuilderOutput | null = gen.job?.output ?? null;
  const applied = gen.job?.applied?.type === "store" ? gen.job.applied : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    void gen.run({ niche: niche.trim(), storeName: storeName.trim(), color, dialect });
  }

  async function apply() {
    if (!gen.job) return;
    setApplying(true);
    gen.setError(null);
    try {
      gen.setJob(await aiApply<"store_builder">(apiClient, workspaceId, gen.job.id, {}));
      toast.success(t.draftsCreated);
    } catch (err) {
      gen.setError(err instanceof ApiError && err.code === "WEBSITE_REQUIRED" ? t.websiteRequired : errorMessage(err));
    } finally {
      setApplying(false);
    }
  }

  return (
    <ToolLayout
      busy={gen.busy}
      error={gen.error}
      form={
        <form onSubmit={submit} className="space-y-4">
          <TextField label={t.niche} value={niche} onChange={(e) => setNiche(e.target.value)} maxLength={200} required />
          <TextField label={t.storeName} value={storeName} onChange={(e) => setStoreName(e.target.value)} maxLength={200} required />
          <Field label={t.color}>
            {(props) => (
              <div className="flex items-center gap-2">
                <input {...props} type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-14 cursor-pointer rounded border border-line bg-transparent" />
                <code dir="ltr" className="text-sm text-ink-soft">
                  {color}
                </code>
              </div>
            )}
          </Field>
          <DialectField value={dialect} onChange={setDialect} />
          <SubmitRow busy={gen.busy} hasResult={Boolean(gen.job)} disabled={niche.trim().length < 2 || !storeName.trim()} />
        </form>
      }
      result={
        output && (
          <div className="space-y-5">
            <section>
              <h3 className="text-sm font-semibold text-ink">{t.theme}</h3>
              <div className="mt-1 flex items-center gap-2">
                <span className="size-6 rounded-full border border-line" style={{ backgroundColor: output.theme.primaryColor }} aria-hidden />
                <code dir="ltr" className="text-sm text-ink">
                  {output.theme.key} · {output.theme.primaryColor}
                </code>
              </div>
              <p className="mt-1 text-xs text-ink-soft">{t.themeHint}</p>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-ink">{t.home}</h3>
              <p dir="auto" className="text-sm text-ink">
                {output.home.title} <span className="text-xs text-ink-soft">· {fmt(t.sections, { count: output.home.tree.sections.length })}</span>
              </p>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-ink">{t.collections}</h3>
              <ul className="mt-1 list-inside list-disc text-sm text-ink">
                {output.collections.map((c, i) => (
                  <li key={i} dir="auto">
                    {c.name}
                  </li>
                ))}
              </ul>
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">{t.policies}</h3>
              {(["shipping", "returns", "privacy"] as const).map((key) => (
                <div key={key}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ink-soft">{t[`policy_${key}`]}</span>
                    <CopyButton value={output.policies[key]} label={t.copy} />
                  </div>
                  <p dir="auto" className="whitespace-pre-wrap text-sm text-ink">
                    {output.policies[key]}
                  </p>
                </div>
              ))}
              {gen.job && <ApplyPoliciesButton key={gen.job.id} jobId={gen.job.id} />}
            </section>
            {applied ? (
              <div className="flex flex-wrap gap-3 text-sm">
                <Link to={`/website/${applied.websiteId}/edit`} className="font-medium text-primary hover:underline">
                  {t.openPage} →
                </Link>
                <Link to="/catalog/collections" className="font-medium text-primary hover:underline">
                  {t.openCollections} →
                </Link>
                <Link to="/store-settings" className="font-medium text-primary hover:underline">
                  {t.goPolicies} →
                </Link>
              </div>
            ) : (
              <div className="space-y-2 border-t border-line pt-4">
                <p className="text-xs text-ink-soft">{t.draftsHint}</p>
                <Button type="button" onClick={() => void apply()} disabled={applying}>
                  {t.createDrafts}
                </Button>
              </div>
            )}
          </div>
        )
      }
    />
  );
}
