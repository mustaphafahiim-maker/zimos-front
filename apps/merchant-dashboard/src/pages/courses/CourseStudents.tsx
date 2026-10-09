import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { ApiError, coursesEnroll, coursesSetEnrollmentRevoked, coursesStudents, type CourseStudent, type CourseStudents as StudentsData } from "@store-builder/api-client";
import { ContactActions } from "@/components/ContactActions";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { TextField } from "@/components/Field";
import { IconCopy, IconCustomers, IconLock, IconPeople, IconPhone, IconSearch, IconUnlock, IconUserAdd, IconWhatsApp } from "@/components/icons";
import { ChipRow, ListRowCard, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { Modal } from "@/components/Modal";
import { QuickLook } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useViewNavigate } from "@/lib/viewTransition";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import { dialablePhone, orderTelHref } from "@/pages/home/today/OrderQuickLook";
import { FactList, fold, matches } from "@/pages/quotes/kit/Facts";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction, rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { COURSE_STRINGS } from "./courseText";

type AccessFilter = "all" | "active" | "revoked";

const STUDENT_COLUMNS = "grid-cols-[minmax(0,1.4fr)_max-content_max-content_max-content_max-content]";
const LINK = "inline-flex min-h-11 items-center text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary pointer-fine:min-h-0";

/**
 * Who has the course: search, access as chips with their counts, and a row
 * per student whose ONE action removes the access or gives it back — each can
 * be taken back from its toast. A row opens Quick Look (the customer's page is
 * "open fully"); «ادّي صلاحية» enrolls someone by phone, in a sheet.
 */
