import { useState } from "react";
import { Button } from "@store-builder/ui";
import {
  ApiError,
  adminDeleteUser,
  adminSuspendUser,
  adminUnsuspendUser,
  adminUserModerationOf,
  adminUserOwnedStores,
  siteAcquisitionOfUser,
  type AdminUserDetail,
  type AdminUserRow,
  type AdminUserRowWithDeleted,
} from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailRow } from "@/components/Drawer";
import { TextAreaField } from "@/components/forms";
import { Panel } from "@/components/Panel";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import { CREATOR_ROLE, P } from "@/lib/permissions";

/**
 * Suspending, unsuspending and deleting an account from the console
 * (handoff 337), and where an account came from (handoff 339).
 */

type ModeratedUser = AdminUserDetail | AdminUserRow | AdminUserRowWithDeleted;

const ERROR_TEXT: Record<string, string> = {
  CANNOT_ACT_ON_SELF: "You can't do this to your own account",
  CREATOR_REQUIRED: "This is a creator's account — only a creator can do this",
  ADMINS_MANAGE_REQUIRED: "This is a console account — you need permission to manage platform users",
  LAST_CREATOR: "This is the last creator",
  USER_ALREADY_SUSPENDED: "Already suspended",
  USER_NOT_SUSPENDED: "Not suspended",
  USER_DELETED: "This account was deleted",
  OWNS_STORES: "This account owns stores — choose to suspend them first",
};

/** The console's own wording for a moderation refusal; anything else passes through. */
export function userModerationError(err: unknown): unknown {
  if (err instanceof ApiError && err.code && ERROR_TEXT[err.code]) return new Error(ERROR_TEXT[err.code]);
  return err;
}

/**
 * Whether the signed-in admin may act on this account at all — the server's
 * target rule for suspend / delete and for the two-step reset: never your own
 * account, a creator's only as a creator, another console account only with
 * `admins.manage`. The action's own permission is checked by the caller.
 */
export function useCanActOnAccount(user: Pick<AdminUserRow, "id" | "platformRole"> | null): boolean {
  const { user: me, can } = useAuth();
  if (!user || !me) return false;
  if (user.id === me.id) return false;
  if (user.platformRole === CREATOR_ROLE && me.platformRole !== CREATOR_ROLE) return false;
  if (user.platformRole && !can(P.ADMINS_MANAGE)) return false;
  return true;
}

/** Active · Pending confirmation · Suspended · Deleted. */
export function AccountStatusBadge({ user }: { user: ModeratedUser }) {
  const { deleted } = adminUserModerationOf(user);
  if (deleted) return <StatusBadge tone="neutral">Deleted</StatusBadge>;
  if (user.status === "pending_verification") return <Status value="pending" label="Pending confirmation" />;
  if (user.status === "suspended") return <Status value="suspended" label="Suspended" />;
  if (user.status === "active") return <Status value="active" label="Active" />;
  return <Status value={user.status} />;
}

/** The badge, and under it why and since when the account is suspended or deleted. */
export function AccountStatus({ user }: { user: ModeratedUser }) {
  const state = adminUserModerationOf(user);
  return (
    <>
      <AccountStatusBadge user={user} />
      {state.deleted ? (
        <span className="mt-1 block text-xs text-ink-soft">
          This account was deleted on {formatDateTime(state.deletedAt)} — its personal details were removed
        </span>
      ) : user.status === "suspended" && state.suspendedAt ? (
        <span className="mt-1 block break-words text-xs text-ink-soft">
          Suspended since {formatDateTime(state.suspendedAt)}
          {state.suspendedReason ? `: ${state.suspendedReason}` : ""}
        </span>
      ) : null}
    </>
  );
}

type Dialog = "suspend" | "unsuspend" | "delete" | null;

/**
 * Suspend account / Lift suspension / Delete account, with their dialogs.
 * Renders nothing without `workspaces.manage`, on your own account, on an
 * account you may not act on, or on a deleted one.
 */
