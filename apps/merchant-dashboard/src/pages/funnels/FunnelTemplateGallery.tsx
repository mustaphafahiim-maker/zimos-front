import { useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import { funnelsList, type MarketplaceTemplateCard } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDate } from "@/lib/format";
import { fmt, useT, type Locale, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { FilterTabs } from "@/components/FilterTabs";
import { Modal } from "@/components/Modal";
import { STARTER_TEMPLATE_IDS, starterPlan, type StarterTemplateId, type UiStepType } from "./funnelAdapter";
import { STARTER_TEMPLATE_TEXT, STEP_TYPE_LABELS } from "./FunnelEditorPage.strings";
import { StepChain } from "./StepChain";
import { StepThumbnail } from "./FlowMapTools";
import { MarketplaceBrowser } from "./marketplace/MarketplaceBrowser";
import { TemplatePreviewDialog } from "./marketplace/TemplatePreviewDialog";
import { MARKET_STRINGS } from "./marketplace/marketplaceStrings";

/**
 * The funnel wizard's template gallery (SPEC §9.1): the starter templates —
 * filtered by what they do, each in an Arabic and an English version, each
 * with a preview of its pages — then «سوق القوالب», the templates other stores
 * shared and the platform listed (handoff 192: free, with their real usage
 * counts), and in "Your funnels" any funnel of this store to start a new one
 * from (a copy of its pages and links).
 */

const STRINGS = {
  en: {
    tabs: "Templates",
    all: "Templates",
    mine: "Your funnels",
    filter: "Kind",
    any: "All",
    cod: "Cash on delivery",
    upsell: "With an upsell",
    leads: "Leads",
    advertorial: "Advertorial",
    language: "Version",
    arabic: "Arabic",
    english: "English",
    preview: "Preview",
    previewTitle: "{name} — {n} pages",
    close: "Close",
    pages: "{n} pages",
    updated: "Changed {date}",
    noneMine: "No funnels yet. Your own funnels show up here to start new ones from.",
    noneFit: "No template of this kind for this goal.",
    copyHint: "A copy of its pages and links, with the same products and offers.",
  },
  ar: {
    tabs: "القوالب",
    all: "القوالب",
    mine: "مسارات البيع بتاعتك",
    filter: "النوع",
    any: "الكل",
    cod: "دفع عند الاستلام",
    upsell: "فيه عرض إضافي",
    leads: "جمع عملاء",
    advertorial: "مقال إعلاني",
    language: "النسخة",
    arabic: "عربي",
    english: "إنجليزي",
    preview: "معاينة",
    previewTitle: "{name} — {n} صفحات",
    close: "إغلاق",
    pages: "{n} صفحات",
    updated: "اتعدّل {date}",
    noneMine: "مفيش مسارات بيع لسه. مسارات البيع بتاعتك بتظهر هنا عشان تبدأ منها مسار بيع جديد.",
    noneFit: "مفيش قالب من النوع ده للهدف ده.",
    copyHint: "نسخة من صفحاته وروابطه، بنفس المنتجات والعروض.",
  },
} satisfies Messages;

type Kind = "any" | "cod" | "upsell" | "leads" | "advertorial";
const KIND_TEST: Record<Exclude<Kind, "any">, (types: UiStepType[]) => boolean> = {
  cod: (types) => types.includes("checkout"),
  upsell: (types) => types.includes("upsell") || types.includes("downsell"),
  leads: (types) => types.includes("opt_in"),
  advertorial: (types) => types.includes("article"),
};

export type GalleryPick =
  | { kind: "starter"; id: StarterTemplateId; lang: Locale }
  | { kind: "copy"; funnelId: string; name: string }
  | { kind: "market"; id: string; name: string; stepCount: number };

export function FunnelTemplateGallery({
  goal,
  value,
  onChange,
  locale,
  leading,
}: {
  goal: "sell" | "leads";
  value: GalleryPick | null;
  onChange: (pick: GalleryPick) => void;
  locale: Locale;
  /** Cards that always come first (the AI template). */
  leading?: React.ReactNode;
}) {
  const t = useT(STRINGS);
  const m = useT(MARKET_STRINGS);
  const workspaceId = useWorkspaceId();
  const [tab, setTab] = useState<"all" | "market" | "mine">("all");
  const [marketPreview, setMarketPreview] = useState<MarketplaceTemplateCard | null>(null);
  const pickMarket = (tpl: MarketplaceTemplateCard) => onChange({ kind: "market", id: tpl.id, name: tpl.name, stepCount: tpl.stepCount });
  const [kind, setKind] = useState<Kind>("any");
  const [lang, setLang] = useState<Locale>(locale);
  const [preview, setPreview] = useState<StarterTemplateId | null>(null);
  const mine = useAsync(() => (tab === "mine" ? funnelsList(apiClient, workspaceId) : Promise.resolve(null)), [workspaceId, tab]);

  const templates = useMemo(
    () =>
      STARTER_TEMPLATE_IDS.map((id) => ({ id, ...STARTER_TEMPLATE_TEXT[lang][id], plan: starterPlan(id, lang) })).filter((tpl) => {
        const types = tpl.plan.steps.map((s) => s.type);
        if (tpl.id !== "blank" && !(goal === "leads" ? KIND_TEST.leads(types) : KIND_TEST.cod(types))) return false;
        return kind === "any" || tpl.id === "blank" || KIND_TEST[kind](types);
      }),
    [goal, kind, lang]
  );
  const previewed = preview ? templates.find((tpl) => tpl.id === preview) ?? null : null;

  return (
    <div className="space-y-3">
      <FilterTabs
        label={t.tabs}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "all", label: t.all },
          { value: "market", label: m.title },
          { value: "mine", label: t.mine },
        ]}
      />

      {tab === "all" ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <FilterTabs
              label={t.filter}
              value={kind}
              onChange={setKind}
              tabs={(["any", "cod", "upsell", "leads", "advertorial"] as const).map((k) => ({ value: k, label: t[k] }))}
            />
            <FilterTabs label={t.language} value={lang} onChange={setLang} tabs={[{ value: "ar", label: t.arabic }, { value: "en", label: t.english }]} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {leading}
            {templates.length === 0 && <p className="text-sm text-ink-soft">{t.noneFit}</p>}
            {templates.map((tpl) => {
              const active = value?.kind === "starter" && value.id === tpl.id;
              return (
                <div
                  key={tpl.id}
                  className={cn(
                    "rounded-2xl border p-3 transition-colors",
                    active ? "border-primary bg-primary-soft ring-1 ring-primary/30" : "border-line hover:border-primary/50"
                  )}
                >
                  <label className="block cursor-pointer">
                    <input type="radio" name="funnel-template" className="sr-only" checked={active} onChange={() => onChange({ kind: "starter", id: tpl.id, lang })} />
                    <p className={cn("text-sm font-semibold", active ? "text-primary-dark" : "text-ink")} dir="auto">
                      {tpl.name}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft" dir="auto">
                      {tpl.description}
                    </p>
                    <StepChain types={tpl.plan.steps.map((s) => s.type)} className="mt-2" />
                  </label>
                  <Button type="button" size="xs" variant="ghost" className="mt-1" onClick={() => setPreview(tpl.id)}>
                    <Eye className="size-3" aria-hidden /> {t.preview}
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      ) : tab === "market" ? (
        <>
          <p className="text-xs text-ink-soft">{m.pickHint}</p>
          <MarketplaceBrowser mode="pick" selectedId={value?.kind === "market" ? value.id : null} onPick={pickMarket} onPreview={setMarketPreview} />
          <TemplatePreviewDialog
            template={marketPreview}
            onClose={() => setMarketPreview(null)}
            useLabel={m.pickThis}
            onUse={(tpl) => {
              pickMarket(tpl);
              setMarketPreview(null);
            }}
          />
        </>
      ) : (
        <DataState loading={mine.loading} error={mine.error} empty={(mine.data ?? []).length === 0} emptyMessage={t.noneMine} onRetry={() => void mine.refresh()}>
          <p className="text-xs text-ink-soft">{t.copyHint}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {[...(mine.data ?? [])]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((f) => {
                const active = value?.kind === "copy" && value.funnelId === f.id;
                return (
                  <label
                    key={f.id}
                    className={cn(
                      "cursor-pointer rounded-2xl border p-3 transition-colors",
                      active ? "border-primary bg-primary-soft ring-1 ring-primary/30" : "border-line hover:border-primary/50"
                    )}
                  >
                    <input type="radio" name="funnel-template" className="sr-only" checked={active} onChange={() => onChange({ kind: "copy", funnelId: f.id, name: f.name })} />
                    <p className={cn("truncate text-sm font-semibold", active ? "text-primary-dark" : "text-ink")} dir="auto">
                      {f.name}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">{fmt(t.updated, { date: formatDate(f.updatedAt) })}</p>
                  </label>
                );
              })}
          </div>
        </DataState>
      )}

      {previewed && (
        <Modal
          open
          onClose={() => setPreview(null)}
          title={fmt(t.previewTitle, { name: previewed.name, n: previewed.plan.steps.length })}
          description={previewed.description}
          footer={
            <Button variant="outline" onClick={() => setPreview(null)}>
              {t.close}
            </Button>
          }
        >
          <ol className="grid gap-3 sm:grid-cols-2">
            {previewed.plan.steps.map((s, i) => (
              <li key={s.key} className="rounded-xl border border-line p-2">
                <p className="mb-1 text-xs font-medium text-ink" dir="auto">
                  {i + 1}. {s.name} <span className="text-ink-soft">· {STEP_TYPE_LABELS[lang][s.type]}</span>
                </p>
                <StepThumbnail tree={s.tree} />
              </li>
            ))}
          </ol>
        </Modal>
      )}
    </div>
  );
}