export function CourseStudents({ courseId }: { courseId: string }) {
  const t = useT(COURSE_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const navigate = useViewNavigate();
  const copy = useCopy();
  const compact = useIsCompact();

  const list = useAsync<StudentsData>(() => coursesStudents(apiClient, workspaceId, courseId), [workspaceId, courseId]);
  const students = useMemo(() => list.data?.students ?? [], [list.data]);
  const total = list.data?.lessonsCount ?? 0;
  const [filter, setFilter] = useState<AccessFilter>("all");
  const [search, setSearch] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [peek, setPeek] = useState<{ id: string; open: boolean } | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());

  const query = fold(search.trim());
  const visible = useMemo(
    () => students.filter((s) => (filter === "all" || (filter === "revoked") === Boolean(s.revokedAt)) && matches(query, [s.name, s.phone])),
    [students, filter, query]
  );
  const revokedCount = students.filter((s) => s.revokedAt).length;
  const chips: ChipItem<AccessFilter>[] = [
    { value: "all", label: t.all, count: list.data ? students.length : null },
    { value: "active", label: t.stActive, count: list.data ? students.length - revokedCount : null },
    { value: "revoked", label: t.stRevoked, count: list.data ? revokedCount : null },
  ];
  const peeked = peek ? (students.find((s) => s.id === peek.id) ?? null) : null;

  /** Sends the change; the answer is the whole list again. Throws when the server says no. */
  async function send(enrollmentId: string, revoked: boolean) {
    list.setData(await coursesSetEnrollmentRevoked(apiClient, workspaceId, enrollmentId, revoked));
  }

  function setRevoked(student: CourseStudent, revoked: boolean) {
    setBusy((prev) => new Set([...prev, student.id]));
    void send(student.id, revoked)
      .then(() => toast.undo(revoked ? t.revokedToast : t.restoredToast, () => send(student.id, !revoked)))
      .catch((err: unknown) => toast.error(errorMessage(err)))
      .finally(() =>
        setBusy((prev) => {
          const next = new Set(prev);
          next.delete(student.id);
          return next;
        })
      );
  }

  const progressOf = (s: CourseStudent) => (
    <span aria-label={fmt(t.progressLabel, { done: s.completedLessons, total })} className="tabular-nums">
      {fmt(t.progress, { done: s.completedLessons, total })}
    </span>
  );

  const rows = visible.map((student) => {
    const name = student.name?.trim() || student.phone?.trim() || t.none;
    const phone = dialablePhone(student.phone);
    const whatsapp = phone ? toWhatsAppNumber(phone) : null;
    const customerTo = `/customers/${student.customerId}`;
    const revoked = Boolean(student.revokedAt);
    const working = busy.has(student.id);
    const onPeek = () => setPeek({ id: student.id, open: true });
    const keys = rowKeyProps(onPeek, () => navigate(customerTo));
    const toggle = () => setRevoked(student, !revoked);

    const menu: ContextMenuItem[] = [{ id: "customer", label: t.openCustomer, icon: IconCustomers, onSelect: () => navigate(customerTo) }];
    if (phone) {
      menu.push({
        id: "call",
        label: t.menuCall,
        icon: IconPhone,
        separatorBefore: true,
        onSelect: () => {
          window.location.href = orderTelHref(phone);
        },
      });
      if (whatsapp) menu.push({ id: "whatsapp", label: t.menuWhatsapp, icon: IconWhatsApp, onSelect: () => window.open(`https://wa.me/${whatsapp}`, "_blank", "noopener,noreferrer") });
      menu.push({ id: "copy", label: t.menuCopyPhone, icon: IconCopy, onSelect: () => copy(phone, t.copiedPhone) });
    }
    menu.push(
      revoked
        ? { id: "restore", label: t.restore, icon: IconUnlock, separatorBefore: true, disabled: working, onSelect: toggle }
        : { id: "revoke", label: t.revoke, icon: IconLock, destructive: true, separatorBefore: true, disabled: working, onSelect: toggle }
    );

    const badge = revoked ? <StatusBadge value="revoked" tone="danger" text={t.revoked} /> : <StatusBadge value={student.source} tone="neutral" text={t[`source_${student.source}`]} />;
    const action = <RowAction tone={revoked ? "quiet" : "danger"} label={revoked ? t.restore : t.revoke} busy={working} onClick={toggle} />;
    const openLabel = fmt(t.peekStudent, { who: name });

    if (compact) {
      return (
        <li key={student.id}>
          <ContextMenu items={menu} label={t.studentMenu}>
            <ListRowCard
              title={<bdi>{name}</bdi>}
              amount={revoked ? undefined : progressOf(student)}
              status={badge}
              meta={formatDate(student.enrolledAt)}
              action={action}
              onOpen={onPeek}
              openLabel={openLabel}
              aria-haspopup="dialog"
              {...keys}
            />
          </ContextMenu>
        </li>
      );
    }
    return (
      <DeskRow key={student.id} onOpen={onPeek} openLabel={openLabel} keyProps={keys} current={peek?.open === true && peek.id === student.id} menu={menu} menuLabel={t.studentMenu}>
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-6 font-medium text-ink">
            <ViewLink to={customerTo} className="rounded-sm hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <bdi>{name}</bdi>
            </ViewLink>
          </p>
          {student.phone && (
            <p className="truncate text-xs leading-5 text-ink-soft tabular-nums">
              <bdi dir="ltr">{student.phone}</bdi>
            </p>
          )}
        </div>
        <div className="flex items-center">{badge}</div>
        <div className="text-xs whitespace-nowrap text-ink-soft">{formatDate(student.enrolledAt)}</div>
        <div className="text-sm whitespace-nowrap text-ink-soft">{progressOf(student)}</div>
        <div className="flex items-center justify-end gap-2">
          {phone && <ContactActions phone={phone} name={student.name?.trim() || undefined} variant="icon" />}
          {action}
        </div>
      </DeskRow>
    );
  });

  const pill = "min-h-11 rounded-full px-5";
  const peekName = peeked ? peeked.name?.trim() || peeked.phone?.trim() || t.none : "";
  const peekPhone = peeked ? dialablePhone(peeked.phone) : null;

  return (
    <div className="flex flex-col gap-3">
      <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t.studentsSearchPlaceholder, label: t.studentsSearchLabel }}>
        <Button className="h-11 gap-2 rounded-full px-4" onClick={() => setEnrolling(true)}>
          <IconUserAdd className="size-4" weight="bold" aria-hidden />
          {t.enroll}
        </Button>
      </ListToolbar>
      <ChipRow items={chips} value={filter} onChange={setFilter} label={t.studentsChips} collapseEmpty={false} countsLoading={list.loading} />

      <DataState
        loading={list.loading}
        error={students.length === 0 ? list.error : null}
        onRetry={() => void list.refresh()}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={4} />}
      >
        {visible.length === 0 ? (
          students.length === 0 ? (
            <EmptyState
              icon={<IconPeople aria-hidden />}
              title={t.noStudentsTitle}
              description={t.noStudents}
              action={
                <Button className={pill} onClick={() => setEnrolling(true)}>
                  {t.enroll}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<IconSearch aria-hidden />}
              title={t.noStudentsFiltered}
              action={
                <Button
                  variant="outline"
                  className={pill}
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  {t.clearAll}
                </Button>
              }
            />
          )
        ) : compact ? (
          <ul aria-label={t.studentsList} className="flex flex-col gap-2.5">
            {rows}
          </ul>
        ) : (
          <DeskList
            columns={STUDENT_COLUMNS}
            label={t.studentsList}
            head={[{ label: t.colStudent }, { label: t.colSource }, { label: t.colEnrolled }, { label: t.colProgress }, { label: t.colAction, end: true }]}
          >
            {rows}
          </DeskList>
        )}
      </DataState>

      {peeked && (
        <QuickLook
          open={Boolean(peek?.open)}
          onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
          title={<bdi>{peekName}</bdi>}
          status={peeked.revokedAt ? <StatusBadge value="revoked" tone="danger" text={t.revoked} /> : undefined}
          to={`/customers/${peeked.customerId}`}
          openLabel={t.openCustomer}
          actions={
            <RowAction
              className="h-11 px-4 pointer-fine:h-10"
              tone={peeked.revokedAt ? "quiet" : "danger"}
              label={peeked.revokedAt ? t.restore : t.revoke}
              busy={busy.has(peeked.id)}
              onClick={() => setRevoked(peeked, !peeked.revokedAt)}
            />
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
              <p className="text-[17px] leading-6 font-semibold text-ink tabular-nums">
                <bdi dir="ltr">{peeked.phone ?? t.none}</bdi>
              </p>
              {peekPhone && <ContactActions phone={peekPhone} name={peeked.name?.trim() || undefined} />}
            </div>
            <FactList
              rows={[
                { label: t.colProgress, value: progressOf(peeked) },
                { label: t.colSource, value: t[`source_${peeked.source}`] },
                { label: t.colEnrolled, value: formatDate(peeked.enrolledAt) },
                peeked.revokedAt ? { label: t.revoked, value: formatDate(peeked.revokedAt) } : null,
                peeked.orderId
                  ? {
                      label: t.qlOrder,
                      value: (
                        <ViewLink to={`/orders/${peeked.orderId}`} className={LINK}>
                          {t.openOrder}
                        </ViewLink>
                      ),
                    }
                  : null,
              ]}
            />
          </div>
        </QuickLook>
      )}

      <EnrollSheet
        open={enrolling}
        courseId={courseId}
        onClose={() => setEnrolling(false)}
        onEnrolled={(next) => {
          list.setData(next);
          setEnrolling(false);
          toast.success(t.enrolledToast);
        }}
      />
    </div>
  );
}

