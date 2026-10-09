import { useEffect, useId, useState, type ReactNode } from "react";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import { contactsBulkTag } from "@store-builder/api-client";
import { IconMinus, IconTag } from "@/components/icons";
import { BulkBar } from "@/components/list";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { pluralOf } from "@/lib/plural";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { parseTagInput } from "./contactStrings";
import { FormSheet } from "./list/FormSheet";

const STRINGS = {
  en: {
    selected_one: "1 contact selected",
    selected_other: "{n} contacts selected",
    add: "Add tags",
    remove: "Remove tags",
    addTitle: "Add tags to {count}",
    removeTitle: "Remove tags from {count}",
    contacts_one: "1 contact",
    contacts_other: "{n} contacts",
    addDescription: "Each contact keeps its other tags. Automations and segments that use these tags pick the contacts up.",
    removeDescription: "Only these tags are taken off; the contacts' other tags stay.",
    tags: "Tags",
    tagsHint: "Separate tags with commas, or pick from the tags in use.",
    inUse: "Tags in use",
    tagWithCount: "{tag} ({count})",
    apply: "Apply",
    applying: "Applying…",
    cancel: "Cancel",
    needTags: "Write or pick at least one tag.",
    addedToast: "Tags added to {count}.",
    removedToast: "Tags removed from {count}.",
  },
  ar: {
    selected_one: "جهة اتصال واحدة متحددة",
    selected_two: "جهتين اتصال متحددين",
    selected_few: "{n} جهات اتصال متحددة",
    selected_other: "{n} جهة اتصال متحددة",
    add: "ضيف وسوم",
    remove: "شيل وسوم",
    addTitle: "ضيف وسوم لـ {count}",
    removeTitle: "شيل وسوم من {count}",
    contacts_one: "جهة اتصال واحدة",
    contacts_two: "جهتين اتصال",
    contacts_few: "{n} جهات اتصال",
    contacts_other: "{n} جهة اتصال",
    addDescription: "كل جهة اتصال بتفضل بوسومها التانية، والأتمتة والشرائح اللي بتستخدم الوسوم دي بتلقطها.",
    removeDescription: "الوسوم دي بس اللي بتتشال، وباقي الوسوم بتفضل زي ما هي.",
    tags: "الوسوم",
    tagsHint: "افصل بين الوسوم بفاصلة، أو اختار من الوسوم المستخدمة.",
    inUse: "وسوم مستخدمة",
    tagWithCount: "{tag} ({count})",
    apply: "طبّق",
    applying: "بنطبّق…",
    cancel: "إلغاء",
    needTags: "اكتب وسم واحد على الأقل أو اختاره.",
    addedToast: "الوسوم اتضافت لـ {count}.",
    removedToast: "الوسوم اتشالت من {count}.",
  },
} satisfies Messages;

// The server takes at most this many contacts per request (contactValidation.bulkTag).
const CHUNK = 200;

export type BulkTagMode = "add" | "remove";

// The same pill as a chip of the row over a list (components/list/ChipRow.tsx): glass/list.css styles `.zimos-chip` once.
const PICK =
  "zimos-chip inline-flex h-10 max-w-full cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium select-none pointer-coarse:h-11 " +
  "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100";
const PICK_ON = "bg-primary text-primary-foreground";
const PICK_OFF = "bg-paper-raised text-ink ring-1 ring-line hover:bg-paper-sunken";

/**
 * Tagging many contacts at once (SPEC §18.4; backend POST /contacts/bulk-tag):
 * the list kit's bar, which rises over the contacts list while some are
 * ticked — «ضيف وسوم» first, «شيل وسوم» beside it — and the sheet that adds or
 * removes the tags.
 */
export function ContactBulkBar({
  selectedIds,
  tagOptions,
  onClear,
  onDone,
  extra,
}: {
  selectedIds: string[];
  tagOptions: { tag: string; count: number }[];
  onClear: () => void;
  onDone: () => void;
  /** A line under the bar's actions: "select everything shown". */
  extra?: ReactNode;
}) {
  const t = useT(STRINGS);
  const [mode, setMode] = useState<BulkTagMode | null>(null);
  return (
    <>
      <BulkBar
        count={selectedIds.length}
        label={pluralOf(t, "selected", selectedIds.length)}
        onClear={onClear}
        actions={[
          { id: "add-tags", label: t.add, icon: IconTag, onSelect: () => setMode("add") },
          { id: "remove-tags", label: t.remove, icon: IconMinus, onSelect: () => setMode("remove") },
        ]}
        maxInline={2}
        extra={extra}
      />
      <BulkTagSheet
        mode={mode}
        selectedIds={selectedIds}
        tagOptions={tagOptions}
        onClose={() => setMode(null)}
        onDone={() => {
          setMode(null);
          onDone();
        }}
      />
    </>
  );
}

