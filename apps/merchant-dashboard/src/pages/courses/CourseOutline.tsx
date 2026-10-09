import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  coursesSaveOutline,
  digitalListFiles,
  type Course,
  type DigitalFile,
  type LessonInput,
  type LessonKind,
  type ModuleInput,
} from "@store-builder/api-client";
import { AccordionGroup, AccordionSection } from "@/components/Accordion";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { EmptyState } from "@/components/EmptyState";
import { Field, TextField } from "@/components/Field";
import { IconArrowDown, IconArrowUp, IconCourses, IconDelete, IconEdit, IconPlus } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { SaveBar } from "@/components/SaveBar";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { countOf, pluralOf } from "@/lib/plural";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { FactChip } from "@/pages/quotes/kit/Facts";
import { MoreMenu } from "@/pages/quotes/kit/MoreMenu";
import { SwitchRow } from "@/pages/quotes/kit/Switch";
import { COURSE_STRINGS, LESSON_ICON } from "./courseText";

type DraftLesson = LessonInput & { key: string };
type DraftModule = { id?: string; key: string; title: string; lessons: DraftLesson[] };
let draftSeq = 0;
const newKey = () => `draft-${++draftSeq}`;

function toDraft(course: Course): DraftModule[] {
  return (course.modules ?? []).map((m) => ({
    id: m.id,
    key: m.id,
    title: m.title,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      key: l.id,
      title: l.title,
      kind: l.kind,
      videoUrl: l.videoUrl ?? "",
      body: l.body ?? "",
      fileId: l.fileId,
      durationSeconds: l.durationSeconds,
      isFreePreview: l.isFreePreview,
      dripDays: l.dripDays,
    })),
  }));
}

/** What PUT /courses/:id/outline is sent — the same shape the page always sent. */
function payloadOf(modules: DraftModule[]): ModuleInput[] {
  return modules.map((m) => ({
    id: m.id,
    title: m.title.trim(),
    lessons: m.lessons.map(({ key: _key, ...l }) => ({
      ...l,
      title: l.title.trim(),
      videoUrl: l.kind === "video" ? (l.videoUrl ?? "").trim() || null : null,
      body: (l.body ?? "").trim() || null,
      fileId: l.kind === "file" ? l.fileId || null : null,
    })),
  }));
}

function move<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const blankLesson = (): DraftLesson => ({ key: newKey(), title: "", kind: "video", videoUrl: "", body: "", fileId: null, isFreePreview: false, dripDays: 0 });

/**
 * A course's lessons: chapters that fold to one row, each a short list of
 * lessons. A lesson is edited in a sheet; moving and removing are behind «…»
 * (a removal can be taken back from its toast). Nothing reaches the server
 * until «احفظ الدروس» in the bar that appears with the first change — the
 * whole outline is saved at once, as before.
 */
