import { useEffect, useState, useSyncExternalStore, type MouseEvent } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@store-builder/ui";
import { CopyButton } from "@/components/CopyButton";
import { storeHost, storeUrl } from "@/lib/storeAddress";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getGoLiveState, subscribeGoLive } from "@/lib/goLive";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { draft: "Draft", previewTitle: "Preview your draft store", copy: "Copy link" },
  ar: { draft: "مسودة", previewTitle: "معاينة متجرك (مسودة)", copy: "نسخ الرابط" },
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
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={openPreview}
        title={draft ? t.previewTitle : `Open ${url}`}
        className="inline-flex min-w-0 items-center gap-1.5 rounded-[0.5rem] px-2 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-paper hover:text-primary"
      >
        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate" dir="ltr">
          {storeHost(slug)}
        </span>
        {draft && (
          <span className="shrink-0 rounded-full bg-primary-soft px-1.5 py-0.5 text-[0.65rem] font-semibold text-primary">
            {t.draft}
          </span>
        )}
      </a>
      <CopyButton value={url} label={t.copy} labelClassName="hidden lg:inline" className="shrink-0" />
    </div>
  );
}
