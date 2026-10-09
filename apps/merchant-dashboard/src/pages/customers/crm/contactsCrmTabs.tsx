import type { ReactNode } from "react";
import { customerFollowupsOpen, privacyRequestsList } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useT, type Messages } from "@/i18n/LocaleContext";
import type { ChipItem } from "@/components/list";
import { MyFollowupsTab } from "./MyFollowupsTab";
import { PrivacyRequestsTab } from "./PrivacyRequestsTab";
import { RfmGroupList } from "./RfmGroupList";
import { useRfmGroupParam } from "./RfmGroupFilter";
import { RfmGroupsTab } from "./RfmGroupsTab";

/**
 * The three lists the Customers page gained as tabs (handoffs 209, 237, 235):
 * «متابعاتي», «تقسيم العملاء» and «طلبات الخصوصية». They sit beside «الكل» and
 * «الشرائح» rather than in the side menu: each is opened now and then, from
 * the page it belongs to.
 */

const STRINGS = {
  en: {
    followups: "My follow-ups",
    groups: "Customer groups",
    privacy: "Privacy requests",
  },
  ar: {
    followups: "متابعاتي",
    groups: "تقسيم العملاء",
    privacy: "طلبات الخصوصية",
  },
} satisfies Messages;

export const CRM_TABS = ["followups", "groups", "privacy"] as const;
export type CrmTab = (typeof CRM_TABS)[number];

/** The `?tab=` value as one of these tabs, or null for the page's own tabs. */
export function parseCrmTab(value: string | null | undefined): CrmTab | null {
  return (CRM_TABS as readonly string[]).includes(value ?? "") ? (value as CrmTab) : null;
}

/**
 * The three tabs for the page's row of chips, with what waits behind two of
 * them as the figure on the chip: the viewer's overdue follow-ups (in the
 * danger tone) and the privacy requests not decided yet (amber). A tab with
 * nothing waiting carries no figure. `refresh` re-reads both counts after
 * something was ticked or decided.
 */
export function useCrmContactTabs(): { tabs: ChipItem<CrmTab>[]; countsLoading: boolean; refresh: () => void } {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  // A count that can't be read (no role for it, a slow moment) leaves its tab without a number.
  const counts = useAsync(async () => {
    const [followups, privacy] = await Promise.allSettled([
      customerFollowupsOpen(apiClient, workspaceId),
      privacyRequestsList(apiClient, workspaceId, { status: "pending" }),
    ]);
    return {
      overdue: followups.status === "fulfilled" ? followups.value.overdue : 0,
      pending: privacy.status === "fulfilled" ? privacy.value.pending : 0,
    };
  }, [workspaceId]);
  const overdue = counts.data?.overdue ?? 0;
  const pending = counts.data?.pending ?? 0;

  return {
    tabs: [
      { value: "followups", label: t.followups, count: overdue > 0 ? overdue : undefined, tone: "danger" },
      { value: "groups", label: t.groups },
      { value: "privacy", label: t.privacy, count: pending > 0 ? pending : undefined, tone: "attention" },
    ],
    // No dash while they load: a chip only grows a figure when something is waiting.
    countsLoading: false,
    refresh: () => void counts.refresh({ silent: true }),
  };
}

/**
 * What the Customers page shows under its tab row: one of the three lists, or
 * — on «الكل» with a group chosen — that group's customers. Anything else is
 * the page's own content, passed as children.
 */
export function ContactsCrmView({ tab, onChanged, children }: { tab: string; onChanged: () => void; children: ReactNode }) {
  const [group] = useRfmGroupParam();
  if (tab === "followups") return <MyFollowupsTab onChanged={onChanged} />;
  if (tab === "groups") return <RfmGroupsTab />;
  if (tab === "privacy") return <PrivacyRequestsTab onChanged={onChanged} />;
  if (tab === "all" && group) return <RfmGroupList label={group} />;
  return <>{children}</>;
}
