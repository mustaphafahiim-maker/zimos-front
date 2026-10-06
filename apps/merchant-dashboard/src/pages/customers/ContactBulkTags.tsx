import { useEffect, useState } from "react";
import { Tag, TagsIcon, X } from "lucide-react";
import { Alert, Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label } from "@store-builder/ui";
import { contactsBulkTag } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { parseTagInput } from "./contactStrings";

const STRINGS = {
  en: {
    selected: "{count} selected",
    add: "Add tags",
    remove: "Remove tags",
    clear: "Clear selection",
    addTitle: "Add tags to {count} contacts",
    removeTitle: "Remove tags from {count} contacts",
    addDescription: "Each contact keeps its other tags. Automations and segments that use these tags pick the contacts up.",
    removeDescription: "Only these tags are taken off; the contacts' other tags stay.",
    tags: "Tags",
    tagsHint: "Separate tags with commas, or pick from the tags in use.",
    inUse: "Tags in use",
    apply: "Apply",
    applying: "Applying…",
    cancel: "Cancel",
    close: "Close",
    needTags: "Write or pick at least one tag.",
    addedToast: "Tags added to {count} contacts.",
    removedToast: "Tags removed from {count} contacts.",
  },
  ar: {
    selected: "اخترت {count}",
    add: "إضافة وسوم",
    remove: "إزالة وسوم",
    clear: "إلغاء التحديد",
    addTitle: "إضافة وسوم إلى {count} جهة اتصال",
    removeTitle: "إزالة وسوم من {count} جهة اتصال",
    addDescription: "تحتفظ كل جهة اتصال بوسومها الأخرى، وتلتقطها الأتمتة والشرائح التي تستخدم هذه الوسوم.",
    removeDescription: "تُزال هذه الوسوم فقط، وتبقى الوسوم الأخرى كما هي.",
    tags: "الوسوم",
    tagsHint: "افصل بين الوسوم بفاصلة، أو اختر من الوسوم المستخدمة.",
    inUse: "وسوم مستخدمة",
    apply: "تطبيق",
    applying: "بنطبّق…",
    cancel: "إلغاء",
    close: "إغلاق",
    needTags: "اكتب وسمًا واحدًا على الأقل أو اختره.",
    addedToast: "تمت إضافة الوسوم إلى {count} جهة اتصال.",
    removedToast: "تمت إزالة الوسوم من {count} جهة اتصال.",
  },
} satisfies Messages;

// The server takes at most this many contacts per request (contactValidation.bulkTag).
const CHUNK = 200;

/**
 * Tagging many contacts at once (SPEC §18.4; backend POST /contacts/bulk-tag):
 * the bar over the contacts list while some are ticked, and the dialog that
 * adds or removes the tags.
 */
export function ContactBulkBar({
  selectedIds,
  tagOptions,
  onClear,
  onDone,
}: {
  selectedIds: string[];
  tagOptions: { tag: string; count: number }[];
  onClear: () => void;
  onDone: () => void;
}) {
  const t = useT(STRINGS);
  const [mode, setMode] = useState<"add" | "remove" | null>(null);
  if (selectedIds.length === 0) return null;
  return (
    <>
      <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-primary/40 bg-primary-soft px-3 py-2">
        <span className="text-sm font-medium text-ink">{fmt(t.selected, { count: selectedIds.length })}</span>
        <Button size="sm" variant="outline" className="min-h-10" onClick={() => setMode("add")}>
          <Tag className="size-4" aria-hidden />
          {t.add}
        </Button>
        <Button size="sm" variant="outline" className="min-h-10" onClick={() => setMode("remove")}>
          <TagsIcon className="size-4" aria-hidden />
          {t.remove}
        </Button>
        <Button variant="ghost" size="sm" className="ms-auto min-h-10" onClick={onClear}>
          {t.clear}
        </Button>
      </div>
      <BulkTagDialog
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

function BulkTagDialog({
  mode,
  selectedIds,
  tagOptions,
  onClose,
  onDone,
}: {
  mode: "add" | "remove" | null;
  selectedIds: string[];
  tagOptions: { tag: string; count: number }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode) {
      setText("");
      setError(null);
    }
  }, [mode]);

  const tags = parseTagInput(text);
  const count = selectedIds.length;
  const edit = (next: string) => {
    setText(next);
    setError(null);
  };
  const pick = (tag: string) => edit(tags.includes(tag) ? tags.filter((x) => x !== tag).join(", ") : [...tags, tag].join(", "));

  async function apply() {
    if (!mode) return;
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
      toast.success(fmt(mode === "add" ? t.addedToast : t.removedToast, { count: updated }));
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={mode !== null} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader className="flex-row items-start justify-between gap-2">
          <div className="space-y-1">
            <DialogTitle>{fmt(mode === "remove" ? t.removeTitle : t.addTitle, { count })}</DialogTitle>
            <DialogDescription>{mode === "remove" ? t.removeDescription : t.addDescription}</DialogDescription>
          </div>
          <DialogClose render={<Button type="button" size="icon-sm" variant="ghost" aria-label={t.close} title={t.close} />}>
            <X className="size-4" aria-hidden />
          </DialogClose>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void apply();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="bulk-tags">{t.tags}</Label>
            <Input id="bulk-tags" dir="auto" autoFocus value={text} aria-describedby="bulk-tags-hint" onChange={(e) => edit(e.target.value)} />
            <p id="bulk-tags-hint" className="text-xs text-ink-soft">
              {t.tagsHint}
            </p>
          </div>
          {tagOptions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ink">{t.inUse}</p>
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {tagOptions.slice(0, 40).map((option) => {
                  const on = tags.includes(option.tag);
                  return (
                    <button
                      key={option.tag}
                      type="button"
                      aria-pressed={on}
                      onClick={() => pick(option.tag)}
                      className={
                        on
                          ? "cursor-pointer rounded-full border border-primary bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary-dark dark:text-primary"
                          : "cursor-pointer rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-ink hover:border-line-strong"
                      }
                    >
                      <bdi>{option.tag}</bdi> <span className="text-ink-soft">({option.count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {error && <Alert variant="danger">{error}</Alert>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t.applying : t.apply}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
