import { useState, type FormEvent } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { AdminPlatformAdmin as Admin } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField } from "@/components/forms";
import { Panel, Td, Th } from "@/components/Panel";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import * as adminApi from "@/lib/adminApi";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";

export function AdminUsersPage() {
  const toast = useToast();
  const { data, loading, error, refresh } = useAsync(() => adminApi.listAdmins(), []);
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<Admin | null>(null);

  const admins = data ?? [];
  const onlyOne = admins.length <= 1;

  return (
    <div>
      <PageHeader
        title="Admin users"
        description="Who can sign in to this console."
        actions={
          <Button onClick={() => setGranting(true)}>
            <UserPlus /> Grant access
          </Button>
        }
      />
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {admins.length === 0 ? (
          <EmptyBlock message="No platform admins." />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Account</Th>
                  <Th>Last sign-in</Th>
                  <Th>Signed up</Th>
                  <Th className="text-end">
                    <span className="sr-only">Actions</span>
                  </Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((a) => {
                  const blocked = a.isYou
                    ? "You cannot revoke your own access."
                    : onlyOne
                      ? "The last admin cannot be revoked."
                      : null;
                  return (
                    <TableRow key={a.id}>
                      <Td>
                        <span className="font-medium">{a.fullName}</span>
                        {a.isYou && (
                          <StatusBadge tone="primary" className="ms-2">
                            You
                          </StatusBadge>
                        )}
                      </Td>
                      <Td className="text-sm">{a.email}</Td>
                      <Td>
                        <Status value={a.status} />
                      </Td>
                      <Td className="whitespace-nowrap text-sm">
                        {a.lastLoginAt ? (
                          <span title={formatDateTime(a.lastLoginAt)}>{formatRelative(a.lastLoginAt)}</span>
                        ) : (
                          <span className="text-ink-soft">Never</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-sm">{formatDate(a.createdAt)}</Td>
                      <Td className="text-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!!blocked}
                          title={blocked ?? undefined}
                          onClick={() => setRevoking(a)}
                        >
                          <UserMinus className="text-danger" /> Revoke
                        </Button>
                      </Td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Panel>
        )}
        <p className="mt-3 text-xs text-ink-soft">
          Access is a single platform-wide admin flag on an existing account — there are no finer-grained roles yet.
          Every grant and revoke is recorded in the audit log, and takes effect on that person&rsquo;s next request.
        </p>
      </DataState>

      {granting && (
        <GrantModal
          onClose={() => setGranting(false)}
          onGranted={(admin, granted) => {
            toast.success(granted ? `${admin.email} is now a platform admin.` : `${admin.email} was already an admin.`);
            setGranting(false);
            void refresh({ silent: true });
          }}
        />
      )}
      <ConfirmDialog
        open={!!revoking}
        title={`Revoke ${revoking?.fullName ?? ""}'s admin access?`}
        description={`${revoking?.email ?? ""} will lose access to this console on their next request. Their account and store access are not affected.`}
        confirmLabel="Revoke access"
        destructive
        onCancel={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return;
          await adminApi.revokeAdmin(revoking.id);
          toast.success(`Admin access revoked for ${revoking.email}.`);
          setRevoking(null);
          void refresh({ silent: true });
        }}
      />
    </div>
  );
}

function GrantModal({ onClose, onGranted }: { onClose: () => void; onGranted: (admin: Admin, granted: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { admin, granted } = await adminApi.grantAdmin(email.trim());
      onGranted(admin, granted);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Grant admin access"
      description="The person needs an active Zimos account first — there are no invitations."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="grant-form" disabled={busy || !email.trim()}>
            {busy ? "Granting…" : "Grant access"}
          </Button>
        </>
      }
    >
      <form id="grant-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextField
          label="Account email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint="Full access to this console: every workspace, plan, flag and blocklist."
        />
      </form>
    </Modal>
  );
}
