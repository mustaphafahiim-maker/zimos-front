import { useId, useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import type { PageTree, Website } from "@store-builder/api-client";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@store-builder/ui";
import {
  IconDelete,
  IconEdit,
  IconMoreActions,
  IconPage,
  IconStoreSettings,
  IconText,
  type IconComponent,
} from "@/components/icons";
import { PageActionBar } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { StoreLinkBar } from "@/components/StoreLinkBar";
import { TemplateLivePreview } from "@/components/TemplateLivePreview";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { pluralOf } from "@/lib/plural";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { accentOf, readStoreLook } from "../editor/storeLook";
import { ThemeSketch } from "../editor/ThemeSketch";
import { WebsiteEmailsButton } from "../WebsiteEmailsButton";
import { useCodeLabel } from "./codes";
import { siteStateOf, type SiteFacts, type SiteState } from "./siteFacts";

const STRINGS = {
  en: {
    edit: "Edit the store",
    texts: "Store texts",
    settings: "Store settings",
    pages: "Pages",
    more: "More for your store",
    tools: "Site tools",
    delete: "Delete this site…",
    pages_one: "1 page",
    pages_other: "{n} pages",
    hintDraft: "Not published yet — shoppers can't see it.",
    hintChanges: "You saved changes that are not published yet. Publish them from the editor.",
    hintSuspended: "This site is suspended — shoppers can't see it.",
  },
  ar: {
    edit: "عدّل المتجر",
    texts: "نصوص المتجر",
    settings: "إعدادات المتجر",
    pages: "الصفحات",
    more: "حاجات تانية لمتجرك",
    tools: "أدوات الموقع",
    delete: "امسح الموقع ده…",
    pages_one: "صفحة واحدة",
    pages_two: "صفحتين",
    pages_few: "{n} صفحات",
    pages_other: "{n} صفحة",
    hintDraft: "لسه ما اتنشرش — العملاء مش شايفينه.",
    hintChanges: "فيه تعديلات محفوظة لسه ما اتنشرتش. انشرها من المحرر.",
    hintSuspended: "الموقع ده موقوف — العملاء مش شايفينه.",
  },
} satisfies Messages;

/** The chip's tone per state: the word says it, the colour only helps. */
const STATE_TONE: Record<SiteState, "neutral" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  published: "success",
  changes: "warning",
  suspended: "danger",
};

// The row of the list kit's menus: 36px under a mouse, 44px under a thumb.
const MENU_ITEM = "min-h-9 cursor-pointer items-center gap-3 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11 pointer-coarse:py-3";

/** A quiet way out of the hero: words first, 44px to the thumb. */
function QuietLink({ to, icon: LinkIcon, children }: { to: string; icon: IconComponent; children: ReactNode }) {
  return (
    <ViewLink
      to={to}
      className="zimos-site-link inline-flex h-11 min-w-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-soft transition-[color,background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-primary-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      {/* On a phone the three links share one line: the words alone fit, the glyphs would not. */}
      <LinkIcon className="size-4 shrink-0 max-sm:hidden" aria-hidden />
      <span className="truncate">{children}</span>
    </ViewLink>
  );
}

/**
 * The site, small: the top of its home page as a shopper's phone has it — one
 * storefront render, asked for once the page's facts are in — over a drawing
 * of the store's theme, which stays if there is no page to draw yet.
 */
function SiteThumb({ site, facts }: { site: Website; facts: SiteFacts | null }) {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const look = useMemo(() => readStoreLook(currentWorkspace), [currentWorkspace]);
  // The same tree is the same object: a refresh that changed nothing must not render the store again.
  const homeJson = facts?.home ? JSON.stringify(facts.home) : null;
  const home = useMemo(() => (homeJson ? (JSON.parse(homeJson) as PageTree) : null), [homeJson]);

  const sketch = (
    <ThemeSketch
      theme={look.storeTheme}
      mode="light"
      accent={accentOf(look)}
      title={currentWorkspace?.name || site.name}
      className="h-full"
    />
  );

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden bg-paper-sunken">
      {facts === null ? (
        // In its own box: the drawing fills the portrait, whatever shape it would take by itself.
        <div className="absolute inset-0">{sketch}</div>
      ) : (
        <TemplateLivePreview
          workspaceId={workspaceId}
          templateId={`site:${site.id}`}
          page={home}
          title={site.name}
          aspect="3/4"
          cardLayout="mobile"
          fallback={sketch}
        />
      )}
    </div>
  );
}