/**
 * The sheet behind «ضيف وسوم» / «شيل وسوم»: one field (tags, separated by
 * commas) and the tags already in use as pills to pick from. The contacts are
 * sent in chunks of 200, as the server asks. Also opened for a single contact
 * from its row's menu.
 */
export function BulkTagSheet({
  mode,
  selectedIds,
  tagOptions,
  onClose,
  onDone,
}: {
  /** Which way it works; null keeps it closed. */
  mode: BulkTagMode | null;
  selectedIds: string[];
  tagOptions: { tag: string; count: number }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const fieldId = useId();
  const hintId = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What the sheet says stays while it closes: the title must not flip to the other mode on its way out.
  const [lastMode, setLastMode] = useState<BulkTagMode>("add");
  if (mode && mode !== lastMode) setLastMode(mode);
  const [lastCount, setLastCount] = useState(selectedIds.length);
  if (mode && selectedIds.length !== lastCount) setLastCount(selectedIds.length);

  useEffect(() => {
    if (mode) {
      setText("");
      setError(null);
    }
  }, [mode]);

  const tags = parseTagInput(text);
  const who = pluralOf(t, "contacts", lastCount);
  const edit = (next: string) => {
    setText(next);
    setError(null);
  };
  const pick = (tag: string) => edit(tags.includes(tag) ? tags.filter((x) => x !== tag).join(", ") : [...tags, tag].join(", "));

  async function apply() {
    if (!mode || busy) return;
    if (tags.length === 0) return setError(t.needTags);
    setBusy(true);
    setError(null);
    try {
      let updated = 0;
      for (let i = 0; i < selectedIds.length; i += CHUNK) {
        const customerIds = selectedIds.slice(i, i + CHUNK);
        const result = await contactsBulkTag(apiClient, workspaceId, mode === "add" ? { customerIds, add: tags } : { customerIds, remove: tags });
        updated += result.updated;
      }
      toast.success(fmt(mode === "add" ? t.addedToast : t.removedToast, { count: pluralOf(t, "contacts", updated) }));
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSheet
      open={mode !== null}
      onClose={onClose}
      busy={busy}
      title={fmt(lastMode === "remove" ? t.removeTitle : t.addTitle, { count: who })}
      description={lastMode === "remove" ? t.removeDescription : t.addDescription}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy}>
            {busy ? t.applying : t.apply}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void apply();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor={fieldId}>{t.tags}</Label>
          <Input id={fieldId} dir="auto" className="h-11" value={text} aria-describedby={hintId} onChange={(e) => edit(e.target.value)} />
          <p id={hintId} className="text-xs text-ink-soft">
            {t.tagsHint}
          </p>
        </div>
        {tagOptions.length > 0 && (
          <div className="space-y-2">
            <p className="text-[13px] leading-5 font-semibold text-ink">{t.inUse}</p>
            <div role="group" aria-label={t.inUse} className="-m-1 flex max-h-44 flex-wrap gap-2 overflow-y-auto overscroll-contain p-1">
              {tagOptions.slice(0, 40).map((option) => {
                const on = tags.includes(option.tag);
                return (
                  <button
                    key={option.tag}
                    type="button"
                    aria-pressed={on}
                    aria-label={fmt(t.tagWithCount, { tag: option.tag, count: option.count })}
                    onClick={() => pick(option.tag)}
                    className={cn(PICK, on ? PICK_ON : PICK_OFF)}
                  >
                    <bdi className="min-w-0 truncate">{option.tag}</bdi>
                    <span aria-hidden className={cn("text-xs tabular-nums", on ? "opacity-80" : "text-ink-soft")}>
                      {fmt("{n}", { n: option.count })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {error && <Alert variant="danger">{error}</Alert>}
      </form>
    </FormSheet>
  );
}
