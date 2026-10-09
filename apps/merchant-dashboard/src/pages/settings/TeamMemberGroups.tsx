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
    admins: "المديرين",
    adminsHint: "يقدروا يعملوا كل حاجة في المتجر.",
    members: "الأعضاء",
    membersHint: "يقدروا يعملوا اللي دورهم بيسمح بيه.",
    seats: "{used} من {limit} مكان في الفريق مستخدمين",
    seatsUnlimited: "{used} مكان في الفريق مستخدمين",
    seatsHint: "الدعوة اللي لسه ما اتقبلتش بتاخد مكان لحد ما تتقبل أو تتشال.",
    noMembers: "لسه مفيش حد بصلاحيات جزئية.",
  },
} satisfies Messages;

// The owner and the "Admin" invite (SPEC §17.1); every other role is a member.
const ADMIN_ROLES = new Set(["owner", "workspace_manager"]);

/** How many of the plan's team seats are taken (members and pending invites once each), from the API. */
function useSeats(memberCount: number, invitedCount: number) {
  const workspaceId = useWorkspaceId();
  // The API counts seats; re-read when the lists change.
  const options = useAsync(
    () => teamAccessOptions(apiClient, workspaceId).catch(() => null),
    [workspaceId, memberCount, invitedCount]
  );
  const limit = options.data?.seats.limit ?? null;
  const used = options.data?.seats.used ?? memberCount;
  return { limit, used, full: limit !== null && used >= limit };
}

/** The "5 of 14" seat counter from the plan, as one line with its bar. */
export function TeamSeats({ memberCount, invitedCount }: { memberCount: number; invitedCount: number }) {
  const t = useT(STRINGS);
  const { limit, used, full } = useSeats(memberCount, invitedCount);
  return (
    <div className="min-w-0">
      <p className={full ? "text-sm font-semibold text-danger" : "text-sm font-semibold text-ink"}>
        {limit === null ? fmt(t.seatsUnlimited, { used }) : fmt(t.seats, { used, limit })}
      </p>
      {limit !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
          <div
            className={full ? "h-full bg-danger" : "h-full bg-primary"}
            style={{ width: `${Math.min(100, Math.round((used / Math.max(1, limit)) * 100))}%` }}
          />
        </div>
      )}
      {invitedCount > 0 && <p className="mt-1.5 text-[13px] leading-5 text-ink-soft">{t.seatsHint}</p>}
    </div>
  );
}

/**
 * The team split as SPEC §17.1 has it — Admins, then Members — with the
 * "5 of 14" seat counter from the plan (left out with `seats={false}`, where
 * the page already shows it). `children` draws one group's table.
 */
export function TeamMemberGroups({
  members,
  invitedCount,
  seats = true,
  children,
}: {
  members: WorkspaceMember[];
  invitedCount: number;
  seats?: boolean;
  children: (list: WorkspaceMember[]) => ReactNode;
}) {
  const t = useT(STRINGS);
  // Pending invites have their own table below; the groups are people who joined.
  const joined = members.filter((m) => m.status !== "invited");
  const admins = joined.filter((m) => ADMIN_ROLES.has(m.role.key));
  const others = joined.filter((m) => !ADMIN_ROLES.has(m.role.key));

  return (
    <div className="space-y-6">
      {seats && <TeamSeats memberCount={members.length} invitedCount={invitedCount} />}
      <div>
        <h3 className="px-1 text-sm font-semibold text-ink">
          {t.admins} ({fmt("{n}", { n: admins.length })})
        </h3>
        <p className="mb-2 px-1 text-[13px] leading-5 text-ink-soft">{t.adminsHint}</p>
        {children(admins)}
      </div>
      <div>
        <h3 className="px-1 text-sm font-semibold text-ink">
          {t.members} ({fmt("{n}", { n: others.length })})
        </h3>
        <p className="mb-2 px-1 text-[13px] leading-5 text-ink-soft">{t.membersHint}</p>
        {others.length > 0 ? children(others) : <p className="px-1 text-sm text-ink-soft">{t.noMembers}</p>}
      </div>
    </div>
  );
}
