import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, Search } from "lucide-react";
import { Button, Card, Input, cn } from "@store-builder/ui";
import type { WebsiteTemplateSummary } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { ApiError, getErrorMessage } from "@/lib/errors";
import { humanize } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { fmt, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";

const BRAND_BLUE = "#1D4ED8";

// Known backend categories (seeders); unknown ones fall back to humanize().
const CATEGORY_LABEL: Record<Locale, Record<string, string>> = {
  en: {
    ecommerce: "E-commerce",
    fashion: "Fashion",
    food_beverage: "Food & beverage",
    electronics: "Electronics",
    general: "General",
    single_product: "Single product",
  },
  ar: {
    ecommerce: "متجر إلكتروني",
    fashion: "أزياء وموضة",
    food_beverage: "أكل ومشروبات",
    electronics: "إلكترونيات",
    general: "عام",
    single_product: "منتج واحد",
  },
};

const STRINGS = {
  en: {
    title: "Templates",
    description: "Start a new website from a design built for COD selling.",
    categoryFilter: "Category",
    allCategories: "All categories",
    searchPlaceholder: "Search templates…",
    searchLabel: "Search templates",
    emptyTitle: "No templates match",
    emptyDesc: "Try another category or search term.",
    applying: "Creating…",
    useTemplate: "Use template",
    createdToast: "Website \"{name}\" created from template.",
    previewLabel: "Preview of {name}",
    permission: "You don't have permission to create websites.",
    subscription: "This workspace needs an active subscription to create a website.",
  },
  ar: {
    title: "القوالب",
    description: "ابدأ موقعًا جديدًا من تصميم مُعدّ للبيع بالدفع عند الاستلام.",
    categoryFilter: "الفئة",
    allCategories: "كل الفئات",
    searchPlaceholder: "ابحث في القوالب…",
    searchLabel: "البحث في القوالب",
    emptyTitle: "لا توجد قوالب مطابقة",
    emptyDesc: "جرّب فئة أو كلمة بحث أخرى.",
    applying: "جارٍ الإنشاء…",
    useTemplate: "استخدم القالب",
    createdToast: "تم إنشاء الموقع \"{name}\" من القالب.",
    previewLabel: "معاينة {name}",
    permission: "ليست لديك صلاحية لإنشاء المواقع.",
    subscription: "تحتاج مساحة العمل إلى اشتراك نشط لإنشاء موقع.",
  },
} satisfies Messages;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-white" : "border-line bg-paper-raised text-ink-soft hover:border-primary/50 hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

/** A CSS-only mock of a store page, tinted with the template's real primaryColor when known. */
function TemplatePreview({ t, color, label }: { t: WebsiteTemplateSummary; color: string; label: string }) {
  return (
    <div role="img" aria-label={label} className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl bg-paper">
      <MockBlocks color={color} />
      {t.thumbnailUrl && (
        <img
          src={t.thumbnailUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
          onError={(e) => {
            // Unreachable thumbnail: fall back to the CSS mock underneath.
            (e.currentTarget as HTMLImageElement).hidden = true;
          }}
        />
      )}
    </div>
  );
}

function MockBlocks({ color }: { color: string }) {
  return (
    <div className="pointer-events-none">
      <div className="flex h-5 items-center justify-between px-2" style={{ background: color }}>
        <span className="h-1.5 w-8 rounded-full bg-white/80" />
        <span className="flex gap-1">
          <span className="h-1 w-3 rounded-full bg-white/60" />
          <span className="h-1 w-3 rounded-full bg-white/60" />
          <span className="h-1 w-3 rounded-full bg-white/60" />
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="aspect-square rounded-sm bg-line" />
            <div className="h-1 w-full rounded-sm bg-ink/15" />
            <div className="h-1 w-1/2 rounded-sm" style={{ background: color }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TemplatesPage() {
  const tr = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const toast = useToast();
  const list = useAsync(() => apiClient.listWebsiteTemplates(), []);

  const templates = list.data ?? [];
  const idsKey = templates.map((t) => t.id).join(",");
  // Detail carries the active version's globalStyles (primaryColor). Best-effort; brand blue otherwise.
  const colors = useAsync(async () => {
    const ids = idsKey ? idsKey.split(",") : [];
    const res = await Promise.allSettled(ids.map((id) => apiClient.getWebsiteTemplate(id)));
    const map = new Map<string, string>();
    res.forEach((r) => {
      if (r.status !== "fulfilled") return;
      const c = r.value.globalStyles?.primaryColor;
      if (typeof c === "string" && /^#[0-9a-f]{3,8}$/i.test(c)) map.set(r.value.id, c);
    });
    return map;
  }, [idsKey]);

  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [applying, setApplying] = useState<string | null>(null);

  const categoryLabel = (cat: string) => CATEGORY_LABEL[locale][cat] ?? humanize(cat);

  const categories = useMemo(
    () => Array.from(new Set(templates.map((t) => t.category).filter((x): x is string => Boolean(x)))),
    [templates]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (q && !`${t.name} ${t.category ?? ""} ${t.category ? categoryLabel(t.category) : ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, category, search, locale]);

  async function use(t: WebsiteTemplateSummary) {
    setApplying(t.id);
    try {
      const { website } = await apiClient.createWebsite(workspaceId, { name: t.name, templateVersionId: t.templateVersionId });
      toast.success(fmt(tr.createdToast, { name: website.name }));
      navigate(`/website/${website.id}/edit`);
    } catch (err) {
      let msg = getErrorMessage(err);
      if (err instanceof ApiError) {
        if (err.status === 403) msg = tr.permission;
        else if (err.status === 402 || err.code === "SUBSCRIPTION_REQUIRED") msg = tr.subscription;
      }
      toast.error(msg);
      setApplying(null);
    }
  }

  return (
    <div className="max-w-6xl">
      <PageHeader title={tr.title} description={tr.description} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        {categories.length > 0 && (
          <div role="group" aria-label={tr.categoryFilter} className="flex flex-wrap gap-1.5">
            <Chip active={category === "all"} onClick={() => setCategory("all")}>
              {tr.allCategories}
            </Chip>
            {categories.map((cat) => (
              <Chip key={cat} active={category === cat} onClick={() => setCategory(cat)}>
                {categoryLabel(cat)}
              </Chip>
            ))}
          </div>
        )}
        <div className="relative w-full sm:ms-auto sm:w-64">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr.searchPlaceholder} aria-label={tr.searchLabel} className="ps-9" />
        </div>
      </div>

      <DataState loading={list.loading} error={list.error} onRetry={() => list.refresh()}>
        {filtered.length === 0 ? (
          <EmptyState icon={<LayoutGrid />} title={tr.emptyTitle} description={tr.emptyDesc} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <Card key={t.id} className="flex flex-col overflow-hidden rounded-2xl p-0">
                <TemplatePreview t={t} color={colors.data?.get(t.id) ?? BRAND_BLUE} label={fmt(tr.previewLabel, { name: t.name })} />
                <div className="flex flex-1 flex-col gap-2 border-t border-line p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink" dir="auto">
                      {t.name}
                    </p>
                    {t.category && <p className="text-xs text-ink-soft">{categoryLabel(t.category)}</p>}
                  </div>
                  <div className="mt-auto pt-2">
                    <Button className="w-full" onClick={() => void use(t)} disabled={applying !== null}>
                      {applying === t.id ? tr.applying : tr.useTemplate}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </DataState>
    </div>
  );
}
