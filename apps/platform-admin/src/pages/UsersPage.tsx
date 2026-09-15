import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Ban, CheckCircle2, RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Panel, Td, Th } from "@/components/Panel";
import { FilterChips, SearchInput } from "@/components/forms";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { adminApi, type AdminUser } from "@/lib/adminApi";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Users",
    description: "Every account on the platform. Platform admins can open this console.",
    search: "Search by email or name…",
    everyone: "Everyone",
    admins: "Platform admins",
    user: "User",
    workspaces: "Workspaces",
    verified: "Email verified",
    lastLogin: "Last login",
    joined: "Joined",
    admin: "Admin",
    you: "You",
    promote: "Make admin",
    demote: "Remove admin",
    suspend: "Suspend",
    activate: "Activate",
    promoteTitle: "Give {email} platform admin access?",
    promoteDesc: "They'll be able to open this console and change any workspace, plan or user.",
    demoteTitle: "Remove platform admin access from {email}?",
    demoteDesc: "They lose access to this console immediately. Their merchant access is unchanged.",
    suspendTitle: "Suspend {email}?",
    suspendDesc: "They won't be able to sign in until the account is activated again.",
    activateTitle: "Activate {email}?",
    activateDesc: "The account becomes active and can sign in.",
    updated: "{email} updated.",
    empty: "No users found.",
    noAdmins: "No platform admins found.",
    loaded: "Showing {n} user(s)",
    selfHint: "You can't change your own admin access or status.",
  },
  ar: {
    title: "المستخدمين",
    description: "كل الحسابات على المنصة. أدمن المنصة بس هو اللي يقدر يفتح اللوحة دي.",
    search: "دوّر بالإيميل أو الاسم…",
    everyone: "الكل",
    admins: "أدمن المنصة",
    user: "المستخدم",
    workspaces: "مساحات العمل",
    verified: "الإيميل متأكد",
    lastLogin: "آخر دخول",
    joined: "انضم",
    admin: "أدمن",
    you: "إنت",
    promote: "خليه أدمن",
    demote: "شيل الأدمن",
    suspend: "إيقاف",
    activate: "تفعيل",
    promoteTitle: "تدي {email} صلاحية أدمن المنصة؟",
    promoteDesc: "هيقدر يفتح اللوحة دي ويعدّل أي مساحة عمل أو باقة أو مستخدم.",
    demoteTitle: "تشيل صلاحية أدمن المنصة من {email}؟",
    demoteDesc: "هيفقد الوصول للوحة دي فورًا. صلاحياته كتاجر مش هتتغير.",
    suspendTitle: "توقف {email}؟",
    suspendDesc: "مش هيقدر يسجل دخول لحد ما الحساب يتفعّل تاني.",
    activateTitle: "تفعّل {email}؟",
    activateDesc: "الحساب هيبقى نشط ويقدر يسجل دخول.",
    updated: "{email} اتعدّل.",
    empty: "مفيش مستخدمين.",
    noAdmins: "مفيش أدمن للمنصة.",
    loaded: "بنعرض {n} مستخدم",
    selfHint: "مينفعش تغيّر صلاحية الأدمن أو الحالة بتاعتك.",
  },
};

type Pending = { user: AdminUser; kind: "promote" | "demote" | "suspend" | "activate" } | null;
const PAGE = 100;