/** «ادّي صلاحية»: a phone and an optional name, in a sheet. A refused number is said under its field. */
function EnrollSheet({ open, courseId, onClose, onEnrolled }: { open: boolean; courseId: string; onClose: () => void; onEnrolled: (students: StudentsData) => void }) {
  const t = useT(COURSE_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const phoneBox = useRef<HTMLDivElement>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhone("");
    setName("");
    setPhoneError(null);
    setError(null);
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const focusPhone = () => phoneBox.current?.querySelector("input")?.focus();
    if (!phone.trim()) {
      setPhoneError(t.phoneRequired);
      focusPhone();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onEnrolled(await coursesEnroll(apiClient, workspaceId, courseId, { phone: phone.trim(), fullName: name.trim() || undefined }));
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_PHONE") {
        setPhoneError(t.invalidPhone);
        focusPhone();
      } else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.enrollTitle}
      description={t.enrollDescription}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy}>
            {busy ? t.enrolling : t.enroll}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <div ref={phoneBox}>
          <TextField
            label={t.phone}
            required
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="off"
            maxLength={32}
            value={phone}
            error={phoneError ?? undefined}
            onChange={(e) => {
              setPhone(e.target.value);
              setPhoneError(null);
            }}
          />
        </div>
        <TextField label={t.studentName} dir="auto" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
        {error && <Alert variant="danger">{error}</Alert>}
      </form>
    </Modal>
  );
}
