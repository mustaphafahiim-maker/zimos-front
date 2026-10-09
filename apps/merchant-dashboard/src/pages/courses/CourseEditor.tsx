import { useState, type MouseEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { ApiError, coursesDelete, coursesGet, coursesUpdate, type Course } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { CardSkeleton, DataState } from "@/components/DataState";
import { IconCopy, IconDelete, IconDraft, IconExternal, IconLaunch } from "@/components/icons";
import { ChipRow, type ChipItem } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { invalidateCached, useCachedAsync } from "@/lib/useCachedAsync";
import { UnsavedGuardProvider, useUnsavedGuard } from "@/lib/useUnsavedGuard";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useViewNavigate } from "@/lib/viewTransition";
import { MoreMenu } from "@/pages/quotes/kit/MoreMenu";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { CourseOutline } from "./CourseOutline";
import { CourseSettings } from "./CourseSettings";
import { CourseStudents } from "./CourseStudents";
import { COURSE_STRINGS, courseCacheKey, coursesCacheKey } from "./courseText";

const TABS = ["lessons", "settings", "students"] as const;
type CourseTab = (typeof TABS)[number];

function isTab(value: string | null): value is CourseTab {
  return value !== null && (TABS as readonly string[]).includes(value);
}

/**
 * One course (`/courses?course=<id>`): its lessons, its settings and its
 * students behind three chips (`&tab=`). Each course gets its own guard for
 * unsaved edits: they arm the browser's "leave?" question, and the way back to
 * the list asks first.
 */
export function CourseEditor({ courseId }: { courseId: string }) {
  return (
    <UnsavedGuardProvider>
      <CourseView courseId={courseId} />
    </UnsavedGuardProvider>
  );
}

