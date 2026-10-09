import { useState, type ReactNode } from "react";
import { Button } from "@store-builder/ui";
import type { WorkspaceInvite, WorkspaceMember } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ListSkeleton } from "@/components/list";
import { IconTeam, IconUserAdd } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { TeamInvitesTable, TeamMembersTable } from "../TeamSection";
import { TeamInviteForm } from "../TeamInviteForm";
import { TeamMemberGroups, TeamSeats } from "../TeamMemberGroups";
import { SettingsCard } from "./SettingsCard";
import { roleAboveYoursMessage, teamLimits, useTeamLimitTexts } from "../teamAccessLimits";

const STRINGS = {
  en: {
    inviteMember: "Invite member",
    inviteDescription: "They'll get an email with a link to join this store.",
    membersTitle: "Everyone on the team",
    pendingInvites: "Pending invites",
    pendingHint: "Sent, not accepted yet.",
    roleUpdated: "Role updated.",
    inviteResent: "Invite re-sent to {email}.",
    memberRemoved: "Member removed.",
    removeTitle: "Remove {name}?",
    removeTitleFallback: "Remove this member?",
    removeDescription: "They lose access to this store immediately. You can invite them again later.",
    removeConfirm: "Remove member",
    cancel: "Cancel",
    working: "Working…",
    emptyTitle: "Your team starts here",
    emptyHint: "Invite the people who confirm, pack and ship with you, each with what they need to see.",
    groupsNote: "Admins can do everything in the store; members do what their role allows. Change someone's role from the list.",
    // The built-in roles, by role key (the names the server gives them). A role
    // made for one store has no entry here and keeps the name it was given.
    role_owner: "Owner",
    role_workspace_manager: "Workspace Manager",
    role_editor: "Editor",
    role_order_operator: "Order Operator",
    role_confirmation_agent: "Confirmation Agent",
    role_fulfillment: "Fulfillment",
    role_accountant: "Accountant",
  },
  ar: {
    inviteMember: "ادعُ عضو",
    inviteDescription: "هيوصله إيميل فيه لينك ينضم بيه للمتجر ده.",
    membersTitle: "كل اللي في الفريق",
    pendingInvites: "دعوات مستنية القبول",
    pendingHint: "اتبعتت ولسه ما اتقبلتش.",
    roleUpdated: "الدور اتغيّر.",
    inviteResent: "الدعوة اتبعتت تاني لـ {email}.",
    memberRemoved: "العضو اتشال.",
    removeTitle: "تشيل {name}؟",
    removeTitleFallback: "تشيل العضو ده؟",
    removeDescription: "مش هيقدر يدخل المتجر ده من دلوقتي. تقدر تدعوه تاني بعدين.",
    removeConfirm: "شيل العضو",
    cancel: "إلغاء",
    working: "بننفّذ…",
    emptyTitle: "فريقك بيبدأ من هنا",
    emptyHint: "ادعُ اللي بيأكّدوا ويجهّزوا ويشحنوا معاك، وكل واحد يشوف اللي محتاجه بس.",
    groupsNote: "المديرين يقدروا يعملوا كل حاجة في المتجر، والأعضاء على قد دورهم. غيّر دور أي حد من القايمة.",
    role_owner: "صاحب المتجر",
    role_workspace_manager: "مدير المتجر",
    role_editor: "محرر",
    role_order_operator: "مسؤول الأوردرات",
    role_confirmation_agent: "موظف التأكيد",
    role_fulfillment: "موظف الشحن",
    role_accountant: "محاسب",
  },
} satisfies Messages;

type RoleLike = { key: string; name: string };

/**
 * The team's data and what can be done to it, shared by the two team sections:
 * members, pending invites and roles in one load; change a role (saved at once,
 * with Undo), resend an invite, remove a member (asks first), invite someone.
 * `dialogs` is the invite sheet and the remove question — draw it once.
 */
