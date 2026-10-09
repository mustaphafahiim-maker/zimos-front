import { useState } from "react";
import { Link } from "react-router-dom";
import { IconCheck, IconDocument, IconEdit, IconLock } from "@/components/icons";
import { Badge, Button, cn } from "@store-builder/ui";
import {
  storeDesignListPages,
  storeDesignUpdatePageFlags,
  type StoreDesignPageRow,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { SettingsGroup } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { GroupBlock, SettingsSkeleton } from "./sections/parts";

const STRINGS = {
  en: {
    title: "Pages",
    description: "Where each page of your website is linked from, and whether shoppers can open it. Changes apply at once.",
    tip: "Shipping, returns and privacy policies are required for TikTok ads.",
    page: "Page",
    link: "Link",
    header: "In header",
    footer: "In footer",
    active: "Active",
    edit: "Edit",
    home: "Home",
    draft: "Not published",
    draftHint: "Publish the website for this page to appear in the store.",
    emptyTitle: "No website yet",
    emptyBody: "Create your website first; its pages will be listed here.",
    openWebsite: "Open Website",
    saved: "Page updated.",
    homeLocked: "Always linked and always open",
    flagFor: "{flag} — {page}",
    emptyPages: "This website has no pages yet.",
  },
  ar: {
    title: "الصفحات",
    description: "من أين يُربط بكل صفحة في موقعك، وهل يستطيع المشتري فتحها. التغييرات تُطبق فورًا.",
    tip: "سياسات الشحن والاسترجاع والخصوصية مطلوبة لإعلانات تيك توك.",
    page: "الصفحة",
    link: "الرابط",
    header: "في الهيدر",
    footer: "في الفوتر",
    active: "مفعّلة",
    edit: "تعديل",
    home: "الرئيسية",
    draft: "غير منشورة",
    draftHint: "انشر الموقع لتظهر هذه الصفحة في المتجر.",
    emptyTitle: "مفيش موقع لسه",
    emptyBody: "أنشئ موقعك أولًا وستظهر صفحاته هنا.",
    openWebsite: "فتح الموقع",
    saved: "اتحدّثت الصفحة.",
    homeLocked: "دايمًا ظاهرة ومفتوحة",
    flagFor: "{flag} — {page}",
    emptyPages: "الموقع ده لسه مفيهوش صفحات.",
  },
} satisfies Messages;

type Flag = "showInHeader" | "showInFooter" | "isActive";

export function PagesTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState<string | null>(null);

  // The store's website: the published one, or the first while none is live.
  const state = useAsync(async () => {
    const websites = await apiClient.listWebsites(workspaceId);
    const website = websites.find((w) => w.status === "published") ?? websites[0] ?? null;
    if (!website) return { website: null, pages: [] as StoreDesignPageRow[] };
    return { website, pages: await storeDesignListPages(apiClient, workspaceId, website.id) };
  }, [workspaceId]);

  /** Saves at once, as it always did; `undoable` offers to take it back (the same call with the other value). */
  async function toggle(page: StoreDesignPageRow, flag: Flag, value: boolean, undoable = true) {
    setBusy(`${page.id}:${flag}`);
    // Shown at once; put back if the server refuses.
    const patch = (v: boolean) =>
      state.setData((prev) =>
        prev
          ? { ...prev, pages: prev.pages.map((p) => (p.id === page.id ? { ...p, [flag]: v } : p)) }
          : { website: null, pages: [] }
      );
    patch(value);
    try {
      await storeDesignUpdatePageFlags(apiClient, workspaceId, page.websiteId, page.id, { [flag]: value });
      if (undoable) toast.undo(t.saved, () => toggle(page, flag, !value, false));
      else toast.success(t.saved);
    } catch (err) {
      patch(!value);
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const FLAGS: ReadonlyArray<{ flag: Flag; label: string }> = [
    { flag: "showInHeader", label: t.header },
    { flag: "showInFooter", label: t.footer },
    { flag: "isActive", label: t.active },
  ];

  const pages = state.data?.pages ?? [];

  return (
    <DataState loading={state.loading} error={state.error} onRetry={() => void state.refresh()} skeleton={<SettingsSkeleton groups={1} rows={5} />}>
      {state.data && !state.data.website ? (
        <EmptyState
          icon={<IconDocument />}
          title={t.emptyTitle}
          description={t.emptyBody}
          action={
            <Button asChild className="min-h-11 rounded-full px-5">
              <Link to="/website">{t.openWebsite}</Link>
            </Button>
          }
        />
      ) : (
        <SettingsGroup description={t.description} footer={t.tip}>
          {pages.length === 0 && (
            <GroupBlock>
              <p className="py-3 text-center text-sm text-ink-soft">{t.emptyPages}</p>
            </GroupBlock>
          )}
          {pages.map((page) => {
            // The home page is always linked and always served.
            const home = page.path === "/";
            const name = home ? t.home : page.title;
            return (
              <GroupBlock key={page.id}>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5 font-medium text-ink">
                      <span className="truncate" dir="auto">
                        {name}
                      </span>
                      {!page.isLive && (
                        <Badge variant="secondary" title={t.draftHint}>
                          {t.draft}
                        </Badge>
                      )}
                    </p>
                    <bdi dir="ltr" className="mt-0.5 block truncate text-[13px] leading-5 text-ink-soft">
                      {page.path}
                    </bdi>
                  </div>
                  <Button asChild variant="outline" className="min-h-11 shrink-0 rounded-full px-4 sm:min-h-9">
                    <Link to={`/website/${page.websiteId}/edit`}>
                      <IconEdit className="size-4" aria-hidden />
                      {t.edit}
                    </Link>
                  </Button>
                </div>
                {home ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[13px] leading-5 text-ink-soft">
                    <IconLock className="size-3.5 shrink-0" aria-hidden />
                    {t.homeLocked}
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {FLAGS.map(({ flag, label }) => {
                      const on = page[flag];
                      return (
                        <button
                          key={flag}
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={fmt(t.flagFor, { flag: label, page: name })}
                          disabled={busy === `${page.id}:${flag}`}
                          onClick={() => void toggle(page, flag, !on)}
                          className={cn(
                            "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ring-1 transition-[background-color,color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] select-none",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] disabled:cursor-progress disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100",
                            on ? "bg-primary-soft text-primary-dark ring-primary/30 dark:text-primary" : "bg-transparent text-ink-soft ring-line hover:bg-ink/4 hover:text-ink"
                          )}
                        >
                          {on && <IconCheck className="size-4 shrink-0" weight="bold" aria-hidden />}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </GroupBlock>
            );
          })}
        </SettingsGroup>
      )}
    </DataState>
  );
}