function CourseView({ courseId }: { courseId: string }) {
  const t = useT(COURSE_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const navigate = useViewNavigate();
  const copy = useCopy();
  const { dirty, confirmLeave } = useUnsavedGuard();

  const detail = useCachedAsync<Course>(courseCacheKey(workspaceId, courseId), () => coursesGet(apiClient, workspaceId, courseId), [workspaceId, courseId]);
  const course = detail.data && detail.data.id === courseId ? detail.data : null;

  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const tab: CourseTab = isTab(rawTab) ? rawTab : "lessons";
  // A section, once opened, stays mounted while another is looked at: an edit that is not saved yet is still
  // there — with its save bar — when the merchant comes back to it.
  const [opened, setOpened] = useState<ReadonlySet<CourseTab>>(() => new Set([tab]));
  if (!opened.has(tab)) setOpened(new Set([...opened, tab]));

  function selectTab(next: CourseTab) {
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === "lessons") out.delete("tab");
        else out.set("tab", next);
        return out;
      },
      { replace: true }
    );
  }

  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /** A change to the course: the page shows it, and the list kept for the session is read again next time. */
  function merge(saved: Course) {
    // An answer without the outline keeps the one on screen.
    detail.setData((prev) => ({ ...saved, modules: saved.modules ?? prev?.modules }));
    invalidateCached(coursesCacheKey(workspaceId));
  }

  async function setStatus(status: Course["status"]) {
    if (busy) return;
    setBusy(true);
    try {
      merge(await coursesUpdate(apiClient, workspaceId, courseId, { status }));
      toast.success(status === "published" ? t.publishedToast : t.draftToast);
    } catch (err) {
      if (err instanceof ApiError && err.code === "COURSE_EMPTY") {
        // Nothing to publish yet: say so, and offer the way to the lessons.
        toast.notify("error", t.courseEmpty, tab === "lessons" ? undefined : { action: { label: t.tabLessons, onClick: () => selectTab("lessons") } });
      } else toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const link = course ? `${STOREFRONT_URL}/store/${workspaceId}/learn/${course.slug}` : "";
  const menu: ContextMenuItem[] = course
    ? [
        { id: "copy", label: t.copyLink, icon: IconCopy, onSelect: () => copy(link, t.copiedLink) },
        { id: "view", label: t.viewPage, icon: IconExternal, onSelect: () => window.open(link, "_blank", "noopener,noreferrer") },
        ...(course.status === "published"
          ? [{ id: "draft", label: t.unpublish, icon: IconDraft, separatorBefore: true, disabled: busy, onSelect: () => void setStatus("draft") }]
          : []),
        { id: "delete", label: t.delete, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setDeleting(true) },
      ]
    : [];

  /**
   * The list is this same route without `course`, so a click on a link that leaves the course (the way back,
   * a link to another course) is asked about here while something is unsaved. Other pages are covered by
   * the browser's own prompt.
   */
  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!dirty || event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || !event.currentTarget.contains(anchor)) return;
    if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
    let url: URL;
    try {
      url = new URL(anchor.href, window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.searchParams.get("course") === courseId) return;
    event.preventDefault();
    event.stopPropagation();
    void confirmLeave().then((leave) => {
      if (leave) navigate(`${url.pathname}${url.search}${url.hash}`);
    });
  }

  const lessonsCount = course?.modules ? course.modules.reduce((sum, m) => sum + m.lessons.length, 0) : undefined;
  const chips: ChipItem<CourseTab>[] = [
    { value: "lessons", label: t.tabLessons, count: lessonsCount },
    { value: "settings", label: t.tabSettings },
    { value: "students", label: t.tabStudents, count: course?.studentsCount },
  ];

  return (
    <div className="max-w-4xl" onClickCapture={onClickCapture}>
      <PageHeader
        back={{ to: "/courses", label: t.back }}
        title={course?.title ?? t.title}
        titleBadge={course ? <StatusBadge value={course.status} tone={course.status === "published" ? "success" : "neutral"} text={t[course.status]} /> : undefined}
        actions={
          course ? (
            <>
              {course.status === "draft" && (
                <Button className="h-11 gap-2 rounded-full px-5" disabled={busy} onClick={() => void setStatus("published")}>
                  <IconLaunch className="size-4" weight="bold" aria-hidden />
                  {t.publish}
                </Button>
              )}
              <MoreMenu items={menu} label={t.tools} busy={busy} />
            </>
          ) : undefined
        }
      />

      <DataState
        loading={detail.loading || (!course && !detail.error)}
        error={course ? null : detail.error}
        onRetry={() => void detail.refresh()}
        skeleton={
          <div className="flex flex-col gap-[var(--bento-gap)]">
            <CardSkeleton lines={2} />
            <CardSkeleton lines={4} />
          </div>
        }
      >
        {course && (
          <>
            <ChipRow items={chips} value={tab} onChange={selectTab} label={t.tabs} collapseEmpty={false} />
            <div className="pt-4">
              {opened.has("lessons") && (
                <div hidden={tab !== "lessons"}>
                  <CourseOutline course={course} onSaved={merge} />
                </div>
              )}
              {opened.has("settings") && (
                <div hidden={tab !== "settings"}>
                  <CourseSettings course={course} link={link} onSaved={merge} />
                </div>
              )}
              {tab === "students" && <CourseStudents courseId={course.id} />}
            </div>
          </>
        )}
      </DataState>

      {course && (
        <ConfirmDialog
          open={deleting}
          title={fmt(t.deleteTitle, { name: course.title })}
          description={t.deleteDescription}
          confirmLabel={t.deleteConfirm}
          busyLabel={t.deleting}
          cancelLabel={t.cancel}
          destructive
          onCancel={() => setDeleting(false)}
          onConfirm={async () => {
            try {
              await coursesDelete(apiClient, workspaceId, course.id);
            } catch (err) {
              throw new Error(err instanceof ApiError && err.code === "COURSE_HAS_STUDENTS" ? t.hasStudents : errorMessage(err));
            }
            setDeleting(false);
            invalidateCached(`courses:${workspaceId}:`);
            toast.success(t.deletedToast);
            // The course is gone: its unsaved edits have nothing left to be saved into.
            navigate("/courses", { replace: true });
          }}
        />
      )}
    </div>
  );
}
