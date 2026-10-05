import { Link, useParams } from "react-router-dom";
import { Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { DetailRow } from "@/components/Drawer";
import { Panel, Td, Th } from "@/components/Panel";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { CopyId } from "@/components/CopyId";
import { UserModerationActions, UserStateBadge } from "@/components/userModeration";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatDate, formatRelative } from "@/lib/format";

/** One account: who they are, and every store they own or work in. */
export function UserDetailPage() {
  const { id = "" } = useParams();
  const { data: user, loading, error, refresh } = useAsync(() => adminApi.getUser(id), [id]);

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
                  <span className="ms-2">
                    <UserStateBadge status={user.status} deleted={Boolean(user.deletedAt)} />
                  </span>
                </DetailRow>
                {user.suspendedReason && <DetailRow label="Suspension reason">{user.suspendedReason}</DetailRow>}
                {user.deletedAt && <DetailRow label="Deleted">{formatDate(user.deletedAt)}</DetailRow>}
                <DetailRow label="Platform role">{user.platformRole ?? "—"}</DetailRow>
                <DetailRow label="Joined">
                  {formatDate(user.createdAt)}
                  <span className="ms-2 text-xs text-ink-soft">{formatRelative(user.createdAt)}</span>
                </DetailRow>
                <DetailRow label="Last sign-in">{user.lastLoginAt ? formatRelative(user.lastLoginAt) : "—"}</DetailRow>
              </dl>
              <div className="mt-4">
                <UserModerationActions user={user} onChanged={() => void refresh()} />
              </div>
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
    </div>
  );
}
