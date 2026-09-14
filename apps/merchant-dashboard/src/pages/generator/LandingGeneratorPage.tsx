import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Info, Pencil, Plus, RefreshCw, Trash2, Upload, X } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  SegmentedControl,
  Skeleton,
  buttonVariants,
  cn,
} from "@store-builder/ui";
import type { ProductMedia, WebsitePage } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ApiError, getErrorMessage } from "@/lib/errors";
import { majorToMinor, minorToMajorInput, parseMoney } from "@/lib/format";
import { compressImageIfNeeded, validateImageFile, ACCEPTED_IMAGE_ACCEPT, mediaSrc } from "@/lib/media";
import { DEFAULT_PRIMARY, normalizeHex, readThemeColor } from "@/lib/brandColors";
import { PageHeader } from "@/components/PageHeader";
import { Field, TextField } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { Toggle } from "@/components/Toggle";
import { ColorField } from "@/components/ColorField";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { useLocale, useT } from "@/i18n/LocaleContext";
import { formatPagePrice, generateCopy } from "./copyEngine";
import { LandingPreview } from "./preview";
import { CATEGORY_LABELS, LANG_LABELS, SECTION_LABELS, STRINGS, TONE_LABELS } from "./strings";
import {
  PATH_PATTERN,
  RESERVED_SEGMENTS,
  buildTree,
  countdownHours,
  findTextProp,
  sectionAvailable,
  sectionKeyOf,
} from "./treeBuilder";
import {
  SECTION_KEYS,
  type Brief,
  type Category,
  type Overrides,
  type PageLang,
  type QA,
  type Quote,
  type SectionKey,
  type Seeds,
  type StyleOptions,
  type Tone,
} from "./types";

const STOREFRONT_URL = ((import.meta.env.VITE_STOREFRONT_URL as string | undefined) ?? "http://localhost:3000").replace(/\/+$/, "");

const TONES: Tone[] = ["confident", "friendly", "premium", "urgent"];
const CATEGORIES: Category[] = ["fashion", "electronics", "home", "beauty", "food", "kids", "other"];
const LANGS: PageLang[] = ["ar-eg", "ar-gulf", "en"];
const DEFAULT_SECTIONS: Record<SectionKey, boolean> = {
  hero: true,
  benefits: true,
  how: true,
  box: true,
  proof: true,
  guarantee: true,
  faq: true,
  cta: true,
  sticky: true,
};

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

function freshSeeds(): Seeds {
  return Object.fromEntries(SECTION_KEYS.map((k) => [k, randomSeed()])) as Seeds;
}

/** Latin-only URL slug; Arabic names fall back to a stable "landing-xxxx" slug. */
function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug.length >= 3) return slug.slice(0, 80);
  if (!name.trim()) return "";
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `landing-${h.toString(36).slice(0, 6)}`;
}

interface ApiDetail {
  field?: string;
  message: string;
  path?: string;
  pageId?: string;
}

