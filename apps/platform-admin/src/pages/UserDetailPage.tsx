import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { twoFactorRecoveryAdminReset, twoFactorRecoveryOfUser } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { DetailRow } from "@/components/Drawer";
import { Panel, Td, Th } from "@/components/Panel";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { CopyId } from "@/components/CopyId";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatDate, formatRelative } from "@/lib/format";

/** One account: who they are, and every store they own or work in. */
export function UserDetailPage() {
  const { id = "" } = useParams();
  const { data: user, loading, error, refresh } = useAsync(() => adminApi.getUser(id), [id]);
  // Two-step sign-in, and support's reset for a person locked out of it (auth/twoFactorRecovery.js).
  const { can } = useAuth();
  const toast = useToast();
  const [resetting, setResetting] = useState(false);
  const twoFactor = user ? twoFactorRecoveryOfUser(user) : null;
  const MODE: Record<string, string> = { off: "Off", email: "Email code", totp: "Authenticator app", whatsapp: "WhatsApp code" };

  return (
    <div>
      <PageHeader
        title={user ? user.fullName : "User"}
        description={user?.username ? `@${user.username}` : undefined}
        back={{ to: "/users", label: "Users" }}
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {user && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Account">
              <dl>
                <DetailRow label="Name">
                  <bdi>{user.fullName}</bdi>
                </DetailRow>
                <DetailRow label="Username">
                  {user.username ? <bdi dir="ltr">@{user.username}</bdi> : <span className="text-ink-soft">Not chosen yet</span>}
                  {user.usernameChangedAt && (
                    <span className="ms-2 text-xs text-ink-soft">changed {formatRelative(user.usernameChangedAt)}</span>
                  )}
                </DetailRow>
                <DetailRow label="Email">
                  <bdi dir="ltr" className="break-all">
                    {user.email}
                  </bdi>
                  {user.emailVerified ? (
                    <StatusBadge tone="success" className="ms-2">
                      Verified
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="warning" className="ms-2">
                      Not verified
                    </StatusBadge>
                  )}
                </DetailRow>
                <DetailRow label="Phone">{user.phone ? <bdi dir="ltr">{user.phone}</bdi> : "—"}</DetailRow>
                <DetailRow label="User ID">
                  <CopyId value={user.id} full />
                </DetailRow>
                <DetailRow label="Status">
                  <Status value={user.status} />
                </DetailRow>
                <DetailRow label="Platform role">{user.platformRole ?? "—"}</DetailRow>
                <DetailRow label="Joined">
                  {formatDate(user.createdAt)}
                  <span className="ms-2 text-xs text-ink-soft">{formatRelative(user.createdAt)}</span>
                </DetailRow>
                <DetailRow label="Last sign-in">{user.lastLoginAt ? formatRelative(user.lastLoginAt) : "—"}</DetailRow>
                {twoFactor && (
                  <DetailRow label="Two-step sign-in">
                    {MODE[twoFactor.mode] ?? twoFactor.mode}
                    {twoFactor.enabledAt && <span className="ms-2 text-xs text-ink-soft">since {formatDate(twoFactor.enabledAt)}</span>}
                    {twoFactor.mode !== "off" && can("support.manage") && (
                      <Button size="sm" variant="outline" className="ms-3" onClick={() => setResetting(true)}>
                        Turn off
                      </Button>
                    )}
                  </DetailRow>
                )}
              </dl>
            </Panel>

            <Panel title="Stores" flush={user.workspaces.length > 0}>
              {user.workspaces.length === 0 ? (
                <EmptyBlock message="This person owns no store and belongs to none." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <Th>Store</Th>
                      <Th>Role</Th>
                      <Th>Subscription</Th>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.workspaces.map((s) => (
                      <TableRow key={s.id}>
                        <Td>
                          <Link to={`/workspaces/${s.id}`} className="block font-medium text-ink hover:text-primary">
                            <bdi>{s.name}</bdi>
                          </Link>
                          <span className="text-xs text-ink-soft">{s.slug}</span>
                        </Td>
                        <Td className="capitalize">{s.role.replace(/_/g, " ")}</Td>
                        <Td>
                          {s.subscription ? (
                            <>
                              <Status value={s.subscription.status} />
                              <span className="block text-xs text-ink-soft">
                                {s.subscription.plan ?? "—"} · until {formatDate(s.subscription.currentPeriodEnd)}
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </Td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Panel>
          </div>
        )}
      </DataState>
      <ConfirmDialog
        open={resetting}
        title="Turn off two-step sign-in?"
        description="Only for a person who lost every way through it, after you have checked who they are. They are signed out everywhere, remembered browsers are forgotten, and they get an email saying so."
        confirmLabel="Turn off"
        destructive
        onCancel={() => setResetting(false)}
        onConfirm={async () => {
          await twoFactorRecoveryAdminReset(apiClient, id);
          setResetting(false);
          toast.success("Two-step sign-in is off. The person was emailed.");
          void refresh();
        }}
      />
    </div>
  );
}