export function UsersPage() {
  const t = useT(STRINGS);
  const c = useCommon();
  const toast = useToast();
  const { user: me } = useAuth();
  const [params, setParams] = useSearchParams();
  const adminsOnly = params.get("admins") === "1";
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<Pending>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        // The backend has no admin filter, so the admins view walks every page.
        let res = await adminApi.listUsers({ search: debounced, limit: PAGE });
        let all = res.users;
        while (adminsOnly && res.nextCursor && !cancelled) {
          res = await adminApi.listUsers({ search: debounced, limit: PAGE, before: res.nextCursor });
          all = [...all, ...res.users];
        }
        if (cancelled) return;
        setUsers(all);
        setCursor(res.nextCursor);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, adminsOnly, reloadKey]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await adminApi.listUsers({ search: debounced, limit: PAGE, before: cursor });
      setUsers((prev) => [...prev, ...res.users]);
      setCursor(res.nextCursor);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  const shown = useMemo(() => (adminsOnly ? users.filter((u) => u.platformAdmin) : users), [users, adminsOnly]);

  const copy = pending
    ? {
        promote: { title: t.promoteTitle, desc: t.promoteDesc, label: t.promote, destructive: false },
        demote: { title: t.demoteTitle, desc: t.demoteDesc, label: t.demote, destructive: true },
        suspend: { title: t.suspendTitle, desc: t.suspendDesc, label: t.suspend, destructive: true },
        activate: { title: t.activateTitle, desc: t.activateDesc, label: t.activate, destructive: false },
      }[pending.kind]
    : null;

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)} disabled={loading}>
            <RefreshCw /> {c.refresh}
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips
          value={adminsOnly ? "admins" : "all"}
          onChange={(v) => setParams(v === "admins" ? { admins: "1" } : {}, { replace: true })}
          options={[
            { value: "all", label: t.everyone },
            { value: "admins", label: t.admins },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder={t.search} />
      </div>
      <DataState loading={loading} error={error} onRetry={() => setReloadKey((k) => k + 1)} empty={!loading && shown.length === 0} emptyMessage={adminsOnly ? t.noAdmins : t.empty}>
        <Panel flush>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>{t.user}</Th>
                  <Th>{c.status}</Th>
                  <Th className="text-end">{t.workspaces}</Th>
                  <Th>{t.verified}</Th>
                  <Th>{t.lastLogin}</Th>
                  <Th>{t.joined}</Th>
                  <Th className="text-end">{c.actions}</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((u) => {
                  const self = u.id === me?.id;
                  return (
                    <TableRow key={u.id}>
                      <Td>
                        <span className="flex flex-wrap items-center gap-1.5 font-medium">
                          {u.fullName || "—"}
                          {u.platformAdmin && (
                            <StatusBadge tone="primary" dot>
                              {t.admin}
                            </StatusBadge>
                          )}
                          {self && <StatusBadge tone="neutral">{t.you}</StatusBadge>}
                        </span>
                        <span className="block text-xs text-ink-soft" dir="ltr">
                          {u.email}
                        </span>
                      </Td>
                      <Td>
                        <Status value={u.status} />
                      </Td>
                      <Td className="tabular text-end">{formatNumber(u.workspaces)}</Td>
                      <Td className="text-ink-soft">{u.emailVerifiedAt ? formatDate(u.emailVerifiedAt) : c.no}</Td>
                      <Td className="text-ink-soft">{formatRelative(u.lastLoginAt)}</Td>
                      <Td className="text-ink-soft">{formatDate(u.createdAt)}</Td>
                      <Td className="text-end">
                        <div className="flex justify-end gap-2" title={self ? t.selfHint : undefined}>
                          <Button variant="outline" size="sm" disabled={self} onClick={() => setPending({ user: u, kind: u.platformAdmin ? "demote" : "promote" })}>
                            {u.platformAdmin ? <ShieldOff /> : <ShieldCheck />} {u.platformAdmin ? t.demote : t.promote}
                          </Button>
                          {u.status === "suspended" ? (
                            <Button variant="outline" size="sm" disabled={self} onClick={() => setPending({ user: u, kind: "activate" })}>
                              <CheckCircle2 /> {t.activate}
                            </Button>
                          ) : (
                            <Button variant="destructive" size="sm" disabled={self} onClick={() => setPending({ user: u, kind: "suspend" })}>
                              <Ban /> {t.suspend}
                            </Button>
                          )}
                        </div>
                      </Td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Panel>
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-xs text-ink-muted">{fmt(t.loaded, { n: formatNumber(shown.length) })}</p>
          {cursor && !adminsOnly && (
            <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? c.loading : c.loadMore}
            </Button>
          )}
        </div>
      </DataState>

      <ConfirmDialog
        open={pending !== null}
        title={copy && pending ? fmt(copy.title, { email: pending.user.email }) : ""}
        description={copy?.desc}
        confirmLabel={copy?.label}
        destructive={copy?.destructive}
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          const patch =
            pending.kind === "promote" ? { platformAdmin: true } : pending.kind === "demote" ? { platformAdmin: false } : { status: pending.kind === "suspend" ? "suspended" : "active" };
          const updated = await adminApi.updateUser(pending.user.id, patch);
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, status: updated.status, platformAdmin: updated.platformAdmin } : u)));
          toast.success(fmt(t.updated, { email: updated.email }));
          setPending(null);
        }}
      />
    </div>
  );
}