function detailsOf(err: ApiError): ApiDetail[] {
  const body = err.details as { error?: { details?: unknown } } | undefined;
  return Array.isArray(body?.error?.details) ? (body!.error!.details as ApiDetail[]) : [];
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function LandingGeneratorPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const wid = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const toast = useToast();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";

  const products = useAsync(() => apiClient.listProducts(wid, { limit: 50 }).then((r) => r.products), [wid]);
  const websites = useAsync(() => apiClient.listWebsites(wid), [wid]);

  // --- brief ---
  const [productId, setProductId] = useState("");
  const [productSlug, setProductSlug] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [compareAt, setCompareAt] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<ProductMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [benefits, setBenefits] = useState<string[]>(["", "", ""]);
  const [audience, setAudience] = useState("");
  const [problem, setProblem] = useState("");
  const [box, setBox] = useState("");
  const [delivery, setDelivery] = useState("");
  const [returns, setReturns] = useState("");
  const [guarantee, setGuarantee] = useState("");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [faqs, setFaqs] = useState<QA[]>([]);

  // --- style ---
  const [lang, setLang] = useState<PageLang>("ar-eg");
  const [tone, setTone] = useState<Tone>("confident");
  const [category, setCategory] = useState<Category>("other");
  const brandAccent = readThemeColor(currentWorkspace?.themeSettings, "primaryColor", DEFAULT_PRIMARY);
  const [accentDraft, setAccentDraft] = useState<string | null>(null);
  const accent = normalizeHex(accentDraft ?? brandAccent) ?? brandAccent;
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [countdownOn, setCountdownOn] = useState(false);
  const [countdownEnd, setCountdownEnd] = useState("");

  // --- target ---
  const [websiteId, setWebsiteId] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [creatingSite, setCreatingSite] = useState(false);

  useEffect(() => {
    if (!websiteId && websites.data && websites.data.length > 0) setWebsiteId(websites.data[0].id);
  }, [websites.data, websiteId]);
  const websiteDetail = useAsync(
    () => (websiteId ? apiClient.getWebsite(wid, websiteId) : Promise.resolve(null)),
    [wid, websiteId]
  );

  // --- generation ---
  const [seeds, setSeeds] = useState<Seeds>(freshSeeds);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [mobile, setMobile] = useState<"mobile" | "desktop">("mobile");

  // --- save ---
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState<null | "draft" | "publish">(null);
  const [saveError, setSaveError] = useState<{ message: string; problems: string[] } | null>(null);
  const [apiFieldErrors, setApiFieldErrors] = useState<Record<string, string>>({});
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<SectionKey, string>>>({});
  const [savedPage, setSavedPage] = useState<WebsitePage | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const priceMinor = majorToMinor(price);
  const compareMinor = majorToMinor(compareAt);

  const brief: Brief = useMemo(
    () => ({
      productId: productId || null,
      productSlug: productId ? productSlug : null,
      name,
      priceMinor: Number.isFinite(priceMinor) && priceMinor > 0 ? priceMinor : null,
      compareAtMinor: Number.isFinite(compareMinor) && compareMinor > 0 ? compareMinor : null,
      currency,
      description,
      benefits,
      audience,
      problem,
      box,
      delivery,
      returns,
      guarantee,
      quotes,
      faqs,
      images,
    }),
    [productId, productSlug, name, priceMinor, compareMinor, currency, description, benefits, audience, problem, box, delivery, returns, guarantee, quotes, faqs, images]
  );
  const style: StyleOptions = useMemo(
    () => ({ lang, tone, category, accent, sections, countdownOn, countdownEnd }),
    [lang, tone, category, accent, sections, countdownOn, countdownEnd]
  );
  const copy = useMemo(() => generateCopy(brief, style, seeds), [brief, style, seeds]);
  const tree = useMemo(() => buildTree(brief, style, copy, overrides), [brief, style, copy, overrides]);

  const effectiveTitle = titleTouched ? title : name.trim();
  const effectiveSlug = (slugTouched ? slug : productSlug && productId ? productSlug : slugify(name)).trim().toLowerCase();
  const path = `/${effectiveSlug.replace(/^\/+|\/+$/g, "")}`;
  const existingPage = websiteDetail.data?.pages.find((p) => p.path === path) ?? null;
  const isLive = !!(savedPage?.path === path && savedPage.isLive) || !!existingPage?.isLive;

  // --- validation ---
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t.required;
    if (!(Number.isFinite(priceMinor) && priceMinor > 0)) e.price = t.errPrice;
    if (compareAt.trim() && !(Number.isFinite(compareMinor) && compareMinor > priceMinor)) e.compareAt = t.errCompare;
    if (benefits.filter((b) => b.trim()).length < 3) e.benefits = t.errBenefits;
    if (!delivery.trim()) e.delivery = t.required;
    if (!returns.trim()) e.returns = t.required;
    if (!websiteId) e.website = t.errWebsite;
    if (!effectiveTitle.trim()) e.title = t.required;
    if (!effectiveSlug || effectiveSlug.length > 290 || !PATH_PATTERN.test(effectiveSlug) || effectiveSlug.includes("//")) e.slug = t.errSlug;
    else if (RESERVED_SEGMENTS.includes(effectiveSlug.split("/")[0])) e.slug = t.errSlugReserved;
    if (countdownOn) {
      const end = new Date(countdownEnd).getTime();
      if (countdownHours(countdownEnd) === null || end - Date.now() > 8760 * 3_600_000) e.countdown = t.errCountdown;
    }
    return e;
  }, [name, priceMinor, compareAt, compareMinor, benefits, delivery, returns, websiteId, effectiveTitle, effectiveSlug, countdownOn, countdownEnd, t]);

  const fieldError = (key: string) => apiFieldErrors[key] ?? (submitted ? errors[key] : undefined);

  // --- handlers ---
  function pickProduct(id: string) {
    setProductId(id);
    if (!id) return;
    const p = products.data?.find((x) => x.id === id);
    if (!p) return;
    const variant = p.variants?.find((v) => v.status === "active") ?? p.variants?.[0];
    setName(p.name);
    setProductSlug(p.slug);
    setPrice(variant ? minorToMajorInput(variant.priceAmount) : "");
    setCompareAt(
      variant?.compareAtAmount && parseMoney(variant.compareAtAmount) > parseMoney(variant.priceAmount)
        ? minorToMajorInput(variant.compareAtAmount)
        : ""
    );
    setDescription(p.description ?? "");
    setImages(p.media ?? []);
  }

  async function uploadImages(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const original of Array.from(files)) {
        const file = await compressImageIfNeeded(original);
        const problemText = validateImageFile(file);
        if (problemText) {
          toast.error(problemText);
          continue;
        }
        const media = await apiClient.uploadMedia(wid, file);
        setImages((prev) => [...prev, media]);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function createSite() {
    setCreatingSite(true);
    try {
      const { website } = await apiClient.createWebsite(wid, { name: currentWorkspace?.name || "My store" });
      await websites.refresh({ silent: true });
      setWebsiteId(website.id);
      toast.success(t.websiteCreated);
    } catch (err) {
      toast.error(describeStatus(err) ?? getErrorMessage(err));
    } finally {
      setCreatingSite(false);
    }
  }

  function regenerate() {
    setSeeds(freshSeeds());
    setOverrides({});
  }

  function shuffle(key: SectionKey) {
    setSeeds((prev) => ({ ...prev, [key]: randomSeed() }));
    const prefix = `g-${key}-`;
    setOverrides((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !id.startsWith(prefix))));
  }

  function editElement(elementId: string, prop: string, value: string) {
    setOverrides((prev) => ({ ...prev, [elementId]: { ...(prev[elementId] ?? {}), [prop]: value } }));
  }

  function describeStatus(err: unknown): string | null {
    if (!(err instanceof ApiError)) return null;
    if (err.status === 402) return t.errSubscription;
    if (err.status === 403) return t.errPermission;
    return null;
  }

  function applyError(err: unknown, prefix?: string) {
    const fields: Record<string, string> = {};
    const secErrors: Partial<Record<SectionKey, string>> = {};
    const problems: string[] = [];
    let message = describeStatus(err) ?? getErrorMessage(err);

    if (err instanceof ApiError) {
      if (err.status === 409) {
        fields.slug = t.errPathTaken;
        message = t.errPathTaken;
      }
      for (const d of detailsOf(err)) {
        const m = /sections\[(\d+)\]/.exec(d.field ?? "");
        const samePage = !d.path || d.path === path;
        if (m && samePage) {
          const key = sectionKeyOf(tree.sections[Number(m[1])]?.id);
          if (key) secErrors[key] = d.message;
          problems.push(`${key ? SECTION_LABELS[locale][key] : d.field}: ${d.message}`);
        } else if (d.path) {
          problems.push(`${d.path}: ${d.message}`);
        } else if (d.field === "path") {
          fields.slug = d.message;
        } else if (d.field === "title") {
          fields.title = d.message;
        } else {
          problems.push(d.field ? `${d.field}: ${d.message}` : d.message);
        }
      }
      if (err.status === 422 && problems.length) message = t.errInvalid;
    }
    setApiFieldErrors(fields);
    setSectionErrors(secErrors);
    setSaveError({ message: prefix ? `${prefix} ${message}` : message, problems });
  }

  async function persist(): Promise<{ page: WebsitePage; created: boolean }> {
    // Rebuilt at save time so the countdown hours are measured from now.
    const freshTree = buildTree(brief, style, copy, overrides);
    const payload = {
      title: effectiveTitle.trim().slice(0, 200),
      draftData: freshTree,
      seo: {
        title: findTextProp(freshTree, "g-hero-h").slice(0, 300) || effectiveTitle.trim(),
        description: findTextProp(freshTree, "g-hero-sub").slice(0, 1000),
        ...(images[0] ? { image: images[0].url } : {}),
      },
    };
    const detail = await apiClient.getWebsite(wid, websiteId);
    const existing = detail.pages.find((p) => p.path === path);
    if (existing) return { page: await apiClient.updateWebsitePage(wid, websiteId, existing.id, payload), created: false };
    try {
      return { page: await apiClient.createPage(wid, websiteId, { path, pageType: "custom", ...payload }), created: true };
    } catch (err) {
      // Someone created the path between our read and write — update it instead.
      if (err instanceof ApiError && err.status === 409) {
        const again = await apiClient.getWebsite(wid, websiteId);
        const clash = again.pages.find((p) => p.path === path);
        if (clash) return { page: await apiClient.updateWebsitePage(wid, websiteId, clash.id, payload), created: false };
      }
      throw err;
    }
  }

  async function save(mode: "draft" | "publish") {
    setSubmitted(true);
    setApiFieldErrors({});
    setSectionErrors({});
    const blocking = { ...errors };
    if (mode === "publish" && !productId && sections.cta) blocking.product = t.errProductPublish;
    if (Object.keys(blocking).length > 0) {
      setSaveError({ message: blocking.product && Object.keys(blocking).length === 1 ? blocking.product : t.fixErrors, problems: [] });
      return;
    }
    setSaveError(null);
    setBusy(mode);
    let saved = false;
    try {
      const { page, created } = await persist();
      saved = true;
      setSavedPage(page);
      if (mode === "publish") {
        await apiClient.publishWebsite(wid, websiteId, `Landing page ${path}`);
        setSavedPage({ ...page, isLive: true });
        toast.success(t.publishedToast);
      } else {
        toast.success(created ? t.savedNew : t.savedUpdate);
      }
      void websiteDetail.refresh({ silent: true });
    } catch (err) {
      applyError(err, saved ? t.savedButPublishFailed : undefined);
      if (saved) void websiteDetail.refresh({ silent: true });
    } finally {
      setBusy(null);
    }
  }

  const productPreview = productId
    ? {
        name: name || "—",
        priceText: formatPagePrice(brief.priceMinor, currency, lang),
        compareText:
          brief.compareAtMinor && brief.priceMinor && brief.compareAtMinor > brief.priceMinor
            ? formatPagePrice(brief.compareAtMinor, currency, lang)
            : "",
        imageSrc: images[0] ? mediaSrc(images[0]) : null,
      }
    : null;

  const liveUrl = `${STOREFRONT_URL}/store/${wid}${path}`;

  return (
    <div>
      <PageHeader title={t.title} description={t.description} />

      <Alert className="mb-6 flex items-start gap-3">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="font-semibold text-ink">{t.honestyTitle}</p>
          <p className="mt-0.5 text-sm text-ink-soft">{t.honestyBody}</p>
        </div>
      </Alert>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,36rem)_minmax(0,1fr)]">
        {/* ------------------------------------------------ form column */}
        <div className="max-w-xl space-y-5">
          <Section title={t.stepProduct}>
            {products.loading ? (
              <Skeleton className="h-10 w-full" />
            ) : products.error ? (
              <Alert variant="danger">{describeStatus(products.error) ?? getErrorMessage(products.error)}</Alert>
            ) : (products.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-ink-soft">{t.noProducts}</p>
            ) : (
              <Field label={t.pickProduct} hint={t.productHint}>
                {({ id }) => (
                  <Select id={id} value={productId} onChange={(e) => pickProduct(e.target.value)}>
                    <option value="">{t.manualEntry}</option>
                    {products.data!.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            {!productId && !products.loading && <Alert variant="warning">{t.manualWarning}</Alert>}
          </Section>

          <Section title={t.stepBrief}>
            <TextField label={t.productName} required dir="auto" value={name} onChange={(e) => setName(e.target.value)} error={fieldError("name")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyInput label={t.price} required currency={currency} value={price} onChange={setPrice} error={fieldError("price")} />
              <MoneyInput label={t.compareAt} currency={currency} value={compareAt} onChange={setCompareAt} hint={t.compareAtHint} error={fieldError("compareAt")} />
            </div>
            <Field label={t.shortDescription}>
              {({ id }) => <Textarea id={id} dir="auto" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />}
            </Field>

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">{t.images}</p>
              <div className="flex flex-wrap gap-2">
                {images.map((m, i) => (
                  <div key={`${m.path}-${i}`} className="relative size-20 overflow-hidden rounded-xl border border-line">
                    <img src={mediaSrc(m)} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={t.removeImage}
                      className="absolute end-1 top-1 inline-flex size-6 cursor-pointer items-center justify-center rounded-full bg-zimos-navy/70 text-white"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </div>
                ))}
                <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong text-xs text-ink-soft hover:border-primary hover:text-primary">
                  <Upload className="size-4" aria-hidden />
                  {uploading ? t.uploading : t.uploadImage}
                  <input
                    type="file"
                    accept={ACCEPTED_IMAGE_ACCEPT}
                    multiple
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      void uploadImages(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">
                {t.benefits} <span className="text-danger">*</span>
              </p>
              {benefits.map((b, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    dir="auto"
                    value={b}
                    placeholder={t.benefitPlaceholder}
                    onChange={(e) => setBenefits((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                    className="flex h-10 w-full rounded-[10px] border border-input bg-paper-raised px-3 text-sm text-ink focus-visible:border-primary focus-visible:outline-none"
                  />
                  {benefits.length > 3 && (
                    <Button variant="outline" size="icon" aria-label={t.remove} onClick={() => setBenefits((prev) => prev.filter((_, j) => j !== i))}>
                      <Trash2 aria-hidden />
                    </Button>
                  )}
                </div>
              ))}
              {benefits.length < 6 && (
                <Button variant="outline" size="sm" onClick={() => setBenefits((prev) => [...prev, ""])}>
                  <Plus aria-hidden /> {t.addBenefit}
                </Button>
              )}
              {fieldError("benefits") && <p className="text-xs font-medium text-danger">{fieldError("benefits")}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={t.audience} dir="auto" placeholder={t.audiencePlaceholder} value={audience} onChange={(e) => setAudience(e.target.value)} />
              <TextField label={t.problem} dir="auto" placeholder={t.problemPlaceholder} value={problem} onChange={(e) => setProblem(e.target.value)} />
              <TextField label={t.delivery} required dir="auto" placeholder={t.deliveryPlaceholder} value={delivery} onChange={(e) => setDelivery(e.target.value)} error={fieldError("delivery")} />
              <TextField label={t.returns} required dir="auto" placeholder={t.returnsPlaceholder} value={returns} onChange={(e) => setReturns(e.target.value)} error={fieldError("returns")} />
            </div>
            <Field label={t.box} hint={t.boxHint}>
              {({ id }) => <Textarea id={id} dir="auto" rows={3} value={box} onChange={(e) => setBox(e.target.value)} />}
            </Field>
            <Field label={t.guarantee} hint={t.guaranteeHint}>
              {({ id }) => <Textarea id={id} dir="auto" rows={2} value={guarantee} onChange={(e) => setGuarantee(e.target.value)} />}
            </Field>

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">{t.quotes}</p>
              <p className="text-xs text-ink-muted">{t.quotesHint}</p>
              {quotes.map((q, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-line p-3">
                  <Textarea dir="auto" rows={2} placeholder={t.quote} value={q.quote} onChange={(e) => setQuotes((prev) => prev.map((x, j) => (j === i ? { ...x, quote: e.target.value } : x)))} />
                  <div className="flex gap-2">
                    <input
                      dir="auto"
                      placeholder={t.author}
                      value={q.author}
                      onChange={(e) => setQuotes((prev) => prev.map((x, j) => (j === i ? { ...x, author: e.target.value } : x)))}
                      className="flex h-10 w-full rounded-[10px] border border-input bg-paper-raised px-3 text-sm text-ink focus-visible:border-primary focus-visible:outline-none"
                    />
                    <Button variant="outline" size="icon" aria-label={t.remove} onClick={() => setQuotes((prev) => prev.filter((_, j) => j !== i))}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>
              ))}
              {quotes.length < 3 && (
                <Button variant="outline" size="sm" onClick={() => setQuotes((prev) => [...prev, { quote: "", author: "" }])}>
                  <Plus aria-hidden /> {t.addQuote}
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">{t.faqs}</p>
              {faqs.map((f, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-line p-3">
                  <div className="flex gap-2">
                    <input
                      dir="auto"
                      placeholder={t.question}
                      value={f.q}
                      onChange={(e) => setFaqs((prev) => prev.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))}
                      className="flex h-10 w-full rounded-[10px] border border-input bg-paper-raised px-3 text-sm text-ink focus-visible:border-primary focus-visible:outline-none"
                    />
                    <Button variant="outline" size="icon" aria-label={t.remove} onClick={() => setFaqs((prev) => prev.filter((_, j) => j !== i))}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  <Textarea dir="auto" rows={2} placeholder={t.answer} value={f.a} onChange={(e) => setFaqs((prev) => prev.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
                </div>
              ))}
              {faqs.length < 6 && (
                <Button variant="outline" size="sm" onClick={() => setFaqs((prev) => [...prev, { q: "", a: "" }])}>
                  <Plus aria-hidden /> {t.addFaq}
                </Button>
              )}
            </div>
          </Section>

          <Section title={t.stepStyle}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.pageLang} hint={t.langHint}>
                {({ id }) => (
                  <Select id={id} value={lang} onChange={(e) => setLang(e.target.value as PageLang)}>
                    {LANGS.map((l) => (
                      <option key={l} value={l}>
                        {LANG_LABELS[locale][l]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t.category}>
                {({ id }) => (
                  <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[locale][c]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ink">{t.tone}</p>
              <SegmentedControl
                ariaLabel={t.tone}
                size="sm"
                className="flex-wrap"
                value={tone}
                onChange={setTone}
                options={TONES.map((v) => ({ value: v, label: TONE_LABELS[locale][v] }))}
              />
            </div>
            <ColorField label={t.accent} hint={t.accentHint} value={accentDraft ?? brandAccent} onChange={setAccentDraft} />

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-ink">{t.sectionsLabel}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {SECTION_KEYS.map((key) => {
                  const available = sectionAvailable(key, brief);
                  const needs = key === "proof" ? t.needsQuotes : key === "box" ? t.needsBox : "";
                  return (
                    <label key={key} className="flex cursor-pointer items-start gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-[var(--primary)]"
                        checked={sections[key]}
                        onChange={(e) => setSections((prev) => ({ ...prev, [key]: e.target.checked }))}
                      />
                      <span>
                        {SECTION_LABELS[locale][key]}
                        {!available && needs && <span className="ms-1 text-xs text-ink-muted">({needs})</span>}
                        {key === "sticky" && <span className="block text-xs text-ink-muted">{t.stickyHint}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <Toggle label={t.countdown} description={t.countdownDesc} checked={countdownOn} onChange={setCountdownOn} />
            {countdownOn && (
              <div className="space-y-2">
                <TextField
                  label={t.countdownEnd}
                  type="datetime-local"
                  dir="ltr"
                  value={countdownEnd}
                  onChange={(e) => setCountdownEnd(e.target.value)}
                  error={fieldError("countdown") ?? (countdownEnd ? errors.countdown : undefined)}
                />
                <p className="text-xs text-ink-muted">{t.countdownWarn}</p>
              </div>
            )}
          </Section>

          <Section title={t.stepTarget}>
            {websites.loading ? (
              <Skeleton className="h-10 w-full" />
            ) : websites.error ? (
              <Alert variant="danger">{describeStatus(websites.error) ?? getErrorMessage(websites.error)}</Alert>
            ) : (websites.data?.length ?? 0) === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line-strong p-4">
                <p className="text-sm text-ink-soft">{t.noWebsites}</p>
                <Button size="sm" onClick={() => void createSite()} disabled={creatingSite}>
                  {creatingSite ? t.creatingWebsite : t.createWebsite}
                </Button>
              </div>
            ) : (
              <Field label={t.website} error={fieldError("website")}>
                {({ id }) => (
                  <Select id={id} value={websiteId} onChange={(e) => setWebsiteId(e.target.value)}>
                    {websites.data!.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.subdomain})
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <TextField
              label={t.pageTitle}
              required
              dir="auto"
              maxLength={200}
              value={effectiveTitle}
              onChange={(e) => {
                setTitleTouched(true);
                setTitle(e.target.value);
              }}
              error={fieldError("title")}
            />
            <TextField
              label={t.slug}
              required
              dir="ltr"
              placeholder="summer-blender"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
              }}
              error={fieldError("slug") ?? (effectiveSlug && errors.slug ? errors.slug : undefined)}
              hint={t.slugHint}
            />
            {websiteId && effectiveSlug && !errors.slug && (
              <p className="text-xs text-ink-muted" dir="auto">
                {existingPage ? t.existingPage : t.newPage}{" "}
                <span dir="ltr" className="font-mono">
                  {path}
                </span>
              </p>
            )}
          </Section>
        </div>

        {/* ------------------------------------------------ preview column */}
        <div className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">{t.preview}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                size="sm"
                value={mobile}
                onChange={setMobile}
                options={[
                  { value: "mobile", label: t.mobile },
                  { value: "desktop", label: t.desktop },
                ]}
              />
              <Button variant="outline" size="sm" onClick={regenerate}>
                <RefreshCw aria-hidden /> {t.regenerate}
              </Button>
            </div>
          </div>

          {saveError && (
            <Alert variant="danger">
              <p className="font-medium">{saveError.message}</p>
              {saveError.problems.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 ps-5 text-sm">
                  {saveError.problems.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void save("draft")} disabled={busy !== null}>
              {busy === "draft" ? t.saving : t.saveDraft}
            </Button>
            <Button variant="outline" onClick={() => setConfirmPublish(true)} disabled={busy !== null}>
              {busy === "publish" ? t.publishing : t.savePublish}
            </Button>
            {websiteId && (savedPage || existingPage) && (
              <Link to={`/website/${websiteId}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Pencil aria-hidden /> {t.openEditor}
              </Link>
            )}
            {isLive && (
              <a href={liveUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                <ExternalLink aria-hidden /> {t.viewLive}
              </a>
            )}
          </div>

          <LandingPreview
            tree={tree}
            mobile={mobile === "mobile"}
            dir={lang === "en" ? "ltr" : "rtl"}
            accent={accent}
            product={productPreview}
            sectionLabels={SECTION_LABELS[locale]}
            sectionErrors={sectionErrors}
            strings={{
              shuffle: t.shuffle,
              orderNow: lang === "en" ? "Order now" : "اطلب الآن",
              productNote: t.productNote,
              noProduct: t.noProduct,
              countdownNote: t.countdownNote,
              editHint: t.editHint,
            }}
            onShuffle={shuffle}
            onEdit={editElement}
          />
          {tree.sections.length === 0 && <p className="text-sm text-ink-muted">{t.fixErrors}</p>}
        </div>
      </div>

      <ConfirmDialog
        open={confirmPublish}
        title={t.publishTitle}
        description={t.publishBody}
        confirmLabel={t.publishConfirm}
        onCancel={() => setConfirmPublish(false)}
        onConfirm={async () => {
          setConfirmPublish(false);
          await save("publish");
        }}
      />
    </div>
  );
}
