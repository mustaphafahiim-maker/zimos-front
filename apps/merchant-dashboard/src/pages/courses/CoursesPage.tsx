import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import { coursesCreate, coursesList, type Course } from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { TextField } from "@/components/Field";
import { IconCaretRight, IconCopy, IconCourses, IconPlus, IconSearch } from "@/components/icons";
import { ChipRow, ListRowCard, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { invalidateCached, useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useViewNavigate } from "@/lib/viewTransition";
import { fold, matches } from "@/pages/quotes/kit/Facts";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { CourseEditor } from "./CourseEditor";
import { COURSE_STRINGS, courseHref, coursesCacheKey } from "./courseText";

type StatusFilter = "all" | Course["status"];

const COURSE_COLUMNS = "grid-cols-[minmax(0,1.6fr)_max-content_max-content_max-content_max-content_max-content]";

/**
 * /courses (SPEC §18.3). The list, or — with `?course=<id>` — that course's
 * editor: the browser's Back returns to the list, and a link to a course can
 * be kept or shared. `&tab=` holds the editor's section.
 */
export function CoursesPage() {
  const workspaceId = useWorkspaceId();
  const [params] = useSearchParams();
  const courseId = params.get("course");
  // Keyed, so nothing typed in one course follows the merchant to the next.
  if (courseId) return <CourseEditor key={`${workspaceId}:${courseId}`} courseId={courseId} />;
  return <CourseList key={workspaceId} />;
}

/**
 * The courses: search, the two statuses as chips with their counts, and a row
 * per course — a card on a phone, a line of the sheet on a wide screen — that
 * opens its editor. «كورس جديد» asks for the title in a sheet and goes
 * straight to the new course's lessons.
 */
function CourseList() {
  const t = useT(COURSE_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const copy = useCopy();
  const compact = useIsCompact();
  const phone = useIsPhone();

  const list = useCachedAsync<Course[]>(coursesCacheKey(workspaceId), () => coursesList(apiClient, workspaceId), [workspaceId]);
  const courses = useMemo(() => list.data ?? [], [list.data]);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const query = fold(search.trim());
  const visible = useMemo(
    () => courses.filter((c) => (status === "all" || c.status === status) && matches(query, [c.title])),
    [courses, status, query]
  );
  const countOfStatus = (key: Course["status"]) => (list.data ? courses.filter((c) => c.status === key).length : null);
  const chips: ChipItem<StatusFilter>[] = [
    { value: "all", label: t.all, count: list.data ? courses.length : null },
    { value: "published", label: t.published, count: countOfStatus("published") },
    { value: "draft", label: t.draft, count: countOfStatus("draft") },
  ];

  const pill = "min-h-11 rounded-full px-5";
  const newCourse = (
    <Button className={pill} onClick={() => setCreating(true)}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.add}
    </Button>
  );

  const rows = visible.map((course) => {
    const to = courseHref(course.id);
    const open = () => navigate(to);
    const openLabel = fmt(t.openName, { name: course.title });
    const lessons = pluralOf(t, "lessons", course.lessonsCount ?? 0);
    const students = pluralOf(t, "students", course.studentsCount ?? 0);
    const badge = <StatusBadge value={course.status} tone={course.status === "published" ? "success" : "neutral"} text={t[course.status]} />;
    const menu: ContextMenuItem[] = [
      { id: "open", label: t.open, icon: IconCourses, onSelect: open },
      {
        id: "copy",
        label: t.copyLink,
        icon: IconCopy,
        onSelect: () => copy(`${STOREFRONT_URL}/store/${workspaceId}/learn/${course.slug}`, t.copiedLink),
      },
    ];
    if (compact) {
      return (
        <li key={course.id}>
          <ContextMenu items={menu} label={t.menuLabel}>
            <ListRowCard
              title={<span dir="auto">{course.title}</span>}
              status={badge}
              meta={
                <>
                  {lessons} · {students}
                </>
              }
              onOpen={open}
              openLabel={openLabel}
            />
          </ContextMenu>
        </li>
      );
    }
    return (
      <DeskRow key={course.id} onOpen={open} openLabel={openLabel} menu={menu} menuLabel={t.menuLabel}>
        <p className="min-w-0 truncate text-[15px] leading-6 font-medium text-ink">
          <ViewLink to={to} className="rounded-sm hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <span dir="auto">{course.title}</span>
          </ViewLink>
        </p>
        <div className="flex items-center">{badge}</div>
        <div className="text-sm whitespace-nowrap text-ink-soft tabular-nums">{lessons}</div>
        <div className="text-sm whitespace-nowrap text-ink-soft tabular-nums">{students}</div>
        <div className="text-xs whitespace-nowrap text-ink-soft">{formatDate(course.createdAt)}</div>
        <div className="flex items-center justify-end">
          <IconCaretRight className="size-4 text-ink-soft rtl:-scale-x-100" weight="bold" aria-hidden />
        </div>
      </DeskRow>
    );
  });

  return (
    <div className="max-w-5xl">
      {/* A phone keeps the first screen for the courses: the sentence is for wider screens. */}
      <PageHeader title={t.title} description={phone ? undefined : t.description} primaryAction={newCourse} />

      <DataState
        loading={list.loading}
        error={courses.length === 0 ? list.error : null}
        onRetry={() => void list.refresh()}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={4} />}
      >
        {courses.length === 0 ? (
          <EmptyState icon={<IconCourses aria-hidden />} title={t.emptyTitle} description={t.emptyDescription} action={newCourse} />
        ) : (
          <div className="flex flex-col gap-3">
            <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }} />
            <ChipRow items={chips} value={status} onChange={setStatus} label={t.chipsLabel} collapseEmpty={false} />
            {visible.length === 0 ? (
              <EmptyState
                icon={<IconSearch aria-hidden />}
                title={t.emptyFiltered}
                action={
                  <Button
                    variant="outline"
                    className={pill}
                    onClick={() => {
                      setSearch("");
                      setStatus("all");
                    }}
                  >
                    {t.clearAll}
                  </Button>
                }
              />
            ) : compact ? (
              <ul aria-label={t.listLabel} className="flex flex-col gap-2.5">
                {rows}
              </ul>
            ) : (
              <DeskList
                columns={COURSE_COLUMNS}
                label={t.listLabel}
                head={[{ label: t.colCourse }, { label: t.colStatus }, { label: t.colLessons }, { label: t.colStudents }, { label: t.colCreated }, { label: t.open, end: true }]}
              >
                {rows}
              </DeskList>
            )}
          </div>
        )}
      </DataState>

      <CreateCourseSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(course) => {
          setCreating(false);
          // The list kept for the session does not know the new course yet.
          invalidateCached(coursesCacheKey(workspaceId));
          navigate(courseHref(course.id));
        }}
      />
    </div>
  );
}

/** «كورس جديد»: one field in a sheet. The course opens on its lessons as soon as it exists. */
function CreateCourseSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (course: Course) => void }) {
  const t = useT(COURSE_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setNameError(null);
    setError(null);
  }, [open]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setNameError(t.nameError);
      box.current?.querySelector("input")?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onCreated(await coursesCreate(apiClient, workspaceId, { title: name.trim() }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.createTitle}
      description={t.createDescription}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy}>
            {busy ? t.creating : t.create}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={create} noValidate className="space-y-4">
        <div ref={box}>
          <TextField
            label={t.name}
            required
            dir="auto"
            maxLength={200}
            value={name}
            error={nameError ?? undefined}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
          />
        </div>
        {error && <Alert variant="danger">{error}</Alert>}
      </form>
    </Modal>
  );
}
