import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, MailCheck, ShieldCheck, ShieldOff, UserX, UserCheck } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Drawer, DetailRow } from "@/components/Drawer";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilterChips, SearchInput } from "@/components/forms";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { useAction } from "@/components/controls";
import { useAsync } from "@store-builder/ui";
import { formatDate, formatRelative, initials } from "@/lib/format";
import { controlApi } from "@/mock/controlApi";
import type { PlatformUser, PlatformUserStatus } from "@/mock/controlTypes";

type StatusFilter = "all" | PlatformUserStatus;
type AdminFilter = "any" | "admins" | "non_admins";
type Pending = { kind: "suspend" | "reactivate" | "grant" | "revoke" | "reset"; user: PlatformUser } | null;

export function UsersPage() {
  const { data, loading, error, refresh, setData } = useAsync(() => controlApi.listUsers(), []);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [adminFilter, setAdminFilter] = useState<AdminFilter>("any");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const { busy, run } = useAction();

  const rows = useMemo(() => data ?? [], [data]);
  const replace = (u: PlatformUser) => setData((prev) => (prev ?? []).map((x) => (x.id === u.id ? u : x)));
  const selected = rows.find((u) => u.id === selectedId) ?? null;

  const filtered = rows.filter((u) => {
    const q = query.trim().toLowerCase();
    if (q && !`${u.name} ${u.email} ${u.id} ${u.phone ?? ""}`.toLowerCase().includes(q)) return false;
    if (status !== "all" && u.status !== status) return false;
    if (adminFilter === "admins" && !u.platformAdmin) return false;
    if (adminFilter === "non_admins" && u.platformAdmin) return false;
    return true;
  });

  const count = (s: PlatformUserStatus) => rows.filter((u) => u.status === s).length;

  return (
    <div>
      <PageHeader title="Users" description="Every account on the platform — merchants, staff and ZIMOS admins." />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips<StatusFilter>
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All", count: rows.length },
              { value: "active", label: "Active", count: count("active") },
              { value: "pending", label: "Pending", count: count("pending") },
              { value: "suspended", label: "Suspended", count: count("suspended") },
            ]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <FilterChips<AdminFilter>
              value={adminFilter}
              onChange={setAdminFilter}
              options={[
                { value: "any", label: "Anyone" },
                { value: "admins", label: "Platform admins", count: rows.filter((u) => u.platformAdmin).length },
                { value: "non_admins", label: "Non-admins" },
              ]}
            />
            <SearchInput value={query} onChange={setQuery} placeholder="Search name, email, id" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyBlock message={rows.length === 0 ? "No users yet." : "No users match these filters."} />
        ) : (
          <Panel flush>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <Th>User</Th>
                    <Th>Status</Th>
                    <Th>Email</Th>
                    <Th>Workspaces</Th>
                    <Th>Last login</Th>
                    <Th>Joined</Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.id} className="cursor-pointer" onClick={() => setSelectedId(u.id)}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zimos-navy text-xs font-semibold text-white" aria-hidden>
                            {initials(u.name)}
                          </span>
                          <div className="min-w-0">
                            <button type="button" className="block cursor-pointer truncate text-start font-medium hover:text-primary" onClick={() => setSelectedId(u.id)}>
                              {u.name}
                            </button>
                            <span className="block truncate text-xs text-ink-soft">{u.email}</span>
                          </div>
                          {u.platformAdmin && <StatusBadge tone="primary">Admin</StatusBadge>}
                        </div>
                      </Td>
                      <Td><Status value={u.status} /></Td>
                      <Td>{u.emailVerified ? <StatusBadge tone="success">Verified</StatusBadge> : <StatusBadge tone="warning">Unverified</StatusBadge>}</Td>
                      <Td className="text-ink-soft">{u.workspaces.length}</Td>
                      <Td className="text-ink-soft">{u.lastLoginAt ? formatRelative(u.lastLoginAt) : "Never"}</Td>
                      <Td className="text-ink-soft">{formatDate(u.createdAt)}</Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        )}
      </DataState>

      <Drawer open={!!selected} onClose={() => setSelectedId(null)} title={selected?.name ?? "User"} description={selected?.email}>
        {selected && (
          <div className="space-y-5">
            {selected.status === "suspended" && <Alert variant="danger">This account is suspended and can't sign in.</Alert>}
            <dl>
              <DetailRow label="User ID"><Mono>{selected.id}</Mono></DetailRow>
              <DetailRow label="Status"><Status value={selected.status} /></DetailRow>
              <DetailRow label="Email">{selected.emailVerified ? "Verified" : "Not verified"}</DetailRow>
              <DetailRow label="Phone">{selected.phone ?? "—"}</DetailRow>
              <DetailRow label="Platform admin">{selected.platformAdmin ? "Yes" : "No"}</DetailRow>
              <DetailRow label="Last login">{selected.lastLoginAt ? formatRelative(selected.lastLoginAt) : "Never"}</DetailRow>
              <DetailRow label="Password reset">{selected.passwordResetSentAt ? `Link sent ${formatRelative(selected.passwordResetSentAt)}` : "—"}</DetailRow>
            </dl>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Workspaces</h3>
              {selected.workspaces.length === 0 ? (
                <p className="text-sm text-ink-soft">Not a member of any workspace.</p>
              ) : (
                <ul className="divide-y divide-line rounded-[10px] border border-line">
                  {selected.workspaces.map((w) => (
                    <li key={w.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <Link to={`/workspaces/${w.id}`} className="truncate font-medium text-ink hover:text-primary">{w.name}</Link>
                      <StatusBadge tone={w.role === "owner" ? "primary" : "neutral"}>{w.role}</StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button variant="outline" disabled={selected.emailVerified || busy === "verify"} onClick={() => void run("verify", () => controlApi.verifyUserEmail(selected.id), "Email marked as verified.").then((u) => u && replace(u))}>
                <MailCheck /> Verify email manually
              </Button>
              <Button variant="outline" onClick={() => setPending({ kind: "reset", user: selected })}>
                <KeyRound /> Send password reset
              </Button>
              {selected.status === "suspended" ? (
                <Button variant="outline" onClick={() => setPending({ kind: "reactivate", user: selected })}><UserCheck /> Reactivate</Button>
              ) : (
                <Button variant="destructive" onClick={() => setPending({ kind: "suspend", user: selected })}><UserX /> Suspend</Button>
              )}
              {selected.platformAdmin ? (
                <Button variant="outline" className="text-danger" onClick={() => setPending({ kind: "revoke", user: selected })}><ShieldOff /> Revoke platform admin</Button>
              ) : (
                <Button variant="outline" onClick={() => setPending({ kind: "grant", user: selected })}><ShieldCheck /> Grant platform admin</Button>
              )}
            </div>
            <p className="text-xs text-ink-soft">Platform admin changes are mock-only — the backend has no route for toggling users.platform_admin yet.</p>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!pending}
        title={
          pending?.kind === "suspend" ? `Suspend ${pending.user.name}?`
          : pending?.kind === "reactivate" ? `Reactivate ${pending.user.name}?`
          : pending?.kind === "grant" ? `Grant platform admin to ${pending.user.name}?`
          : pending?.kind === "revoke" ? `Revoke platform admin from ${pending.user.name}?`
          : `Send password reset to ${pending?.user.email ?? ""}?`
        }
        description={
          pending?.kind === "suspend" ? "They are signed out everywhere and can't sign in. Their workspaces stay online."
          : pending?.kind === "grant" ? "They get full access to this console. Only grant to ZIMOS staff."
          : pending?.kind === "revoke" ? "They lose access to this console immediately."
          : pending?.kind === "reset" ? "They receive an email with a one-time reset link (mock)."
          : "They can sign in again."
        }
        destructive={pending?.kind === "suspend" || pending?.kind === "revoke" || pending?.kind === "grant"}
        confirmLabel={pending?.kind === "reset" ? "Send link" : "Confirm"}
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          const u = pending.user;
          const next =
            pending.kind === "suspend" ? await controlApi.setUserStatus(u.id, "suspended")
            : pending.kind === "reactivate" ? await controlApi.setUserStatus(u.id, "active")
            : pending.kind === "grant" ? await controlApi.setPlatformAdmin(u.id, true)
            : pending.kind === "revoke" ? await controlApi.setPlatformAdmin(u.id, false)
            : await controlApi.sendPasswordReset(u.id);
          replace(next);
          setPending(null);
        }}
      />
    </div>
  );
}
