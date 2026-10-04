import type { ReactNode } from "react";
import { teamAccessOptions, type WorkspaceMember } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    admins: "Admins",
    adminsHint: "Can do everything in the store.",
    members: "Members",
    membersHint: "Can do what their role allows.",
    seats: "{used} of {limit} team seats used",
    seatsUnlimited: "{used} team seats used",
    seatsHint: "Pending invites take a seat until they are accepted or removed.",
    noMembers: "No one with partial access yet.",
  },
  ar: {
    admins: "المديرون",
    adminsHint: "يمكنهم فعل كل شيء في المتجر.",
    members: "الأعضاء",
    membersHint: "يمكنهم فعل ما يسمح به دورهم.",
    seats: "مستخدم {used} من {limit} مقعد في الفريق",
    seatsUnlimited: "مستخدم {used} مقعد في الفريق",
    seatsHint: "الدعوات المعلّقة تشغل مقعدًا حتى تُقبل أو تُحذف.",
    noMembers: "لا يوجد أحد بصلاحيات جزئية بعد.",
  },
} satisfies Messages;

// The owner and the "Admin" invite (SPEC §17.1); every other role is a member.
const ADMIN_ROLES = new Set(["owner", "workspace_manager"]);

/**
 * The team split as SPEC §17.1 has it — Admins, then Members — with the
 * "5 of 14" seat counter from the plan. `children` draws one group's table.
 */
export function TeamMemberGroups({
  members,
  invitedCount,
  children,
}: {
  members: WorkspaceMember[];
  invitedCount: number;
  children: (list: WorkspaceMember[]) => ReactNode;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  // The API counts seats (members and pending invites once each); re-read when the lists change.
  const options = useAsync(
    () => teamAccessOptions(apiClient, workspaceId).catch(() => null),
    [workspaceId, members.length, invitedCount]
  );
  const limit = options.data?.seats.limit ?? null;
  const used = options.data?.seats.used ?? members.length;
  // Pending invites have their own table below; the groups are people who joined.
  const joined = members.filter((m) => m.status !== "invited");
  const admins = joined.filter((m) => ADMIN_ROLES.has(m.role.key));
  const others = joined.filter((m) => !ADMIN_ROLES.has(m.role.key));
  const full = limit !== null && used >= limit;

  return (
    <div className="space-y-6">
      <div>
        <p className={full ? "text-sm font-medium text-danger" : "text-sm font-medium text-ink"}>
          {limit === null ? fmt(t.seatsUnlimited, { used }) : fmt(t.seats, { used, limit })}
        </p>
        {invitedCount > 0 && <p className="text-xs text-ink-soft">{t.seatsHint}</p>}
      </div>
      <div>
        <h3 className="text-sm font-medium text-ink">
          {t.admins} ({admins.length})
        </h3>
        <p className="mb-2 text-xs text-ink-soft">{t.adminsHint}</p>
        {children(admins)}
      </div>
      <div>
        <h3 className="text-sm font-medium text-ink">
          {t.members} ({others.length})
        </h3>
        <p className="mb-2 text-xs text-ink-soft">{t.membersHint}</p>
        {others.length > 0 ? children(others) : <p className="text-sm text-ink-soft">{t.noMembers}</p>}
      </div>
    </div>
  );
}