export function UserModerationActions({ user, onChanged }: { user: AdminUserDetail; onChanged: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const allowed = useCanActOnAccount(user);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState("");
  const [suspendStores, setSuspendStores] = useState(false);

  const state = adminUserModerationOf(user);
  if (!can(P.WORKSPACES_MANAGE) || !allowed || state.deleted) return null;

  const suspended = user.status === "suspended";
  const owned = adminUserOwnedStores(user);
  const text = reason.trim();

  function open(next: Dialog) {
    setReason("");
    setSuspendStores(false);
    setDialog(next);
  }

  function close() {
    setDialog(null);
  }

  async function run(action: () => Promise<string>) {
    try {
      const message = await action();
      close();
      toast.success(message);
      onChanged();
    } catch (err) {
      // Someone else acted meanwhile, or ownership changed: show what is true now.
      if (err instanceof ApiError && ["OWNS_STORES", "USER_ALREADY_SUSPENDED", "USER_NOT_SUSPENDED", "USER_DELETED"].includes(err.code ?? "")) {
        onChanged();
      }
      throw userModerationError(err);
    }
  }

  return (
    <>
      {suspended ? (
        <Button variant="outline" onClick={() => open("unsuspend")}>
          Lift suspension
        </Button>
      ) : (
        <Button variant="outline" onClick={() => open("suspend")}>
          Suspend account
        </Button>
      )}
      <Button variant="destructive" onClick={() => open("delete")}>
        Delete account
      </Button>

      <ConfirmDialog
        open={dialog === "suspend"}
        title="Suspend this account?"
        description="This person won't be able to sign in and is signed out everywhere; their API keys and the apps they approved stop until you lift the suspension. Their stores keep running."
        confirmLabel="Suspend"
        destructive
        confirmDisabled={text.length < 2 || text.length > 500}
        onCancel={close}
        onConfirm={() =>
          run(async () => {
            await adminSuspendUser(apiClient, user.id, text);
            return "Account suspended";
          })
        }
      >
        <TextAreaField
          label="Reason"
          required
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          hint="2–500 characters. Kept in the audit log."
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "unsuspend"}
        title="Lift the suspension?"
        confirmLabel="Lift suspension"
        confirmDisabled={text.length > 500}
        onCancel={close}
        onConfirm={() =>
          run(async () => {
            await adminUnsuspendUser(apiClient, user.id, text || undefined);
            return "Suspension lifted";
          })
        }
      >
        <TextAreaField label="Note" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} hint="Optional." />
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "delete"}
        title="Delete this account for good?"
        description="Email, phone, name, username and picture are wiped and the account can never sign in again. Orders and records stay. This can't be undone."
        confirmLabel="Delete account"
        destructive
        confirmDisabled={text.length > 500 || (owned.length > 0 && !suspendStores)}
        onCancel={close}
        onConfirm={() =>
          run(async () => {
            const result = await adminDeleteUser(apiClient, user.id, { reason: text || undefined, suspendStores: owned.length > 0 });
            const n = result.suspendedStores?.length ?? 0;
            return owned.length > 0 ? `Account deleted and ${n} store(s) suspended` : "Account deleted";
          })
        }
      >
        <div className="space-y-4">
          <TextAreaField label="Reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} hint="Optional." />
          {owned.length > 0 && (
            <div className="rounded-[10px] border border-line bg-paper p-3">
              <p className="text-sm text-ink">This account owns:</p>
              <ul className="mt-2 space-y-1">
                {owned.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <bdi className="font-medium text-ink">{s.name}</bdi>
                    <span className="text-xs text-ink-soft">{s.slug}</span>
                    {s.status === "suspended" && <StatusBadge tone="neutral">Already suspended</StatusBadge>}
                  </li>
                ))}
              </ul>
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm font-medium text-ink">
                <input type="checkbox" className="mt-0.5" checked={suspendStores} onChange={(e) => setSuspendStores(e.target.checked)} />
                <span>Suspend their stores ({owned.length})</span>
              </label>
            </div>
          )}
        </div>
      </ConfirmDialog>
    </>
  );
}

function duration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const days = Math.round(seconds / 86400);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** "Where they came from": the site visit an account signed up from. Empty fields are hidden. */
export function AcquisitionPanel({ user }: { user: AdminUserDetail }) {
  const a = siteAcquisitionOfUser(user);
  return (
    <Panel title="Where they came from">
      {!a ? (
        <p className="text-sm text-ink-soft">No data — signed up without going through the site, or before tracking was on</p>
      ) : (
        <>
          <dl>
            {a.landingPath && (
              <DetailRow label="Landing page">
                <bdi dir="ltr" className="break-all">
                  {a.landingPath}
                </bdi>
              </DetailRow>
            )}
            <DetailRow label="Source">
              {a.utmSource || a.referrerHost ? <bdi dir="ltr">{a.utmSource || a.referrerHost}</bdi> : "Direct"}
            </DetailRow>
            {a.utmMedium && <DetailRow label="Medium">{a.utmMedium}</DetailRow>}
            {a.utmCampaign && <DetailRow label="Campaign">{a.utmCampaign}</DetailRow>}
            {a.firstVisitAt && <DetailRow label="First visit">{formatDateTime(a.firstVisitAt)}</DetailRow>}
          </dl>
          {a.secondsBeforeSignup !== null && a.secondsBeforeSignup !== undefined && (
            <p className="mt-3 text-sm text-ink-soft">Signed up {duration(a.secondsBeforeSignup)} after the first visit</p>
          )}
        </>
      )}
    </Panel>
  );
}

/** The Users list: a badge only for the rows that are not in good standing. */
export function UserRowBadge({ user }: { user: AdminUserRowWithDeleted }) {
  const { deleted } = adminUserModerationOf(user);
  if (deleted) return <StatusBadge tone="neutral" className="ms-2 align-middle">Deleted</StatusBadge>;
  if (user.status === "suspended") return <StatusBadge tone="danger" className="ms-2 align-middle">Suspended</StatusBadge>;
  return null;
}
