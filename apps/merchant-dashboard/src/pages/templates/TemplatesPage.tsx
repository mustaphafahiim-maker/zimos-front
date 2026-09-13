import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, Search } from "lucide-react";
import { Button, Card, Input, cn } from "@store-builder/ui";
import type { StoreTemplate } from "@/mock/types";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { fmt, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";

type KindFilter = "all" | StoreTemplate["kind"];

const KIND_ORDER: KindFilter[] = ["all", "store", "funnel", "landing"];

const KIND_LABEL: Record<Locale, Record<KindFilter, string>> = {
  en: {
    all: "All",
    store: "Store",
    funnel: "Funnel",
    landing: "Landing page",
  },
  ar: {
    all: "الكل",
    store: "متجر",
    funnel: "مسار بيع",
    landing: "صفحة هبوط",
  },
};

const STRINGS = {
  en: {
    title: "Templates",
    description: "Start a store, funnel or landing page from a design built for COD selling.",
    kindFilter: "Template type",
    categoryFilter: "Category",
    allCategories: "All categories",
    searchPlaceholder: "Search templates…",
    searchLabel: "Search templates",
    emptyTitle: "No templates match",
    emptyDesc: "Try another kind, category or search term.",
    free: "Free",
    applying: "Applying…",
    useTemplate: "Use template",
    appliedToast: "Template applied (prototype).",
    funnelCreatedToast: "Funnel \"{name}\" created from template.",
    previewLabel: "Preview of {name}",
  },
  ar: {
    title: "القوالب",
    description: "ابدأ متجرًا أو مسار بيع أو صفحة هبوط من تصميم مُعدّ للبيع بالدفع عند الاستلام.",
    kindFilter: "نوع القالب",
    categoryFilter: "الفئة",
    allCategories: "كل الفئات",
    searchPlaceholder: "ابحث في القوالب…",
    searchLabel: "البحث في القوالب",
    emptyTitle: "لا توجد قوالب مطابقة",
    emptyDesc: "جرّب نوعًا أو فئة أو كلمة بحث أخرى.",
    free: "مجاني",
    applying: "جارٍ التطبيق…",
    useTemplate: "استخدم القالب",
    appliedToast: "تم تطبيق القالب (نموذج أولي).",
    funnelCreatedToast: "تم إنشاء مسار البيع \"{name}\" من القالب.",
    previewLabel: "معاينة {name}",
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

/** A CSS-only mock of the page the template produces. */
function TemplatePreview({ t, label }: { t: StoreTemplate; label: string }) {
  const blocks = t.kind === "store" ? ["grid", "grid", "grid", "grid", "grid", "grid"] : t.kind === "funnel" ? ["hero", "cta", "row", "row", "cta"] : ["hero", "row", "row", "cta"];
  return (
    <div role="img" aria-label={label} dir={t.rtl ? "rtl" : "ltr"} className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl bg-paper">
      <div className="flex h-5 items-center justify-between px-2" style={{ background: t.primaryColor }}>
        <span className="h-1.5 w-8 rounded-full bg-white/80" />
        <span className="flex gap-1">
          <span className="h-1 w-3 rounded-full bg-white/60" />
          <span className="h-1 w-3 rounded-full bg-white/60" />
          <span className="h-1 w-3 rounded-full bg-white/60" />
        </span>
      </div>
      <div className="space-y-1.5 p-2">
        {t.kind !== "store" && (
          <div className="rounded-sm p-2" style={{ background: `${t.primaryColor}1a` }}>
            <div className="h-2 w-2/3 rounded-sm bg-ink/25" />
            <div className="mt-1 h-1.5 w-1/2 rounded-sm bg-ink/15" />
            <div className="mt-2 h-3 w-14 rounded-sm" style={{ background: t.primaryColor }} />
          </div>
        )}
        {t.kind === "store" ? (
          <div className="grid grid-cols-3 gap-1.5">
            {blocks.map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="aspect-square rounded-sm bg-line" />
                <div className="h-1 w-full rounded-sm bg-ink/15" />
                <div className="h-1 w-1/2 rounded-sm" style={{ background: t.primaryColor }} />
              </div>
            ))}
          </div>
        ) : (
          blocks.slice(1).map((b, i) =>
            b === "cta" ? (
              <div key={i} className="h-4 w-full rounded-sm" style={{ background: t.primaryColor }} />
            ) : (
              <div key={i} className="flex gap-1.5">
                <div className="h-6 w-8 shrink-0 rounded-sm bg-line" />
                <div className="flex-1 space-y-1 pt-1">
                  <div className="h-1 w-full rounded-sm bg-ink/15" />
                  <div className="h-1 w-3/4 rounded-sm bg-ink/10" />
                </div>
              </div>
            )
          )
        )}
      </div>
      <span dir="ltr" className="absolute bottom-2 end-2 rounded-full border border-line bg-paper-raised px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
        {t.rtl ? "RTL" : "LTR"}
      </span>
    </div>
  );
}

export function TemplatesPage() {
  const tr = useT(STRINGS);
  const { locale } = useLocale();
  const kindLabel = KIND_LABEL[locale];
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const toast = useToast();
  const list = useAsync(() => mockApi.listTemplates(), []);

  const [kind, setKind] = useState<KindFilter>("all");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [applying, setApplying] = useState<string | null>(null);

  const templates = list.data ?? [];
  const categories = useMemo(() => Array.from(new Set(templates.map((t) => t.category))), [templates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (kind !== "all" && t.kind !== kind) return false;
      if (category !== "all" && t.category !== category) return false;
      if (q && !`${t.name} ${t.category} ${t.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [templates, kind, category, search]);

  async function use(t: StoreTemplate) {
    setApplying(t.id);
    try {
      if (t.kind === "store") {
        toast.success(tr.appliedToast);
        navigate("/website");
        return;
      }
      const funnel = await mockApi.createFunnel(workspaceId, { name: t.name, templateId: t.id });
      toast.success(fmt(tr.funnelCreatedToast, { name: funnel.name }));
      navigate(`/funnels/${funnel.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setApplying(null);
    }
  }

  return (
    <div className="max-w-6xl">
      <PageHeader title={tr.title} description={tr.description} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div role="group" aria-label={tr.kindFilter} className="flex flex-wrap gap-1.5">
          {KIND_ORDER.map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
              {kindLabel[k]}
            </Chip>
          ))}
        </div>
        <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />
        <div role="group" aria-label={tr.categoryFilter} className="flex flex-wrap gap-1.5">
          <Chip active={category === "all"} onClick={() => setCategory("all")}>
            {tr.allCategories}
          </Chip>
          {categories.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {c}
            </Chip>
          ))}
        </div>
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
                <TemplatePreview t={t} label={fmt(tr.previewLabel, { name: t.name })} />
                <div className="flex flex-1 flex-col gap-2 border-t border-line p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{t.name}</p>
                      <p className="text-xs text-ink-soft">
                        {kindLabel[t.kind]} · {t.category}
                      </p>
                    </div>
                    {t.isFree ? (
                      <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">{tr.free}</span>
                    ) : (
                      <bdi dir="ltr" className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium tabular-nums text-accent-dark">
                        {formatMoney(t.priceAmount)}
                      </bdi>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {t.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-line bg-zimos-ice px-2 py-0.5 text-[11px] text-ink-soft">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto pt-2">
                    <Button className="w-full" variant={t.kind === "store" ? "outline" : "default"} onClick={() => void use(t)} disabled={applying !== null}>
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
