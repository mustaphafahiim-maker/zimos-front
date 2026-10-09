import { starterTemplatesList, type StarterTemplateCard } from "@store-builder/api-client";
import { IconLayout } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { TemplateUses } from "@/pages/website/gallery/GalleryFilters";
import { ChoiceCard } from "./ChoiceCard";

const STRINGS = {
  en: {
    title: "Designed templates",
    hint: "Its first page becomes the landing step and the others plain pages. You connect them on the map.",
    funnel: "Funnel",
    landing: "Landing page",
  },
  ar: {
    title: "قوالب مصمّمة",
    hint: "أول صفحة بتبقى صفحة الهبوط والباقي صفحات عادية. بتوصّلهم ببعض من الخريطة.",
    funnel: "فانل",
    landing: "صفحة هبوط",
  },
} satisfies Messages;

/**
 * The platform's funnel and landing templates in the funnel wizard (handoff
 * 401, GET /templates?kind=funnel|landing): picking one makes the funnel from
 * its `templateVersionId` (POST /funnels). The section is not drawn while the
 * catalogue has none of either kind, or cannot be read: the ready funnels above
 * it are always there.
 */
export function PlatformTemplates({ selectedVersionId, onPick }: { selectedVersionId: string | null; onPick: (template: StarterTemplateCard) => void }) {
  const t = useT(STRINGS);
  // Public and the same for every store: remembered for the session.
  const catalogue = useCachedAsync<StarterTemplateCard[]>(
    "funnel-wizard:platform-templates",
    async () => {
      const [funnels, landings] = await Promise.all([
        starterTemplatesList(apiClient, { kind: "funnel", sort: "most_used" }),
        starterTemplatesList(apiClient, { kind: "landing", sort: "most_used" }),
      ]);
      return [...funnels.templates.map((c) => ({ ...c, kind: "funnel" as const })), ...landings.templates.map((c) => ({ ...c, kind: "landing" as const }))];
    },
    []
  );
  const cards = catalogue.data ?? [];
  if (cards.length === 0) return null;

  return (
    <section data-slot="platform-templates" className="flex min-w-0 flex-col gap-2">
      <div className="px-1">
        <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
        <p className="text-xs leading-5 text-ink-soft">{t.hint}</p>
      </div>
      <div role="radiogroup" aria-label={t.title} className="grid gap-2 sm:grid-cols-2">
        {cards.map((card) => (
          <ChoiceCard
            key={card.templateVersionId}
            name="funnel-template"
            checked={selectedVersionId === card.templateVersionId}
            onSelect={() => onPick(card)}
            leading={
              <span className="flex size-11 items-center justify-center rounded-[0.875rem] bg-paper-sunken text-ink-soft">
                <IconLayout className="size-5" aria-hidden />
              </span>
            }
            title={<bdi>{card.name}</bdi>}
            badge={<StatusBadge value={card.kind ?? "funnel"} tone="neutral" text={card.kind === "landing" ? t.landing : t.funnel} />}
            hint={<TemplateUses template={card} />}
          />
        ))}
      </div>
    </section>
  );
}
