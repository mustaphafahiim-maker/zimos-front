import { trashList, type TrashKind } from "@store-builder/api-client";
import { IconDelete } from "@/components/icons";
import { ViewLink } from "@/components/ViewLink";
import { fmt, getIntlLocale, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { TRASH_STRINGS, trashCacheKey } from "./trashStrings";

/**
 * «سلة المحذوفات» at the top of the funnels list and the online store page
 * (handoff 373): a quiet link to /trash, with how many things of these kinds
 * wait there when it is not empty. A teammate who may manage neither kind gets
 * a 403 from the list, and no link.
 */
export function TrashLink({ kinds, from }: { kinds: readonly TrashKind[]; from: "funnels" | "website" }) {
  const t = useT(TRASH_STRINGS);
  const workspaceId = useWorkspaceId();
  const trash = useCachedAsync(trashCacheKey(workspaceId), () => trashList(apiClient, workspaceId), [workspaceId]);
  if (trash.error && !trash.data) return null;
  const count = (trash.data?.items ?? []).filter((item) => kinds.includes(item.kind)).length;
  const kind = kinds.length === 1 ? kinds[0] : null;
  const to = `/trash?from=${from}${kind ? `&kind=${kind}` : ""}`;
  return (
    <ViewLink
      to={to}
      data-slot="trash-link"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-primary md:min-h-9"
    >
      <IconDelete className="size-4" aria-hidden />
      {count > 0 ? fmt(t.linkCount, { n: new Intl.NumberFormat(getIntlLocale()).format(count) }) : t.link}
    </ViewLink>
  );
}
