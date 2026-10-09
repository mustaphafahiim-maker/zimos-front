import { useRef, useState, type FormEvent } from "react";
import { IconDelete, IconPlus, IconSearch, IconSynonyms } from "@/components/icons";
import { Alert, Button } from "@store-builder/ui";
import { SEARCH_SYNONYM_LIMITS, searchSynonymClash, searchSynonymsGet, searchSynonymsSave } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { ApiError } from "@/lib/errors";
import { UnsavedGuardProvider, useReportDirty } from "@/lib/useUnsavedGuard";
import { fmt, useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { SaveBar } from "@/components/SaveBar";
import { TagListField } from "@/components/TagListField";
import { ViewLink } from "@/components/ViewLink";
import { ListSkeleton } from "@/components/list";
import { useToast } from "@/components/Toast";
import { synonymProblems } from "./synonymGroups";
import { SEARCH_STRINGS } from "./searchStrings";

/** The store-search report, where the searches that found nothing are listed (the reports hub's store tab). */
const REPORT = "/analytics/store#search";

/** The way to the report: a quiet pill in the header, beside the page's one action. */
function ReportLink() {
  const t = useT(SEARCH_STRINGS);
  return (
    <Button asChild variant="outline" className="min-h-11 gap-2 rounded-full px-4">
      <ViewLink to={REPORT} title={t.openReport}>
        <IconSearch className="size-4" aria-hidden />
        <span className="max-sm:sr-only">{t.openReport}</span>
      </ViewLink>
    </Button>
  );
}

/**
 * Products → Search synonyms (handoff 211; read products.view, save
 * products.manage): groups of words that mean the same thing, each word a
 * chip. «لو حد دوّر على كلمة ومالقاش، بنجرّب مرادفاتها».
 */
export function SearchSynonymsPage() {
  const t = useT(SEARCH_STRINGS);
  const workspaceId = useWorkspaceId();
  const loaded = useAsync(() => searchSynonymsGet(apiClient, workspaceId), [workspaceId]);

  if (!loaded.data) {
    return (
      <div className="max-w-3xl">
        <PageHeader title={t.synTitle} description={t.synDescription} actions={<ReportLink />} />
        <DataState loading={loaded.loading} error={loaded.error} onRetry={() => void loaded.refresh()} skeleton={<ListSkeleton variant="card" rows={4} />}>
          {null}
        </DataState>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <UnsavedGuardProvider>
        <SynonymsForm key={workspaceId} initial={loaded.data} />
      </UnsavedGuardProvider>
    </div>
  );
}

interface Group {
  /** Stable while the page is open, so a group keeps its box when another is removed. */
  key: number;
  words: string[];
}

/** The server's message for a 422 on `groups`, when the error carries one. */
function groupsMessage(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const details = (err.details as { error?: { details?: Array<{ field?: string; message?: string }> } } | undefined)?.error?.details;
  return (Array.isArray(details) ? details.find((d) => d.field === "groups")?.message : null) ?? null;
}

function SynonymsForm({ initial }: { initial: string[][] }) {
  const t = useT(SEARCH_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const nextKey = useRef(initial.length);
  const listRef = useRef<HTMLUListElement>(null);
  const [saved, setSaved] = useState<string[][]>(initial);
  const [groups, setGroups] = useState<Group[]>(() => initial.map((words, key) => ({ key, words })));
  const [checked, setChecked] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Empty boxes are not groups yet: they neither count as a change nor get sent.
  const filled = groups.filter((g) => g.words.length > 0);
  const dirty = JSON.stringify(filled.map((g) => g.words)) !== JSON.stringify(saved);
  const problems = synonymProblems(groups.map((g) => g.words));
  const full = groups.length >= SEARCH_SYNONYM_LIMITS.groups;
  // Reload and close ask first while a change is unsaved (lib/useUnsavedGuard).
  useReportDirty(dirty);

  /** Brings a group's box into view and puts the caret in it. */
  function goTo(index: number) {
    requestAnimationFrame(() => {
      const box = listRef.current?.querySelector<HTMLElement>(`[data-group="${index}"]`);
      box?.scrollIntoView({ block: "center" });
      box?.querySelector<HTMLElement>("input")?.focus({ preventScroll: true });
    });
  }

  function reset(next: string[][]) {
    nextKey.current = next.length;
    setSaved(next);
    setGroups(next.map((words, key) => ({ key, words })));
    setChecked(false);
    setFailure(null);
  }

  function addGroup() {
    const index = groups.length;
    setGroups((prev) => [...prev, { key: nextKey.current++, words: [] }]);
    // The new box is the one to type in.
    goTo(index);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setChecked(true);
    if (problems.tooSmall.length > 0 || problems.clash) {
      // The first group that stops the save, in the order they stand on the page.
      const firstBad = Math.min(...problems.tooSmall, ...(problems.clash ? [problems.clash.groups[1]] : []));
      goTo(firstBad);
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      reset(await searchSynonymsSave(apiClient, workspaceId, filled.map((g) => g.words)));
      toast.success(t.synSaved);
    } catch (err) {
      const clash = searchSynonymClash(groupsMessage(err));
      setFailure(clash ? fmt(t.groupClash, { term: clash }) : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // The main button where there is nothing yet; a quiet one under the list once Save is the main thing to press.
  const addButton = (quiet: boolean) => (
    <Button type="button" variant={quiet ? "outline" : "default"} className="min-h-11 gap-2 rounded-full px-5 max-sm:w-full" disabled={saving || full} onClick={addGroup}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.addGroup}
    </Button>
  );

  // A store with no synonyms yet. (Every group removed from a store that had some is a change to save, below.)
  if (groups.length === 0 && saved.length === 0) {
    return (
      <>
        <PageHeader title={t.synTitle} description={t.synDescription} actions={<ReportLink />} />
        <EmptyState icon={<IconSynonyms weight="duotone" aria-hidden />} title={t.synEmptyTitle} description={t.synEmptyHint} action={addButton(false)} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t.synTitle} description={t.synDescription} actions={<ReportLink />} />

      <form onSubmit={submit} noValidate className="space-y-3">
        <p className="text-sm text-ink-soft max-md:hidden">
          {t.synHint} {fmt(t.groupHint, { max: SEARCH_SYNONYM_LIMITS.maxTerms })}
        </p>

        <ul ref={listRef} className="space-y-2.5 empty:hidden">
          {groups.map((group, index) => {
            const tooSmall = checked && problems.tooSmall.includes(index);
            const clash = checked && problems.clash?.groups.includes(index) ? problems.clash.term : null;
            return (
              <li
                key={group.key}
                data-group={index}
                data-slot="synonym-group"
                data-invalid={tooSmall || clash ? "" : undefined}
                className="zimos-synonym-group flex items-start gap-1 rounded-[1.25rem] bg-paper-raised p-3 ps-4 shadow-[var(--shadow-card)] ring-1 ring-line data-invalid:ring-danger/60"
              >
                <div className="min-w-0 flex-1">
                  <TagListField
                    label={fmt(t.group, { n: index + 1 })}
                    values={group.words}
                    onChange={(words) => {
                      setGroups((prev) => prev.map((g) => (g.key === group.key ? { ...g, words } : g)));
                      setFailure(null);
                    }}
                    max={SEARCH_SYNONYM_LIMITS.maxTerms}
                    maxLength={SEARCH_SYNONYM_LIMITS.term}
                    placeholder={t.groupPlaceholder}
                    dir="auto"
                    disabled={saving}
                  />
                  {(tooSmall || clash) && (
                    <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
                      {tooSmall ? t.groupTooSmall : fmt(t.groupClash, { term: clash ?? "" })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setGroups((prev) => prev.filter((g) => g.key !== group.key))}
                  aria-label={fmt(t.removeGroup, { n: index + 1 })}
                  title={fmt(t.removeGroup, { n: index + 1 })}
                  className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[color,background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] disabled:cursor-default disabled:opacity-40 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  <IconDelete className="size-5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>

        {addButton(true)}

        <p className="text-xs text-ink-soft">
          <span className="md:hidden">{fmt(t.groupHint, { max: SEARCH_SYNONYM_LIMITS.maxTerms })} </span>
          {full && fmt(t.maxGroups, { max: SEARCH_SYNONYM_LIMITS.groups })}
        </p>

        {failure && <Alert variant="danger">{failure}</Alert>}

        <SaveBar dirty={dirty} saving={saving} saveLabel={t.save} savingLabel={t.saving} onDiscard={() => reset(saved)} />
      </form>
    </>
  );
}
