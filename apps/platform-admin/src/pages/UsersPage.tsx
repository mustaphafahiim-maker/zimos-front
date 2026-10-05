import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { AdminUserStore } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { SearchInput } from "@/components/forms";
import { Panel, Td, Th } from "@/components/Panel";
import { CopyId } from "@/components/CopyId";
import { UserStateBadge } from "@/components/userModeration";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 25;

/** A store chip: its name, the person's role there and the subscription state. */
export function StoreChip({ store }: { store: AdminUserStore }) {
  const phase = store.subscription?.phase;
  const tone =
    phase === "restricted" || phase === "grace"
      ? "border-danger/40 text-danger"
      : phase === "payment_due" || phase === "expiring"
        ? "border-warning/50 text-warning"
        : "border-line text-ink-soft";
  return (
    <Link
      to={`/workspaces/${store.id}`}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:border-primary hover:text-primary ${
        store.matched ? "bg-primary-soft" : ""
      } ${tone}`}
      title={`${store.name} (${store.slug}) — ${store.role}${store.subscription ? `, ${store.subscription.status}` : ""}`}
    >
      <span className="truncate font-medium text-ink">{store.name}</span>
      <span>· {store.role}</span>
      {store.subscription && <span>· {store.subscription.status}</span>}
    </Link>
  );
}

/**
 * Every account on the platform, one search box for all of it: name (Arabic
 * spelled any way), username, email, id (whole or its first 8+ characters),
 * or a store's name / address / id — which lists the people behind it. The
 * search and the page live in the URL, so a result can be linked to.
 */
export function UsersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [draft, setDraft] = useState(q);

  // Typing settles for a moment before it becomes a search (and a URL).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft.trim() === q) return;
      const next = new URLSearchParams();
      if (draft.trim()) next.set("q", draft.trim());
      setParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft, q, setParams]);

  const { data, loading, error, refresh } = useAsync(() => adminApi.searchUsers({ q, page, limit: PAGE_SIZE }), [q, page]);

  const goTo = (p: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    setParams(next);
  };

  return (
    <div>
      <PageHeader title="Users" description="Every account on the platform, and the stores they own or work in." />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          value={draft}
          onChange={setDraft}
          placeholder="Name, username, email, ID or store"
          className="sm:w-96"
        />
        {data && (
          <span className="text-sm text-ink-soft sm:ms-auto" aria-live="polite">
            {data.total} {data.total === 1 ? "user" : "users"}
          </span>
        )}
      </div>

      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {data && data.users.length === 0 ? (
          <EmptyBlock message={q ? `No user matches “${q}”.` : "No users yet."} />
        ) : (
          data && (
            <>
              <Panel flush>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <Th>User</Th>
                      <Th>Email</Th>
                      <Th>ID</Th>
                      <Th>Stores</Th>
                      <Th>Joined</Th>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.users.map((u) => (
                      <TableRow key={u.id} className="cursor-pointer" onClick={() => navigate(`/users/${u.id}`)}>
                        <Td>
                          <Link
                            to={`/users/${u.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block font-medium text-ink hover:text-primary"
                          >
                            <bdi>{u.fullName}</bdi>
                          </Link>
                          <span dir="ltr" className="text-xs text-ink-soft">
                            {u.username ? `@${u.username}` : "no username yet"}
                          </span>
                          <span className="ms-2">
                            <UserStateBadge status={u.status} deleted={u.deleted} />
                          </span>
                        </Td>
                        <Td className="break-all text-ink-soft">
                          <bdi dir="ltr">{u.email}</bdi>
                        </Td>
                        <Td>
                          <CopyId value={u.id} />
                        </Td>
                        <Td>
                          {u.workspaces.length === 0 ? (
                            <span className="text-xs text-ink-soft">—</span>
                          ) : (
                            <div className="flex max-w-md flex-wrap gap-1">
                              {u.workspaces.map((s) => (
                                <StoreChip key={s.id} store={s} />
                              ))}
                            </div>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap text-ink-soft">{formatDate(u.createdAt)}</Td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
              {(data.page > 1 || data.hasMore) && (
                <nav aria-label="Pages" className="mt-4 flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => goTo(data.page - 1)}>
                    <ChevronLeft className="rtl:rotate-180" aria-hidden /> Previous
                  </Button>
                  <span className="text-sm text-ink-soft">Page {data.page}</span>
                  <Button variant="outline" size="sm" disabled={!data.hasMore} onClick={() => goTo(data.page + 1)}>
                    Next <ChevronRight className="rtl:rotate-180" aria-hidden />
                  </Button>
                </nav>
              )}
            </>
          )
        )}
      </DataState>
    </div>
  );
}
