import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { RoleMatrixPanel } from "@/components/RoleMatrixPanel";
import { ShieldCheck, ShieldOff, UserPlus } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow, cn } from "@store-builder/ui";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NativeSelect, SearchInput, TextField } from "@/components/forms";
import { Panel, Td, Th } from "@/components/Panel";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { adminApi } from "@/mock/adminApi";
import { ADMIN_ROLES } from "@/mock/constants";
import type { AdminRole, AdminUser } from "@/mock/types";
import { formatRelative, initials } from "@/lib/format";

export function AdminUsersPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { data, loading, error, refresh, setData } = useAsync(() => adminApi.listAdminUsers(), []);
  const [query, setQuery] = useState("");
  const [params, setParams] = useSearchParams();
  const [inviting, setInvitingState] = useState(params.get("invite") === "1");
  const setInviting = (v: boolean) => {
    setInvitingState(v);
    if (!v && params.get("invite")) setParams({}, { replace: true });
  };
  const [toggling, setToggling] = useState<AdminUser | null>(null);

  const rows = useMemo(() => data ?? [], [data]);
  const replace = (u: AdminUser) => setData((prev) => (prev ?? []).map((x) => (x.id === u.id ? u : x)));
  const filtered = rows.filter((u) => {
    const q = query.trim().toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  async function changeRole(u: AdminUser, role: AdminRole) {
    try {
      replace(await adminApi.updateAdminUser(u.id, { role }));
      toast.success(`${u.name} is now ${ADMIN_ROLES.find((r) => r.value === role)?.label ?? role}.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function resend(u: AdminUser) {
    try {
      replace(await adminApi.resendAdminInvite(u.id));
      toast.success(`Invitation re-sent to ${u.email}.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader
        title="Admin users & roles"
        description="ZIMOS team members with access to this console, their roles and what each role can do."
        actions={
          <Button onClick={() => setInviting(true)}>
            <UserPlus /> Invite admin
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {ADMIN_ROLES.map((r) => (
          <div key={r.value} className="rounded-[var(--radius-card)] border border-line bg-paper-raised px-4 py-3 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">{r.label}</p>
              <span className="tabular text-sm text-ink-soft">{rows.filter((u) => u.role === r.value && u.status !== "disabled").length}</span>
            </div>
            <p className="mt-0.5 text-xs text-ink-soft">{r.description}</p>
          </div>
        ))}
      </div>

      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        <div className="mb-4">
          <SearchInput value={query} onChange={setQuery} placeholder="Search name or email" />
        </div>
        {filtered.length === 0 ? (
          <EmptyBlock message={rows.length === 0 ? "No admin users." : "No admins match your search."} />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>Admin</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>MFA</Th>
                  <Th>Last active</Th>
                  <Th className="text-end">Actions</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const isMe = !!user && user.email.toLowerCase() === u.email.toLowerCase();
                  return (
                    <TableRow key={u.id} className={cn(u.status === "disabled" && "opacity-60")}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zimos-navy text-xs font-semibold text-white" aria-hidden>
                            {initials(u.name)}
                          </span>
                          <div>
                            <span className="block font-medium">
                              {u.name}
                              {isMe && <span className="ms-1.5 text-xs font-normal text-ink-soft">(you)</span>}
                            </span>
                            <span className="text-xs text-ink-soft">{u.email}</span>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <NativeSelect
                          aria-label={`Role for ${u.name}`}
                          value={u.role}
                          disabled={u.status === "disabled"}
                          onChange={(e) => void changeRole(u, e.target.value as AdminRole)}
                          className="h-8 w-36 text-xs"
                        >
                          {ADMIN_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </NativeSelect>
                      </Td>
                      <Td>
                        <Status value={u.status} />
                      </Td>
                      <Td>
                        {u.mfaEnabled ? (
                          <StatusBadge tone="success">
                            <ShieldCheck /> On
                          </StatusBadge>
                        ) : (
                          <StatusBadge tone="warning">
                            <ShieldOff /> Off
                          </StatusBadge>
                        )}
                      </Td>
                      <Td className="text-ink-soft">{u.lastActiveAt ? formatRelative(u.lastActiveAt) : u.status === "invited" ? `Invited ${formatRelative(u.invitedAt)}` : "Never"}</Td>
                      <Td>
                        <div className="flex justify-end gap-1.5">
                          {u.status === "invited" && (
                            <Button size="sm" variant="outline" onClick={() => void resend(u)}>
                              Resend invite
                            </Button>
                          )}
                          {u.status !== "invited" && !isMe && (
                            <Button size="sm" variant={u.status === "disabled" ? "outline" : "ghost"} className={cn(u.status !== "disabled" && "text-danger")} onClick={() => setToggling(u)}>
                              {u.status === "disabled" ? "Enable" : "Disable"}
                            </Button>
                          )}
                        </div>
                      </Td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Panel>
        )}
      </DataState>

      <div className="mt-6">
        <RoleMatrixPanel />
      </div>

      {inviting && (
        <InviteModal
          onClose={() => setInviting(false)}
          onInvited={(u) => {
            setData((prev) => [...(prev ?? []), u]);
            toast.success(`Invitation sent to ${u.email}.`);
            setInviting(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!toggling}
        title={toggling?.status === "disabled" ? `Enable ${toggling?.name ?? ""}?` : `Disable ${toggling?.name ?? ""}?`}
        description={toggling?.status === "disabled" ? "They can sign in to the console again." : "They are signed out immediately and can't sign in until re-enabled."}
        confirmLabel={toggling?.status === "disabled" ? "Enable" : "Disable"}
        destructive={toggling?.status !== "disabled"}
        onCancel={() => setToggling(null)}
        onConfirm={async () => {
          if (!toggling) return;
          replace(await adminApi.updateAdminUser(toggling.id, { status: toggling.status === "disabled" ? "active" : "disabled" }));
          toast.success("Admin updated.");
          setToggling(null);
        }}
      />
    </div>
  );
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: (u: AdminUser) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("support");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onInvited(await adminApi.inviteAdminUser({ name, email, role }));
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Invite admin"
      description="They receive an email to set a password and enable MFA."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form" disabled={busy}>
            {busy ? "Sending…" : "Send invitation"}
          </Button>
        </>
      }
    >
      <form id="invite-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextField label="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Work email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Role</legend>
          <div className="space-y-2" role="radiogroup">
            {ADMIN_ROLES.map((r) => (
              <label
                key={r.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-[10px] border px-3 py-2.5",
                  role === r.value ? "border-primary bg-primary-soft" : "border-line hover:border-line-strong"
                )}
              >
                <input type="radio" name="role" className="mt-0.5 size-4 accent-[var(--color-primary)]" checked={role === r.value} onChange={() => setRole(r.value)} />
                <span>
                  <span className="block text-sm font-medium text-ink">{r.label}</span>
                  <span className="block text-xs text-ink-soft">{r.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
