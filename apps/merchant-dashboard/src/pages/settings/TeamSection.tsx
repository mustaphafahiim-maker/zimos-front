import { Button } from "@store-builder/ui";
import type { WorkspaceInvite, WorkspaceMember } from "@store-builder/api-client";
import { DataTable, type Column } from "@/components/DataTable";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useTeamLimitTexts, type TeamLimits } from "./teamAccessLimits";

/**
 * The team's two lists (Settings → Team): the people who joined and the invites
 * still waiting. Both are the shared DataTable, so on a phone each person is a
 * card with the role and the action inside it, where a 560px table used to push
 * them off the screen.
 */

const STRINGS = {
  en: {
    member: "Member",
    role: "Role",
    email: "Email",
    you: "(you)",
    roleFor: "Role for {who}",
    roleForFallback: "member",
    remove: "Remove",
    invited: "Invited",
    resend: "Resend",
  },
  ar: {
    member: "العضو",
    role: "الدور",
    email: "الإيميل",
    you: "(إنت)",
    roleFor: "دور {who}",
    roleForFallback: "العضو",
    remove: "شيله",
    invited: "مدعو",
    resend: "ابعت تاني",
  },
} satisfies Messages;

// The table's sheet from md up; on a phone every row is already its own card.
const FRAME = "md:overflow-hidden md:rounded-[var(--radius-card)] md:bg-paper-raised md:shadow-[var(--shadow-card)] md:ring-1 md:ring-line";

type RoleName = (role: { key: string; name: string }) => string;

export function TeamMembersTable({
  members,
  roles,
  currentUserId,
  roleName,
  onRoleChange,
  onRemove,
  limits,
}: {
  members: WorkspaceMember[];
  roles: ReadonlyArray<{ id: string; key: string; name: string }>;
  /** The signed-in person: their own row keeps its role and has no remove button. */
  currentUserId: string | undefined;
  roleName: RoleName;
  onRoleChange: (member: WorkspaceMember, roleId: string) => void;
  onRemove: (member: WorkspaceMember) => void;
  /** What the signed-in teammate may not give or touch (handoff 346); without it nothing is locked. */
  limits?: TeamLimits;
}) {
  const t = useT(STRINGS);
  const limitText = useTeamLimitTexts();
  // An Owner's row, seen by someone who is not one: the role and the removal are the Owner's.
  const ownerLocked = (member: WorkspaceMember) => limits?.ownerRow(member) === true;
  const isSelf = (member: WorkspaceMember) => currentUserId !== undefined && member.user?.id === currentUserId;

  const columns: Column<WorkspaceMember>[] = [
    {
      key: "member",
      header: t.member,
      cell: (member) => (
        <>
          <div className="font-medium text-ink">
            {member.user?.fullName || member.user?.email || "—"}
            {isSelf(member) && <span className="ms-1.5 text-xs font-normal text-ink-soft">{t.you}</span>}
          </div>
          {member.user?.email && <div className="break-all text-xs font-normal text-ink-soft">{member.user.email}</div>}
        </>
      ),
    },
    {
      key: "role",
      header: t.role,
      cell: (member) =>
        isSelf(member) ? (
          <span className="text-ink-soft">{roleName(member.role)}</span>
        ) : (
          <Select
            aria-label={fmt(t.roleFor, { who: member.user?.email ?? t.roleForFallback })}
            value={member.role.id}
            onChange={(e) => onRoleChange(member, e.target.value)}
            disabled={ownerLocked(member)}
            title={ownerLocked(member) ? limitText.ownerOnly : undefined}
            className="h-11 max-w-[220px] text-base sm:h-10 sm:text-sm"
          >
            {roles
              // Owner is offered only by an Owner; the role the row has now always stays in its list.
              .filter((role) => role.id === member.role.id || limits?.roleBlock(role.id) !== "owner")
              .map((role) => {
                const beyond = role.id !== member.role.id && limits?.roleBlock(role.id) === "permissions";
                return (
                  <option key={role.id} value={role.id} disabled={beyond} title={beyond ? limitText.roleBeyond : undefined}>
                    {roleName(role)}
                  </option>
                );
              })}
          </Select>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (member) =>
        isSelf(member) ? null : (
          <Button
            size="sm"
            variant="ghost"
            className="min-h-11 text-danger hover:bg-danger-soft sm:min-h-8"
            disabled={ownerLocked(member)}
            title={ownerLocked(member) ? limitText.ownerOnly : undefined}
            onClick={() => onRemove(member)}
          >
            {t.remove}
          </Button>
        ),
    },
  ];

  return <DataTable columns={columns} rows={members} rowKey={(member) => member.id} minWidth="35rem" className={FRAME} />;
}

export function TeamInvitesTable({
  invites,
  roleName,
  onResend,
}: {
  invites: WorkspaceInvite[];
  roleName: RoleName;
  onResend: (invite: WorkspaceInvite) => void;
}) {
  const t = useT(STRINGS);

  const columns: Column<WorkspaceInvite>[] = [
    {
      key: "email",
      header: t.email,
      cell: (invite) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-all text-ink">{invite.invitedEmail}</span>
          <StatusBadge value="invited" tone="warning" text={t.invited} />
        </div>
      ),
    },
    {
      key: "role",
      header: t.role,
      cell: (invite) => <span className="text-ink-soft">{roleName(invite.role)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (invite) => (
        <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-8" onClick={() => onResend(invite)}>
          {t.resend}
        </Button>
      ),
    },
  ];

  return <DataTable columns={columns} rows={invites} rowKey={(invite) => invite.id} minWidth="35rem" className={FRAME} />;
}