/**
 * The first thing on the website page: where the store is and how to edit it.
 * The site's name, whether shoppers see it («منشور» / «مسودة» / «فيه تغييرات
 * ما اتنشرتش»), its address with open and copy, a small picture of it, and ONE
 * main button — «عدّل المتجر». On a phone that button is the bar above the
 * dock (PageActionBar, as PageHeader's primaryAction would place it); from md
 * up it sits in the card.
 *
 * Under a hairline, as a quiet row: store texts, store settings, the pages —
 * and, once the store has more than one site, this site's own order emails.
 * Deleting is one tap away in «…», behind its confirmation.
 */
export function SiteHero({
  site,
  facts,
  siteCount,
  onDelete,
}: {
  site: Website;
  /** What one more call says about the site; null while it is on its way or when it could not be had. */
  facts: SiteFacts | null;
  /** How many sites the store has: a second one brings each its own emails. */
  siteCount: number;
  onDelete: () => void;
}) {
  const t = useT(STRINGS);
  const codeLabel = useCodeLabel();
  const { dir } = useLocale();
  const { currentWorkspace } = useWorkspace();
  const nameId = useId();
  const editTo = `/website/${site.id}/edit`;
  const state = siteStateOf(site, facts);
  const hint =
    state === "draft" ? t.hintDraft : state === "changes" ? t.hintChanges : state === "suspended" ? t.hintSuspended : null;
  const slug = currentWorkspace?.slug ?? "";

  const editLabel = (
    <>
      <IconEdit className="size-4" weight="bold" aria-hidden />
      {t.edit}
    </>
  );

  return (
    <section
      data-slot="site-hero"
      data-state={state}
      aria-labelledby={nameId}
      className="zimos-site-hero relative min-w-0 rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-5"
    >
      <div className="flex min-w-0 gap-3.5 sm:gap-5">
        {/* A second way to the same place for a finger that goes for the picture; the button is the one that is named. */}
        <Link
          to={editTo}
          tabIndex={-1}
          aria-hidden="true"
          data-slot="site-thumb"
          className="zimos-site-thumb block w-24 shrink-0 self-start overflow-hidden rounded-2xl ring-1 ring-line transition-[translate,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:-translate-y-0.5 active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 sm:w-36"
        >
          <SiteThumb site={site} facts={facts} />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <h2 id={nameId} className="line-clamp-2 font-display text-[17px] leading-6 font-semibold break-words text-ink sm:text-xl sm:leading-7">
                {site.name}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <StatusBadge value={state} tone={STATE_TONE[state]} text={codeLabel("status", state)} />
                {facts !== null && facts.pageCount > 0 && (
                  <span className="text-xs text-ink-soft">{pluralOf(t, "pages", facts.pageCount)}</span>
                )}
              </div>
            </div>
            <DirectionProvider direction={dir}>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label={t.tools}
                      title={t.tools}
                      className="zimos-site-more -me-1.5 -mt-1.5 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[color,background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/6 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] aria-expanded:bg-ink/6 aria-expanded:text-ink motion-reduce:transition-none motion-reduce:active:scale-100"
                    />
                  }
                >
                  <IconMoreActions className="size-5" weight="bold" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end" sideOffset={6} className="w-auto min-w-52 rounded-[1.125rem] p-1.5">
                  <DropdownMenuItem variant="destructive" onClick={onDelete} className={MENU_ITEM}>
                    <IconDelete className="size-[18px]" aria-hidden />
                    <span className="min-w-0 flex-1">{t.delete}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </DirectionProvider>
          </div>

          {hint && <p className="text-[13px] leading-5 text-ink-soft">{hint}</p>}

          {slug && <StoreLinkBar slug={slug} className="w-full sm:max-w-sm lg:max-w-sm" />}

          <div className="mt-auto hidden pt-1 md:block">
            <Button asChild size="lg" className="rounded-full px-5">
              <ViewLink to={editTo}>{editLabel}</ViewLink>
            </Button>
          </div>
        </div>
      </div>

      <nav aria-label={t.more} className="mt-3.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 border-t border-line pt-2.5 sm:mt-5">
        <QuietLink to="/website/texts" icon={IconText}>
          {t.texts}
        </QuietLink>
        <QuietLink to="/store-settings" icon={IconStoreSettings}>
          {t.settings}
        </QuietLink>
        <QuietLink to="/store-settings/pages" icon={IconPage}>
          {t.pages}
        </QuietLink>
        {/* A website's own order emails, once there is more than one (item 175). */}
        {siteCount > 1 && <WebsiteEmailsButton site={site} />}
      </nav>

      {/* The phone's home of the one main action: above the dock, within the thumb's reach. */}
      <PageActionBar>
        <Button asChild size="lg" className="rounded-full">
          <ViewLink to={editTo}>{editLabel}</ViewLink>
        </Button>
      </PageActionBar>
    </section>
  );
}