export function CourseOutline({ course, onSaved }: { course: Course; onSaved: (course: Course) => void }) {
  const t = useT(COURSE_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const rootRef = useRef<HTMLDivElement>(null);
  const [baseline, setBaseline] = useState<DraftModule[]>(() => toDraft(course));
  const [modules, setModules] = useState<DraftModule[]>(baseline);
  // A short course shows every chapter open; a long one opens on its first.
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(() => new Set((baseline.length <= 3 ? baseline : baseline.slice(0, 1)).map((m) => m.key)));
  const [files, setFiles] = useState<DigitalFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  // The lesson in the sheet: which chapter it belongs to, and whether it is not in the list yet.
  const [editing, setEditing] = useState<{ moduleKey: string; lesson: DraftLesson; isNew: boolean; open: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    digitalListFiles(apiClient, workspaceId)
      .then((result) => {
        if (!cancelled) setFiles(result.files);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const dirty = JSON.stringify(payloadOf(modules)) !== JSON.stringify(payloadOf(baseline));
  useReportDirty(dirty && !busy);

  const setOpen = (key: string, open: boolean) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  const patchModule = (key: string, patch: Partial<DraftModule>) => setModules((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  /** Puts the caret in a chapter's title field, once it is drawn. */
  function focusChapter(key: string) {
    window.requestAnimationFrame(() => {
      const field = rootRef.current?.querySelector<HTMLInputElement>(`[data-chapter="${key}"] input`);
      field?.focus({ preventScroll: true });
      field?.scrollIntoView({ block: "center" });
    });
  }

  function addModule() {
    const key = newKey();
    setModules((prev) => [...prev, { key, title: "", lessons: [] }]);
    setOpen(key, true);
    focusChapter(key);
  }

  function removeModule(index: number) {
    const removed = modules[index];
    if (!removed) return;
    setModules((prev) => prev.filter((m) => m.key !== removed.key));
    toast.undo(t.chapterRemoved, () =>
      setModules((prev) => {
        if (prev.some((m) => m.key === removed.key)) return prev;
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, removed);
        return next;
      })
    );
  }

  function removeLesson(moduleKey: string, lessonKey: string) {
    const owner = modules.find((m) => m.key === moduleKey);
    const index = owner ? owner.lessons.findIndex((l) => l.key === lessonKey) : -1;
    const removed = owner?.lessons[index];
    if (!owner || !removed) return;
    patchModule(moduleKey, { lessons: owner.lessons.filter((l) => l.key !== lessonKey) });
    toast.undo(t.lessonRemoved, () =>
      setModules((prev) =>
        prev.map((m) => {
          if (m.key !== moduleKey || m.lessons.some((l) => l.key === removed.key)) return m;
          const lessons = [...m.lessons];
          lessons.splice(Math.min(index, lessons.length), 0, removed);
          return { ...m, lessons };
        })
      )
    );
  }

  function commitLesson(lesson: DraftLesson) {
    if (!editing) return;
    const { moduleKey, isNew } = editing;
    setModules((prev) =>
      prev.map((m) => (m.key !== moduleKey ? m : { ...m, lessons: isNew ? [...m.lessons, lesson] : m.lessons.map((l) => (l.key === lesson.key ? lesson : l)) }))
    );
    setEditing((current) => (current ? { ...current, open: false } : current));
  }

  function reset() {
    setModules(baseline);
    setShowErrors(false);
    setError(null);
  }

  async function save() {
    if (busy) return;
    // A chapter (or a lesson) without a title: say so on it, open its chapter and put the caret there.
    const bad = modules.find((m) => !m.title.trim() || m.lessons.some((l) => !l.title.trim()));
    if (bad) {
      setShowErrors(true);
      setOpen(bad.key, true);
      if (!bad.title.trim()) focusChapter(bad.key);
      return;
    }
    setBusy(true);
    setError(null);
    const openAt = modules.map((m) => openKeys.has(m.key));
    try {
      const saved = await coursesSaveOutline(apiClient, workspaceId, course.id, payloadOf(modules));
      const next = toDraft(saved);
      setModules(next);
      setBaseline(next);
      // New chapters got their real ids: the ones that were open stay open.
      setOpenKeys(new Set(next.filter((_, index) => openAt[index]).map((m) => m.key)));
      setShowErrors(false);
      onSaved(saved);
      toast.success(t.outlineSaved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const addChapter = (
    <Button type="button" variant="outline" className="h-11 gap-2 rounded-full px-5" onClick={addModule}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.addModule}
    </Button>
  );

  return (
    <div ref={rootRef} className="flex flex-col gap-[var(--bento-gap)]">
      {error && <Alert variant="danger">{error}</Alert>}

      {modules.length === 0 ? (
        <EmptyState icon={<IconCourses aria-hidden />} title={t.noModulesTitle} description={t.noModules} action={addChapter} />
      ) : (
        <AccordionGroup>
          {modules.map((module, mi) => {
            const chapterMenu: ContextMenuItem[] = [
              { id: "up", label: t.moveUp, icon: IconArrowUp, disabled: mi === 0, onSelect: () => setModules((prev) => move(prev, mi, -1)) },
              { id: "down", label: t.moveDown, icon: IconArrowDown, disabled: mi === modules.length - 1, onSelect: () => setModules((prev) => move(prev, mi, 1)) },
              { id: "remove", label: t.removeChapter, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => removeModule(mi) },
            ];
            return (
              <AccordionSection
                key={module.key}
                title={module.title.trim() || t.untitledChapter}
                summary={pluralOf(t, "lessons", module.lessons.length)}
                icon={IconCourses}
                open={openKeys.has(module.key)}
                onOpenChange={(open) => setOpen(module.key, open)}
                keepMounted
                actions={<MoreMenu variant="row" items={chapterMenu} label={t.chapterTools} />}
              >
                <div className="space-y-4">
                  <div data-chapter={module.key}>
                    <TextField
                      label={t.moduleTitle}
                      required
                      dir="auto"
                      maxLength={200}
                      value={module.title}
                      error={showErrors && !module.title.trim() ? t.moduleTitleError : undefined}
                      onChange={(e) => patchModule(module.key, { title: e.target.value })}
                    />
                  </div>

                  {module.lessons.length === 0 ? (
                    <p className="text-sm leading-6 text-ink-soft">{t.noLessons}</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {module.lessons.map((lesson, li) => {
                        const KindIcon = LESSON_ICON[lesson.kind];
                        const name = lesson.title.trim();
                        const minutes = lesson.durationSeconds ? Math.round(lesson.durationSeconds / 60) : 0;
                        const lessonMenu: ContextMenuItem[] = [
                          { id: "edit", label: t.editLesson, icon: IconEdit, onSelect: () => setEditing({ moduleKey: module.key, lesson, isNew: false, open: true }) },
                          { id: "up", label: t.moveUp, icon: IconArrowUp, separatorBefore: true, disabled: li === 0, onSelect: () => patchModule(module.key, { lessons: move(module.lessons, li, -1) }) },
                          {
                            id: "down",
                            label: t.moveDown,
                            icon: IconArrowDown,
                            disabled: li === module.lessons.length - 1,
                            onSelect: () => patchModule(module.key, { lessons: move(module.lessons, li, 1) }),
                          },
                          { id: "remove", label: t.removeLesson, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => removeLesson(module.key, lesson.key) },
                        ];
                        return (
                          <li
                            key={lesson.key}
                            data-slot="lesson-row"
                            className="relative flex min-h-14 items-center gap-3 rounded-2xl bg-paper-sunken/60 py-1.5 ps-3 pe-1.5 ring-1 ring-line transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken motion-reduce:transition-none"
                          >
                            {/* The whole row opens the lesson; its «…» sits above this button. */}
                            <button
                              type="button"
                              aria-haspopup="dialog"
                              aria-label={fmt(t.editLessonName, { name: name || t.untitledLesson })}
                              onClick={() => setEditing({ moduleKey: module.key, lesson, isNew: false, open: true })}
                              className="absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            />
                            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                              <KindIcon className="size-[18px]" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p dir="auto" className={name ? "truncate text-sm leading-5 font-medium text-ink" : "truncate text-sm leading-5 font-medium text-danger"}>
                                {name || t.untitledLesson}
                              </p>
                              <p className="truncate text-xs leading-5 text-ink-soft">
                                {t[`kind_${lesson.kind}`]}
                                {minutes > 0 && <> · {countOf("minute", minutes)}</>}
                                {(lesson.dripDays ?? 0) > 0 && <> · {fmt(t.dripAfter, { days: countOf("day", lesson.dripDays ?? 0) })}</>}
                              </p>
                            </div>
                            {lesson.isFreePreview && <FactChip tone="success">{t.freePreview}</FactChip>}
                            <div className="relative z-10 shrink-0">
                              <MoreMenu variant="row" items={lessonMenu} label={t.lessonTools} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 gap-2 rounded-full px-4"
                    onClick={() => setEditing({ moduleKey: module.key, lesson: blankLesson(), isNew: true, open: true })}
                  >
                    <IconPlus className="size-4" weight="bold" aria-hidden />
                    {t.addLesson}
                  </Button>
                </div>
              </AccordionSection>
            );
          })}
        </AccordionGroup>
      )}

      {modules.length > 0 && <div>{addChapter}</div>}

      <SaveBar dirty={dirty} saving={busy} onSave={() => void save()} onDiscard={reset} saveLabel={t.saveOutline} message={t.outlineUnsaved} />

      <LessonSheet
        lesson={editing?.lesson ?? null}
        isNew={editing?.isNew ?? false}
        open={Boolean(editing?.open)}
        files={files}
        onClose={() => setEditing((current) => (current ? { ...current, open: false } : current))}
        onDone={commitLesson}
        onRemove={() => {
          if (!editing) return;
          removeLesson(editing.moduleKey, editing.lesson.key);
          setEditing((current) => (current ? { ...current, open: false } : current));
        }}
      />
    </div>
  );
}

/**
 * One lesson, in a sheet over the outline: its title and kind, then only the
 * fields that kind needs. «تمام» puts it in the outline; the outline itself is
 * saved from its bar.
 */
function LessonSheet({
  lesson,
  isNew,
  open,
  files,
  onClose,
  onDone,
  onRemove,
}: {
  lesson: DraftLesson | null;
  isNew: boolean;
  open: boolean;
  files: DigitalFile[];
  onClose: () => void;
  onDone: (lesson: DraftLesson) => void;
  onRemove: () => void;
}) {
  const t = useT(COURSE_STRINGS);
  const formId = useId();
  const titleBox = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<DraftLesson | null>(lesson);
  const [titleError, setTitleError] = useState<string | null>(null);

  // The sheet opens on the lesson as it stands: a change left behind by Cancel never comes back.
  useEffect(() => {
    if (!open || !lesson) return;
    setDraft(lesson);
    setTitleError(null);
  }, [open, lesson]);

  const patch = (change: Partial<DraftLesson>) => setDraft((current) => (current ? { ...current, ...change } : current));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!draft.title.trim()) {
      setTitleError(t.lessonTitleError);
      titleBox.current?.querySelector("input")?.focus();
      return;
    }
    onDone(draft);
  }

  return (
    <Modal
      open={open && draft !== null}
      onClose={onClose}
      title={isNew ? t.newLesson : t.editLesson}
      className="max-w-xl"
      footer={
        <>
          {!isNew && (
            <Button type="button" variant="outline" className="rounded-full px-5 text-danger hover:text-danger sm:me-auto" onClick={onRemove}>
              <IconDelete className="size-4" aria-hidden />
              {t.removeLesson}
            </Button>
          )}
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5">
            {t.done}
          </Button>
        </>
      }
    >
      {draft && (
        <form id={formId} onSubmit={submit} noValidate className="space-y-4">
          <div ref={titleBox}>
            <TextField
              label={t.lessonTitle}
              required
              dir="auto"
              maxLength={200}
              value={draft.title}
              error={titleError ?? undefined}
              onChange={(e) => {
                patch({ title: e.target.value });
                setTitleError(null);
              }}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">{t.kind}</p>
            <Segmented<LessonKind>
              className="w-full"
              label={t.kind}
              value={draft.kind}
              onChange={(kind) => patch({ kind })}
              options={[
                { value: "video", label: t.kind_video, icon: LESSON_ICON.video },
                { value: "text", label: t.kind_text, icon: LESSON_ICON.text },
                { value: "file", label: t.kind_file, icon: LESSON_ICON.file },
              ]}
            />
          </div>

          {draft.kind === "video" && (
            <TextField label={t.videoUrl} hint={t.videoHint} type="url" inputMode="url" dir="ltr" maxLength={1000} value={draft.videoUrl ?? ""} onChange={(e) => patch({ videoUrl: e.target.value })} />
          )}
          {draft.kind === "file" && (
            <Field label={t.file} hint={files.length === 0 ? t.noFiles : undefined}>
              {(props) => (
                <Select {...props} className="h-11" value={draft.fileId ?? ""} onChange={(e) => patch({ fileId: e.target.value || null })}>
                  <option value="">{t.chooseFile}</option>
                  {files.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          {draft.kind !== "file" && (
            <Field label={t.body} hint={draft.kind === "video" ? t.bodyHintVideo : undefined}>
              {(props) => <Textarea {...props} dir="auto" rows={draft.kind === "text" ? 6 : 2} value={draft.body ?? ""} onChange={(e) => patch({ body: e.target.value })} />}
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t.duration}
              type="number"
              inputMode="numeric"
              min={0}
              value={draft.durationSeconds ? String(Math.round(draft.durationSeconds / 60)) : ""}
              onChange={(e) => patch({ durationSeconds: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value) * 60)) })}
            />
            <TextField
              label={t.dripDays}
              hint={t.dripHint}
              type="number"
              inputMode="numeric"
              min={0}
              value={String(draft.dripDays ?? 0)}
              onChange={(e) => patch({ dripDays: Math.max(0, Math.floor(Number(e.target.value)) || 0) })}
            />
          </div>

          <SwitchRow label={t.freePreview} hint={t.freePreviewHint} checked={Boolean(draft.isFreePreview)} onChange={(isFreePreview) => patch({ isFreePreview })} />
        </form>
      )}
    </Modal>
  );
}
