import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import { ApiError, accountErrorCode, accountInviteAccept, accountInviteDecline, accountInvites, type AccountInvite } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { openEmailConfirm, useEmailConfirmState } from "@/lib/emailConfirm";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState, SkeletonBar } from "@/components/DataState";
import { IconEmail, IconStore, IconTeam } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { AuthFooter, AuthHeading, AuthLink, AuthLinkButton, AuthShell } from "@/pages/AuthShell";

const STRINGS = {
  en: {
    title: "Invitations",
    intro: "Stores that invited you to join their team.",
    invite: "{store} invited you to join its team as {role}",
    accept: "Accept",
    decline: "Decline",
    working: "Working…",
    joined: "You joined {store}'s team",
    declined: "Invitation declined.",
    confirmFirst: "Confirm your email to see invitations sent to you",
    sendCode: "Send me a code",
    empty: "No invitations right now",
    gone: "This invitation is no longer available",
    alreadyMember: "You are already on this store's team.",
    loading: "Loading your invitations…",
    toStores: "Go to my stores",
    signedInAs: "Signed in as",
    signOut: "Sign out",
    role_owner: "Owner",
    role_workspace_manager: "Workspace Manager",
    role_editor: "Editor",
    role_order_operator: "Order Operator",
    role_confirmation_agent: "Confirmation Agent",
    role_fulfillment: "Fulfillment",
    role_accountant: "Accountant",
  },
  ar: {
    title: "الدعوات",
    intro: "المتاجر اللي دعتك تنضم لفريقها.",
    invite: "{store} دعتك تنضم لفريقها بصلاحية {role}",
    accept: "قبول",
    decline: "رفض",
    working: "بننفّذ…",
    joined: "انضممت لفريق {store}",
    declined: "رفضت الدعوة.",
    confirmFirst: "أكّد إيميلك عشان تشوف الدعوات اللي جاتلك",
    sendCode: "ابعتلي كود",
    empty: "مفيش دعوات دلوقتي",
    gone: "الدعوة دي مبقتش متاحة",
    alreadyMember: "إنت في فريق المتجر ده بالفعل.",
    loading: "بنحمّل دعواتك…",
    toStores: "روح لمتاجري",
    signedInAs: "داخل بحساب",
    signOut: "خروج",
    role_owner: "صاحب المتجر",
    role_workspace_manager: "مدير المتجر",
    role_editor: "محرر",
    role_order_operator: "مسؤول الأوردرات",
    role_confirmation_agent: "موظف التأكيد",
    role_fulfillment: "موظف الشحن",
    role_accountant: "محاسب",
  },
} satisfies Messages;

/**
 * «الدعوات» (/invites, handoff 358): the team invitations waiting for this
 * account's yes. The invite email links here; an account with no store yet
 * lands here too, so the page wears the frame of the store picker rather than
 * the dashboard's.
 */
export function InvitesPage() {
  const t = useT(STRINGS);
  const labels = t as Record<string, string>;
  const { user, logout } = useAuth();
  const { refresh, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  // Confirming the email (the dialog of lib/emailConfirm) reads the list again.
  const { confirmedVersion } = useEmailConfirmState();
  const list = useAsync(() => accountInvites(apiClient), [user?.id, confirmedVersion]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mustConfirm, setMustConfirm] = useState(false);

  const roleName = (role: AccountInvite["role"]) => labels[`role_${role.key}`] ?? role.name;
  const reload = () => list.refresh({ silent: true });

  function failed(err: unknown) {
    if (accountErrorCode(err) === "EMAIL_NOT_CONFIRMED") {
      setMustConfirm(true);
    } else if (err instanceof ApiError && err.status === 404) {
      toast.error(t.gone);
      void reload();
    } else if (accountErrorCode(err) === "ALREADY_MEMBER") {
      toast.error(t.alreadyMember);
      void reload();
    } else {
      toast.error(errorMessage(err));
    }
  }

  async function accept(invite: AccountInvite) {
    setBusyId(invite.id);
    try {
      await accountInviteAccept(apiClient, invite.id);
      toast.success(fmt(t.joined, { store: invite.workspace.name }));
      // The new store joins the list, then opens.
      await refresh({ silent: true });
      selectWorkspace(invite.workspace.id);
      navigate("/", { replace: true });
    } catch (err) {
      failed(err);
      setBusyId(null);
    }
  }

  async function decline(invite: AccountInvite) {
    setBusyId(invite.id);
    try {
      await accountInviteDecline(apiClient, invite.id);
      toast.success(t.declined);
      void reload();
    } catch (err) {
      failed(err);
    } finally {
      setBusyId(null);
    }
  }

  const data = list.data;
  const unconfirmed = mustConfirm || data?.emailConfirmed === false;

  return (
    <AuthShell size="md">
      <AuthHeading title={t.title} icon={<IconTeam aria-hidden />}>
        {t.intro}
      </AuthHeading>

      <div className="mt-5">
        <DataState
          loading={list.loading}
          error={list.error}
          onRetry={() => void list.refresh()}
          skeleton={
            <div role="status" aria-busy="true" className="space-y-2.5">
              <span className="sr-only">{t.loading}</span>
              {[0, 1].map((row) => (
                <div key={row} aria-hidden data-slot="store-pick" className="rounded-[1.25rem] border border-line bg-paper-raised p-4">
                  <SkeletonBar className="h-3.5 w-3/5" />
                  <SkeletonBar className="mt-3 h-9 w-2/5" />
                </div>
              ))}
            </div>
          }
        >
          {unconfirmed ? (
            <Alert variant="info">
              <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <span className="flex min-w-0 items-start gap-2">
                  <IconEmail className="mt-0.5 size-5 shrink-0" aria-hidden />
                  {t.confirmFirst}
                </span>
                <Button type="button" size="sm" className="min-h-11" onClick={() => openEmailConfirm()}>
                  {t.sendCode}
                </Button>
              </span>
            </Alert>
          ) : data && data.invites.length === 0 ? (
            <p data-slot="store-pick" className="rounded-[1.25rem] border border-dashed border-line bg-paper-raised px-4 py-8 text-center text-sm text-ink-soft">
              {t.empty}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {(data?.invites ?? []).map((invite) => (
                <li key={invite.id} data-slot="store-pick" className="rounded-[1.25rem] border border-line bg-paper-raised p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-[0.875rem] bg-primary-soft text-primary">
                      <IconStore className="size-5" weight="duotone" aria-hidden />
                    </span>
                    <p className="min-w-0 flex-1 text-[15px] leading-6 font-medium text-ink">
                      {fmt(t.invite, { store: invite.workspace.name, role: roleName(invite.role) })}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" className="min-h-11 flex-1 sm:flex-none" disabled={busyId !== null} onClick={() => void decline(invite)}>
                      {t.decline}
                    </Button>
                    <Button type="button" className="min-h-11 flex-1 sm:flex-none" disabled={busyId !== null} onClick={() => void accept(invite)}>
                      {busyId === invite.id ? t.working : t.accept}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </div>

      <AuthLink to="/workspaces" back className="mt-4">
        {t.toStores}
      </AuthLink>

      <AuthFooter>
        {t.signedInAs}
        <bdi dir="ltr" className="max-w-full truncate font-medium text-ink">
          {user?.email ?? ""}
        </bdi>
        <span aria-hidden>·</span>
        <AuthLinkButton onClick={() => logout()}>{t.signOut}</AuthLinkButton>
      </AuthFooter>
    </AuthShell>
  );
}