function useTeam() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { user } = useAuth();
  const toast = useToast();
  const roleName = (role: RoleLike) => (t as Record<string, string>)[`role_${role.key}`] ?? role.name;

  const data = useAsync(
    () =>
      Promise.all([
        apiClient.listWorkspaceMembers(workspaceId),
        apiClient.listPendingInvites(workspaceId),
        apiClient.listWorkspaceRoles(workspaceId),
      ]).then(([members, invites, roles]) => ({ members, invites, roles })),
    [workspaceId]
  );

  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<WorkspaceMember | null>(null);

  const reload = () => data.refresh({ silent: true });
  const members = data.data?.members ?? [];
  const invites = data.data?.invites ?? [];
  const roles = data.data?.roles ?? [];
  // Nobody gives or changes access above their own (handoff 346).
  const limitText = useTeamLimitTexts();
  const limits = teamLimits(members, roles, user?.id);

  async function changeRole(member: WorkspaceMember, roleId: string) {
    const before = member.role.id;
    try {
      await apiClient.updateMemberRole(workspaceId, member.id, roleId);
      void reload();
      // The opposite call is the same call with the role it had.
      toast.undo(t.roleUpdated, async () => {
        await apiClient.updateMemberRole(workspaceId, member.id, before);
        void reload();
      });
    } catch (err) {
      toast.error(roleAboveYoursMessage(err, limitText) ?? getErrorMessage(err));
      // The select already shows the role that was refused: read the list again.
      void reload();
    }
  }

  async function resend(invite: WorkspaceInvite) {
    try {
      await apiClient.resendInvite(workspaceId, invite.id);
      toast.success(fmt(t.inviteResent, { email: String(invite.invitedEmail) }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    try {
      await apiClient.removeMember(workspaceId, removing.id);
    } catch (err) {
      const above = roleAboveYoursMessage(err, limitText);
      throw above ? new Error(above) : err;
    }
    toast.success(t.memberRemoved);
    setRemoving(null);
    void reload();
  }

  const table = (list: WorkspaceMember[]): ReactNode => (
    <TeamMembersTable
      members={list}
      roles={roles}
      currentUserId={user?.id}
      roleName={roleName}
      onRoleChange={changeRole}
      onRemove={setRemoving}
      limits={limits}
    />
  );

  const inviteButton = (
    <Button className="min-h-11" onClick={() => setInviting(true)} disabled={roles.length === 0}>
      <IconUserAdd className="size-4" weight="bold" aria-hidden />
      {t.inviteMember}
    </Button>
  );

  const dialogs = (
    <>
      {/* The dashboard's Modal is the sheet (bottom sheet on a phone) that also asks before a half-typed invite is dropped. */}
      <Modal open={inviting} onClose={() => setInviting(false)} title={t.inviteMember} description={t.inviteDescription}>
        <TeamInviteForm
          limits={limits}
          onCancel={() => setInviting(false)}
          onDone={() => {
            setInviting(false);
            void reload();
          }}
        />
      </Modal>
      <ConfirmDialog
        open={removing !== null}
        title={removing?.user ? fmt(t.removeTitle, { name: removing.user.fullName || removing.user.email }) : t.removeTitleFallback}
        description={t.removeDescription}
        confirmLabel={t.removeConfirm}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </>
  );

  return { t, data, members, invites, roles, roleName, resend, table, inviteButton, dialogs };
}

/**
 * Settings → «الأعضاء والدعوات»: the seat counter with the invite button,
 * everyone on the team in one list (the role changes in place), and the
 * invites still waiting.
 */
export function TeamMembersSection() {
  const team = useTeam();
  const { t, data, members, invites } = team;
  const joined = members.filter((member) => member.status !== "invited");

  return (
    <>
      <DataState
        loading={data.loading}
        error={data.error}
        onRetry={() => void data.refresh()}
        skeleton={<ListSkeleton rows={4} />}
      >
        <SettingsCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-[1_1_12rem]">
              <TeamSeats memberCount={members.length} invitedCount={invites.length} />
            </div>
            {team.inviteButton}
          </div>
        </SettingsCard>

        {joined.length <= 1 && invites.length === 0 && (
          <EmptyState icon={<IconTeam aria-hidden />} title={t.emptyTitle} description={t.emptyHint} action={team.inviteButton} />
        )}

        {joined.length > 0 && (
          <div>
            <h3 className="mb-2 px-4 text-[13px] leading-5 font-semibold text-ink-soft">
              {t.membersTitle} ({fmt("{n}", { n: joined.length })})
            </h3>
            {team.table(joined)}
          </div>
        )}

        {invites.length > 0 && (
          <div>
            <h3 className="px-4 text-[13px] leading-5 font-semibold text-ink-soft">
              {t.pendingInvites} ({fmt("{n}", { n: invites.length })})
            </h3>
            <p className="mb-2 px-4 text-[13px] leading-5 text-ink-soft">{t.pendingHint}</p>
            <TeamInvitesTable invites={invites} roleName={team.roleName} onResend={team.resend} />
          </div>
        )}
      </DataState>
      {team.dialogs}
    </>
  );
}

/**
 * Settings → «المجموعات»: the same people in the two groups the store knows —
 * admins, who can do everything, and members, who do what their role allows.
 */
export function TeamGroupsSection() {
  const team = useTeam();
  const { t, data, members, invites } = team;

  return (
    <>
      <DataState
        loading={data.loading}
        error={data.error}
        onRetry={() => void data.refresh()}
        skeleton={<ListSkeleton rows={4} />}
      >
        <p className="px-1 text-sm leading-6 text-ink-soft">{t.groupsNote}</p>
        <TeamMemberGroups members={members} invitedCount={invites.length} seats={false}>
          {team.table}
        </TeamMemberGroups>
      </DataState>
      {team.dialogs}
    </>
  );
}
