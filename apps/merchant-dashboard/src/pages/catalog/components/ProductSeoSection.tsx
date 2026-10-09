import { useState } from "react";
import { Alert } from "@store-builder/ui";
import type { Product } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { storeHost } from "@/lib/storeAddress";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Field, TextField } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { SectionSaveBar } from "../product/saveQueue";
import { ProductPageCard } from "./ProductPageCard";

const STRINGS = {
  en: {
    title: "Search engines and sharing",
    barName: "search engines",
    description: "How this product appears on Google and when its link is shared. Empty fields use the product's name, description and first image.",
    seoTitle: "Page title",
    seoDescription: "Description",
    image: "Sharing image (link)",
    imageHint: "Shown when the link is shared on WhatsApp or Facebook. 1200×630 works best.",
    noindex: "Hide from search engines",
    noindexHint: "Google won't list this page and it leaves the sitemap; the link still works.",
    count: "{n} / {max}",
    preview: "Google preview",
    save: "Save",
    saving: "Saving…",
    saved: "Search settings saved.",
  },
  ar: {
    title: "محركات البحث والمشاركة",
    barName: "محركات البحث",
    description: "إزاي المنتج يظهر في جوجل ولما حد يشارك اللينك. الحقول الفاضية بتستخدم اسم المنتج ووصفه وأول صورة.",
    seoTitle: "عنوان الصفحة",
    seoDescription: "الوصف",
    image: "صورة المشاركة (رابط)",
    imageHint: "بتظهر لما اللينك يتشارك على واتساب أو فيسبوك. الأفضل 1200×630.",
    noindex: "إخفاء من محركات البحث",
    noindexHint: "جوجل مش هيعرض الصفحة وهتتشال من خريطة الموقع؛ اللينك هيفضل شغال.",
    count: "{n} / {max}",
    preview: "معاينة جوجل",
    save: "حفظ",
    saving: "بنحفظ…",
    saved: "تم حفظ إعدادات البحث.",
  },
} satisfies Messages;

type Seo = { title: string; description: string; imageUrl: string; noindex: boolean };
const TITLE_MAX = 70;
const DESCRIPTION_MAX = 160;
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** The product's SEO (product.seo): read by the storefront's page metadata and sitemap. */
export function ProductSeoSection({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const stored = (product.seo ?? {}) as Record<string, unknown>;
  // What is saved, as this form reads it: the bar shows only once something differs from it.
  const [baseline, setBaseline] = useState<Seo>(() => ({
    title: str(stored.title),
    description: str(stored.description),
    imageUrl: str(stored.imageUrl),
    noindex: stored.noindex === true,
  }));
  const [seo, setSeo] = useState<Seo>(baseline);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<Seo>) => setSeo((prev) => ({ ...prev, ...patch }));
  const shownTitle = seo.title.trim() || product.name;
  const shownDescription = seo.description.trim() || (product.description ?? "").replace(/\s+/g, " ").slice(0, DESCRIPTION_MAX);
  const url = `${currentWorkspace?.slug ? storeHost(currentWorkspace.slug) : ""}/products/${product.slug}`;

  const sent = (value: Seo): Seo => ({ title: value.title.trim(), description: value.description.trim(), imageUrl: value.imageUrl.trim(), noindex: value.noindex });
  const dirty = JSON.stringify(sent(seo)) !== JSON.stringify(sent(baseline));

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.updateProduct(workspaceId, product.id, {
        // Keys this form doesn't edit stay as they were.
        seo: { ...stored, title: seo.title.trim(), description: seo.description.trim(), imageUrl: seo.imageUrl.trim(), noindex: seo.noindex },
      });
      setBaseline(seo);
      toast.success(t.saved);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProductPageCard title={t.title} description={t.description}>
      <div className="space-y-4">
        <div className="zimos-product-serp rounded-[var(--radius)] bg-paper p-3 ring-1 ring-line" role="group" aria-label={t.preview}>
          <p className="text-xs text-ink-soft">{t.preview}</p>
          <p dir="ltr" className="mt-1 truncate text-xs text-success">
            {url}
          </p>
          <p dir="auto" className="truncate text-base text-primary">
            {shownTitle}
          </p>
          <p dir="auto" className="line-clamp-2 text-sm text-ink-soft">
            {shownDescription}
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (dirty) void save();
          }}
        >
          <TextField
            label={t.seoTitle}
            placeholder={product.name}
            maxLength={120}
            hint={fmt(t.count, { n: seo.title.length, max: TITLE_MAX })}
            value={seo.title}
            onChange={(e) => set({ title: e.target.value })}
          />
          <Field label={t.seoDescription} hint={fmt(t.count, { n: seo.description.length, max: DESCRIPTION_MAX })}>
            {({ id }) => <Textarea id={id} rows={3} maxLength={320} value={seo.description} onChange={(e) => set({ description: e.target.value })} />}
          </Field>
          <TextField label={t.image} hint={t.imageHint} dir="ltr" type="url" value={seo.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} />
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={seo.noindex} onChange={(e) => set({ noindex: e.target.checked })} />
            <span>
              <span className="font-medium">{t.noindex}</span>
              <span className="block text-xs text-ink-soft">{t.noindexHint}</span>
            </span>
          </label>
          {error && <Alert variant="danger">{error}</Alert>}
        </form>
        <SectionSaveBar
          section={t.barName}
          dirty={dirty}
          saving={busy}
          error={error}
          onSave={() => void save()}
          onDiscard={() => {
            setSeo(baseline);
            setError(null);
          }}
        />
      </div>
    </ProductPageCard>
  );
}
