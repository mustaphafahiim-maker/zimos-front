import { useEffect, useState, useSyncExternalStore, type MouseEvent } from "react";
import { IconExternal } from "@/components/icons";
import { cn } from "@store-builder/ui";
import { CopyButton } from "@/components/CopyButton";
import { storeHost, storeUrl } from "@/lib/storeAddress";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getGoLiveState, subscribeGoLive } from "@/lib/goLive";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    draft: "Draft",
    openTitle: "Open your store in a new tab",
    previewTitle: "Preview your draft store",
    copy: "Copy link",
  },
  ar: {
    draft: "مسودة",
    openTitle: "افتح متجرك في تبويب جديد",
    previewTitle: "معاينة متجرك (مسودة)",
    copy: "نسخ الرابط",
  },
} satisfies Messages;

/**
 * The live link to a store, for the dashboard chrome.
 *
 * Shown on every page beside the store it belongs to, so a merchant never has
 * to go looking for their own address — and so switching stores visibly
 * switches the link with it.
 *
 * The host is what is drawn, not the full URL: the scheme is noise at this
 * size, and the host is the part a merchant reads back to a customer.
 *
 * A draft store (not subscribed yet) is invisible to the public, so its link
 * opens a staff preview instead: the store with a short-lived preview token.
 *
 * Drawn as a toolbar chip: one 36px pill holding the host in secondary ink and
 * two 28px round buttons, open and copy. The host and the open button are one
 * link, so the whole start of the chip opens the store. The chip's glass is in
 * theme/glass/states.css (`[data-slot="store-link"]`).
 */
export function StoreLinkBar({ slug, className }: { slug: string; className?: string }) {
  const t = useT(STRINGS);
  const url = storeUrl(slug);
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const { liveVersion } = useSyncExternalStore(subscribeGoLive, getGoLiveState);
  const [draft, setDraft] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    apiClient
      .getWorkspaceAccess(workspaceId)
      .then((access) => {
        if (!cancelled) setDraft(Boolean(access.draft));
      })
      .catch(() => {
        // Unknown: the plain link, as before.
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, liveVersion]);

  function openPreview(event: MouseEvent<HTMLAnchorElement>) {
    if (!draft || !workspaceId) return;
    event.preventDefault();
    // Opened now, while the click still counts as the user's, and pointed at
    // the store once the token is back.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    apiClient
      .createStorePreviewToken(workspaceId)
      .then(({ token }) => `${url}/?storePreview=${encodeURIComponent(token)}`)
      .catch(() => url)
      .then((target) => {
        if (tab) tab.location.href = target;
        else window.open(target, "_blank", "noopener");
      });
  }

  return (
    <div
      data-slot="store-link"
      className={cn(
        "flex h-9 max-w-full min-w-0 items-center gap-0.5 rounded-full border border-line bg-paper-raised ps-3 pe-1 lg:max-w-64",
        className
      )}
    >
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={openPreview}
        title={draft ? t.previewTitle : t.openTitle}
        // The chip is 36px; on a touch screen the link's target reaches 44px without changing how it looks.
        className="group/open relative flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-full text-xs font-medium text-ink-soft outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:-inset-y-1.5 pointer-coarse:before:content-['']"
      >
        {/* Left-to-right so a long address is cut at its end, never its start; in Arabic it
            still hugs the chip's leading edge. */}
        <span className="min-w-0 flex-1 truncate text-start rtl:text-end" dir="ltr">
          {storeHost(slug)}
        </span>
        {draft && (
          <span className="shrink-0 rounded-full bg-primary-soft px-1.5 py-0.5 text-[0.65rem] font-semibold text-primary">
            {t.draft}
          </span>
        )}
        <span
          data-slot="store-link-open"
          className="flex size-7 shrink-0 items-center justify-center rounded-full transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] group-hover/open:bg-paper-sunken group-hover/open:text-primary group-active/open:scale-[0.94] motion-reduce:transition-none motion-reduce:group-active/open:scale-100"
        >
          <IconExternal className="size-4 rtl:-scale-x-100" aria-hidden />
        </span>
      </a>
      <CopyButton value={url} label={t.copy} iconOnly />
    </div>
  );
}
