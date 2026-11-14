import { catalogCollectionFlags, type CollectionSummary } from "@store-builder/api-client";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Field, TextField } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import type { FlatNode } from "../collectionTree";

const STRINGS = {
  en: {
    title: "Search engines and sharing",
    hint: "How this category's page appears on Google and when its link is shared. Empty fields use its name, description and picture.",
    seoTitle: "Page title",
    seoDescription: "Description",
    image: "Sharing image (link)",
    imageHint: "Shown when the link is shared on WhatsApp or Facebook. 1200×630 works best.",
    noindex: "Hide from search engines",
    noindexHint: "Google won't list this page and it leaves the sitemap; the link still works.",
    count: "{n} / {max}",
  },
  ar: {
    title: "محركات البحث والمشاركة",
    hint: "إزاي صفحة التصنيف تظهر في جوجل ولما حد يشارك اللينك. الحقول الفاضية بتستخدم الاسم والوصف والصورة.",
    seoTitle: "عنوان الصفحة",
    seoDescription: "الوصف",
    image: "صورة المشاركة (رابط)",
    imageHint: "بتظهر لما اللينك يتشارك على واتساب أو فيسبوك. الأفضل 1200×630.",
    noindex: "إخفاء من محركات البحث",
    noindexHint: "جوجل مش هيعرض الصفحة وهتتشال من خريطة الموقع؛ اللينك هيفضل شغال.",
    count: "{n} / {max}",
  },
} satisfies Messages;

export type CollectionSeo = { title: string; description: string; imageUrl: string; noindex: boolean };

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** The form's starting values from a category's stored `seo` (same keys as a product's). */
export function collectionSeoOf(collection: CollectionSummary | undefined): CollectionSeo {
  const seo = (collection?.seo ?? {}) as Record<string, unknown>;
  return { title: str(seo.title), description: str(seo.description), imageUrl: str(seo.imageUrl), noindex: seo.noindex === true };
}

/** What is saved: the stored keys this form doesn't edit stay as they were. */
export function collectionSeoPayload(collection: CollectionSummary | undefined, seo: CollectionSeo): Record<string, unknown> {
  return {
    ...((collection?.seo ?? {}) as Record<string, unknown>),
    title: seo.title.trim(),
    description: seo.description.trim(),
    imageUrl: seo.imageUrl.trim(),
    noindex: seo.noindex,
  };
}

/**
 * The category's SEO (SPEC §8.9: title, description, sharing image, noindex),
 * read by the store's category page metadata and the sitemap. Folded by
 * default: most categories never need it.
 */
export function CollectionSeoFields({
  value,
  onChange,
  placeholderTitle,
  disabled,
}: {
  value: CollectionSeo;
  onChange: (next: CollectionSeo) => void;
  placeholderTitle: string;
  disabled?: boolean;
}) {
  const t = useT(STRINGS);
  const set = (patch: Partial<CollectionSeo>) => onChange({ ...value, ...patch });
  const filled = Boolean(value.title || value.description || value.imageUrl || value.noindex);
  return (
    <details className="rounded-[0.5rem] border border-line p-3" open={filled}>
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink">{t.title}</summary>
      <div className="mt-2 space-y-4">
        <p className="text-xs text-ink-soft">{t.hint}</p>
        <TextField
          label={t.seoTitle}
          placeholder={placeholderTitle}
          maxLength={120}
          hint={fmt(t.count, { n: value.title.length, max: 70 })}
          value={value.title}
          disabled={disabled}
          onChange={(e) => set({ title: e.target.value })}
        />
        <Field label={t.seoDescription} hint={fmt(t.count, { n: value.description.length, max: 160 })}>
          {({ id }) => (
            <Textarea id={id} rows={3} maxLength={320} value={value.description} disabled={disabled} onChange={(e) => set({ description: e.target.value })} />
          )}
        </Field>
        <TextField
          label={t.image}
          hint={t.imageHint}
          dir="ltr"
          type="url"
          value={value.imageUrl}
          disabled={disabled}
          onChange={(e) => set({ imageUrl: e.target.value })}
        />
        <label className="flex min-h-11 items-start gap-2 text-sm text-ink">
          <input type="checkbox" className="mt-1" checked={value.noindex} disabled={disabled} onChange={(e) => set({ noindex: e.target.checked })} />
          <span>
            <span className="font-medium">{t.noindex}</span>
            <span className="block text-xs text-ink-soft">{t.noindexHint}</span>
          </span>
        </label>
      </div>
    </details>
  );
}

// --- the list's export ---------------------------------------------------------

const csvCell = (value: unknown) => {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * The categories as a CSV file (the list's "Export"): one row each, in the
 * list's order, with its parent, flags, product count and SEO. A BOM keeps
 * Arabic names readable in Excel.
 */
export function downloadCollectionsCsv(flat: FlatNode<CollectionSummary>[], fileName = "categories.csv") {
  const byId = new Map(flat.map((n) => [n.item.id, n.item]));
  const header = ["name", "slug", "parent", "level", "products", "subcategories", "show_in_header", "hidden", "image_url", "description", "seo_title", "seo_description", "noindex"];
  const rows = flat.map((n) => {
    const c = n.item;
    const seo = (c.seo ?? {}) as Record<string, unknown>;
    const flags = catalogCollectionFlags(c);
    return [
      c.name,
      c.slug,
      c.parentId ? (byId.get(c.parentId)?.name ?? "") : "",
      n.depth + 1,
      c.productCount ?? "",
      flat.filter((m) => m.item.parentId === c.id).length,
      flags.showInHeader ? "yes" : "no",
      flags.hidden ? "yes" : "no",
      c.imageUrl ?? "",
      c.description ?? "",
      str(seo.title),
      str(seo.description),
      seo.noindex === true ? "yes" : "no",
    ];
  });
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
