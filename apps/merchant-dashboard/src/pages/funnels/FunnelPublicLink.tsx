import { ExternalLink } from "lucide-react";
import { storeDesignDomainsOverview, type FunnelStatus, type StoreDomain } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { CUSTOM_DOMAINS_ENABLED } from "@/lib/features";
import { storeUrl } from "@/lib/storeAddress";
import { useWorkspace } from "@/context/WorkspaceContext";
import { CopyButton } from "@/components/CopyButton";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { funnelEntryPath } from "./genericPageRules";

const STRINGS = {
  en: {
    label: "Funnel link",
    copy: "Copy link",
    open: "Open",
    openLabel: "Open the funnel in a new tab",
    draftHint: "Publish to get the link.",
    pausedHint: "Resume to make the link live.",
  },
  ar: {
    label: "رابط الفانل",
    copy: "نسخ الرابط",
    open: "فتح",
    openLabel: "فتح الفانل في تبويب جديد",
    draftHint: "انشر الفانل للحصول على الرابط.",
    pausedHint: "استأنف الفانل ليعمل الرابط.",
  },
} satisfies Messages;

/** A merchant domain the storefront serves right now: what its proxy redirects every other host to. */
function liveDomain(domains: StoreDomain[]): string | null {
  const primary = domains.find((d) => d.isPrimary && d.status === "active" && d.sslStatus === "issued" && !d.suspended);
  return primary ? primary.hostname : null;
}

/**
 * Where the store's pages are served: its primary merchant domain once that is
 * live (only while custom domains are on), otherwise `https://<slug>.<root>`.
 */
export function useStoreBaseUrl(): string | null {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const domains = useAsync(
    () => (CUSTOM_DOMAINS_ENABLED ? storeDesignDomainsOverview(apiClient, workspaceId).catch(() => null) : Promise.resolve(null)),
    [workspaceId]
  );
  const host = domains.data ? liveDomain(domains.data.domains) : null;
  if (host) return `https://${host}`;
  return currentWorkspace?.slug ? storeUrl(currentWorkspace.slug) : null;
}

/** A funnel's public address on its store: <store>/f/<subdomain or id>. */
export function funnelShareUrl(base: string, funnel: { id: string; subdomain: string | null }): string {
  return `${base}${funnelEntryPath(funnel)}`;
}

/**
 * The link a merchant shares or puts behind an ad, with Copy and Open — only
 * while the funnel is published; a draft or paused funnel gets what to do instead.
 */
export function FunnelPublicLink({
  funnel,
  className,
}: {
  funnel: { id: string; subdomain: string | null; status: FunnelStatus };
  className?: string;
}) {
  const t = useT(STRINGS);
  const base = useStoreBaseUrl();
  if (funnel.status !== "published") {
    return (
      <p className={cn("text-xs text-ink-soft", className)} data-testid="funnel-link-hint">
        {funnel.status === "paused" ? t.pausedHint : t.draftHint}
      </p>
    );
  }
  if (!base) return null;
  const url = funnelShareUrl(base, funnel);
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm", className)}>
      <span className="sr-only">{t.label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        dir="ltr"
        className="min-w-0 max-w-full truncate font-mono text-xs text-ink-soft hover:text-primary hover:underline"
        data-testid="funnel-link-url"
      >
        {url}
      </a>
      <span className="inline-flex items-center gap-3">
        <CopyButton value={url} label={t.copy} />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.openLabel}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ExternalLink className="size-3.5 rtl:-scale-x-100" aria-hidden /> {t.open}
        </a>
      </span>
    </div>
  );
}
