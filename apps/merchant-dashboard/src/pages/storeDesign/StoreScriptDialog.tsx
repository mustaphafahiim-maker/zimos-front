import { useEffect, useState } from "react";
import { IconClose } from "@/components/icons";
import { Alert, Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Label } from "@store-builder/ui";
import {
  storeScriptsCreate,
  storeScriptsUpdate,
  type StoreScript,
  type StoreScriptPageType,
  type StoreScriptPosition,
  type StoreScriptsOptions,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { getFieldErrors } from "@/lib/errors";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { Textarea } from "@/components/Textarea";
import { ToggleRow } from "./SettingsFormFooter";
import { SCRIPT_STRINGS } from "./storeScriptsStrings";

const STRINGS = {
  en: {
    newTitle: "Add script",
    editTitle: "Edit script",
    close: "Close",
    cancel: "Cancel",
    save: "Save script",
    create: "Add script",
    saving: "Saving…",
    namePlaceholder: "e.g. Hotjar, chat widget",
    headHint: "Inside <head>: tracking and verification tags, styles.",
    body_startHint: "Right after <body> opens: tags that must come first, like Google Tag Manager's noscript.",
    body_endHint: "Before </body>: chat widgets and scripts that wait for the page.",
    pagesHint: "Choose “All pages”, or only the kinds of pages it should run on.",
    code: "Code",
    codeHint: "Paste it exactly as the tool gives it, <script> tags included.",
    counter: "{n} / {max}",
    run: "Run this script",
    runHint: "Turn it off to keep the code without running it.",
    needName: "Name the script.",
    needPages: "Choose at least one kind of page.",
    tooLong: "The code is longer than {max} characters.",
  },
  ar: {
    newTitle: "إضافة سكريبت",
    editTitle: "تعديل السكريبت",
    close: "إغلاق",
    cancel: "إلغاء",
    save: "حفظ السكريبت",
    create: "إضافة السكريبت",
    saving: "بيحفظ…",
    namePlaceholder: "مثلًا: Hotjar، الشات",
    headHint: "جوه <head>: أكواد التتبع والتحقق والتنسيق.",
    body_startHint: "أول حاجة بعد ما الـ body يفتح: أكواد لازم تبقى في الأول، زي noscript بتاع Google Tag Manager.",
    body_endHint: "قبل </body>: الشات والسكريبتات اللي بتستنى الصفحة تحمّل.",
    pagesHint: "اختار «كل الصفحات»، أو أنواع الصفحات اللي يشتغل فيها بس.",
    code: "الكود",
    codeHint: "الصقه زي ما الأداة بتديهولك، بعلامات <script> كمان.",
    counter: "{n} / {max}",
    run: "شغّل السكريبت ده",
    runHint: "اقفله لو عايز تحتفظ بالكود من غير ما يشتغل.",
    needName: "اكتب اسم للسكريبت.",
    needPages: "اختار نوع صفحة واحد على الأقل.",
    tooLong: "الكود أطول من {max} حرف.",
  },
} satisfies Messages;

type Draft = { name: string; position: StoreScriptPosition; pages: StoreScriptPageType[]; code: string; isActive: boolean };

const EMPTY: Draft = { name: "", position: "head", pages: ["all"], code: "", isActive: true };

/**
 * Adds or edits one store script (customCode/storeScripts.js): its name, where
 * it goes (head / body start / body end), the kinds of pages it runs on, the
 * code and whether it runs.
 */
export function StoreScriptDialog({
  open,
  script,
  options,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The script being edited; null to add one. */
  script: StoreScript | null;
  options: StoreScriptsOptions;
  onClose: () => void;
  onSaved: (script: StoreScript, created: boolean) => void;
}) {
  const t = useT(STRINGS);
  const s = useT(SCRIPT_STRINGS);
  const { intlLocale } = useLocale();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFields({});
    setDraft(
      script
        ? { name: script.name, position: script.position, pages: script.pages.length ? script.pages : ["all"], code: script.code, isActive: script.isActive }
        : EMPTY
    );
  }, [open, script]);

  const set = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...patch }));
  const number = (n: number) => new Intl.NumberFormat(intlLocale).format(n);
  const allPages = draft.pages.includes("all");
  const pageTypes = options.pageTypes.filter((p) => p !== "all");

  function togglePage(page: StoreScriptPageType, on: boolean) {
    if (page === "all") return set({ pages: on ? ["all"] : [] });
    const rest = draft.pages.filter((p) => p !== "all" && p !== page);
    set({ pages: on ? [...rest, page] : rest });
  }

  async function save() {
    const problems: Record<string, string> = {};
    if (!draft.name.trim()) problems.name = t.needName;
    if (draft.pages.length === 0) problems.pages = t.needPages;
    if (draft.code.length > options.maxCodeLength) problems.code = fmt(t.tooLong, { max: number(options.maxCodeLength) });
    setFields(problems);
    if (Object.keys(problems).length > 0) return;

    setBusy(true);
    setError(null);
    try {
      // Pages in the store's own order, so the table reads the same every time.
      const pages = allPages ? (["all"] as StoreScriptPageType[]) : options.pageTypes.filter((p) => draft.pages.includes(p));
      const body = { name: draft.name.trim(), position: draft.position, pages, code: draft.code, isActive: draft.isActive };
      const saved = script ? await storeScriptsUpdate(apiClient, workspaceId, script.id, body) : await storeScriptsCreate(apiClient, workspaceId, body);
      onSaved(saved, !script);
    } catch (err) {
      const found = getFieldErrors(err);
      setFields({
        ...(found.name ? { name: found.name } : {}),
        ...(found.position ? { position: found.position } : {}),
        ...(found.pages ? { pages: found.pages } : {}),
        ...(found.code ? { code: found.code } : {}),
      });
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent showCloseButton={false} className="flex max-h-[90vh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader className="flex-row items-start justify-between gap-2">
          <div className="space-y-1">
            <DialogTitle>{script ? t.editTitle : t.newTitle}</DialogTitle>
            <DialogDescription>{s.liveOnly}</DialogDescription>
          </div>
          <DialogClose render={<Button type="button" size="icon-sm" variant="ghost" aria-label={t.close} title={t.close} />}>
            <IconClose className="size-4" aria-hidden />
          </DialogClose>
        </DialogHeader>

        <div className="-mx-6 min-h-0 space-y-5 overflow-y-auto px-6 pb-1">
          <div className="space-y-1.5">
            <Label htmlFor="store-script-name">{s.name}</Label>
            <Input
              id="store-script-name"
              maxLength={60}
              value={draft.name}
              placeholder={t.namePlaceholder}
              aria-invalid={fields.name ? true : undefined}
              onChange={(e) => set({ name: e.target.value })}
            />
            {fields.name && <p className="text-xs font-medium text-danger">{fields.name}</p>}
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-ink">{s.position}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {options.positions.map((position) => (
                <label
                  key={position}
                  className="flex cursor-pointer gap-2 rounded-lg border border-line p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
                >
                  <input
                    type="radio"
                    name="store-script-position"
                    className="mt-0.5 accent-primary"
                    checked={draft.position === position}
                    onChange={() => set({ position })}
                  />
                  <span>
                    <span className="block font-medium text-ink">{s[position]}</span>
                    <span className="mt-0.5 block text-xs text-ink-soft">{t[`${position}Hint`]}</span>
                  </span>
                </label>
              ))}
            </div>
            {fields.position && <p className="text-xs font-medium text-danger">{fields.position}</p>}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-ink">{s.pages}</legend>
            <p className="text-xs text-ink-soft">{t.pagesHint}</p>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-ink">
              <input type="checkbox" className="size-4 accent-primary" checked={allPages} onChange={(e) => togglePage("all", e.target.checked)} />
              {s.all}
            </label>
            <div className="grid gap-x-4 gap-y-1 ps-6 sm:grid-cols-2">
              {pageTypes.map((page) => (
                <label
                  key={page}
                  className={`flex min-h-10 items-center gap-2 text-sm ${allPages ? "cursor-default text-ink-soft" : "cursor-pointer text-ink"}`}
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    disabled={allPages}
                    checked={allPages || draft.pages.includes(page)}
                    onChange={(e) => togglePage(page, e.target.checked)}
                  />
                  {s[page]}
                </label>
              ))}
            </div>
            {fields.pages && <p className="text-xs font-medium text-danger">{fields.pages}</p>}
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="store-script-code">{t.code}</Label>
            <Textarea
              id="store-script-code"
              rows={10}
              dir="ltr"
              spellCheck={false}
              maxLength={options.maxCodeLength}
              className="font-mono text-xs"
              value={draft.code}
              aria-invalid={fields.code ? true : undefined}
              aria-describedby="store-script-code-hint"
              onChange={(e) => set({ code: e.target.value })}
            />
            <div id="store-script-code-hint" className="flex flex-wrap items-start justify-between gap-2 text-xs">
              {fields.code ? <p className="font-medium text-danger">{fields.code}</p> : <p className="text-ink-soft">{t.codeHint}</p>}
              <p className="tabular-nums text-ink-soft">
                <bdi dir="ltr">{fmt(t.counter, { n: number(draft.code.length), max: number(options.maxCodeLength) })}</bdi>
              </p>
            </div>
          </div>

          <ToggleRow label={t.run} hint={t.runHint} checked={draft.isActive} disabled={busy} onChange={(isActive) => set({ isActive })} />

          {error && <Alert variant="danger">{error}</Alert>}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? t.saving : script ? t.save : t.create}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
