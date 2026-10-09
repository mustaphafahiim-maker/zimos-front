import { useState } from "react";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { Alert, Badge, cn } from "@store-builder/ui";
import { IconCaretDown } from "@/components/icons";
import {
  CUSTOM_CODE_MAX_LENGTH,
  storeDesignListCustomCode,
  storeDesignSaveCustomCode,
  type CustomCodeSlot,
  type CustomCodeSlotKey,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup } from "@/components/settings";
import { Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { ToggleRow } from "./SettingsFormFooter";
import { STACK, SettingsSkeleton } from "./sections/parts";

const GROUPS: Array<{ id: "blocks" | "head" | "files"; slots: CustomCodeSlotKey[] }> = [
  {
    id: "blocks",
    slots: [
      "above_header",
      "below_header",
      "above_gallery",
      "below_gallery",
      "above_form",
      "below_form",
      "above_footer",
      "below_footer",
    ],
  },
  { id: "head", slots: ["head"] },
  { id: "files", slots: ["css", "js"] },
];
const ALL_SLOTS: CustomCodeSlotKey[] = GROUPS.flatMap((group) => group.slots);

const STRINGS = {
  en: {
    warning:
      "Code you add here runs for every shopper. Only paste code from sources you trust: a bad script can break the store or leak orders. Every change is recorded in the activity log.",
    where:
      "Your code runs only on your store's own address. It never runs inside this dashboard, in the editor preview, or on the card payment page.",
    blocks: "UI blocks",
    blocksDescription: "HTML placed at fixed spots of the store.",
    head: "Head code",
    headDescription:
      "Added inside <head> on every store page, in the page the server sends — for outside tracking tools and domain verification tags (Google Search Console, Meta).",
    files: "Design files",
    filesDescription: "A stylesheet and a script loaded on every store page.",
    above_header: "Above the header",
    below_header: "Below the header",
    above_gallery: "Above the product images",
    below_gallery: "Below the product images",
    above_form: "Above the purchase form",
    below_form: "Below the purchase form",
    above_footer: "Above the footer",
    below_footer: "Below the footer",
    css: "CSS",
    js: "JavaScript",
    enabled: "Enabled",
    code: "Code",
    on: "On",
    empty: "Empty",
    off: "Off",
    unsaved: "Not saved yet",
    lastEdit: "Last edited {date}",
    save: "Save",
    saving: "Saving…",
    discard: "Discard",
    saved: "Code saved.",
  },
  ar: {
    warning:
      "الكود الذي تضيفه هنا يعمل عند كل مشتري. الصق فقط كودًا من مصادر تثق بها: سكربت سيئ قد يعطل المتجر أو يسرّب الطلبات. كل تغيير يُسجل في سجل النشاط.",
    where: "الكود يعمل فقط على عنوان متجرك. لا يعمل داخل لوحة التحكم ولا في معاينة المحرر ولا في صفحة الدفع بالبطاقة.",
    blocks: "بلوكات الواجهة",
    blocksDescription: "HTML يوضع في أماكن ثابتة من المتجر.",
    head: "كود الـ Head",
    headDescription: "يضاف داخل <head> في كل صفحات المتجر من السيرفر نفسه — لأدوات التتبع الخارجية وأكواد التحقق من الدومين (Google Search Console وMeta).",
    files: "ملفات التصميم",
    filesDescription: "ملف تنسيق وسكربت يُحمّلان في كل صفحات المتجر.",
    above_header: "فوق الهيدر",
    below_header: "تحت الهيدر",
    above_gallery: "فوق صور المنتج",
    below_gallery: "تحت صور المنتج",
    above_form: "فوق نموذج الشراء",
    below_form: "تحت نموذج الشراء",
    above_footer: "فوق الفوتر",
    below_footer: "تحت الفوتر",
    css: "CSS",
    js: "JavaScript",
    enabled: "مفعّل",
    code: "الكود",
    on: "مفعّل",
    empty: "فاضي",
    off: "مقفول",
    unsaved: "لسه ما اتحفظش",
    lastEdit: "آخر تعديل {date}",
    save: "احفظ الكود",
    saving: "بنحفظ…",
    discard: "سيبه زي ما كان",
    saved: "اتحفظ الكود.",
  },
} satisfies Messages;

type Draft = { html: string; isActive: boolean };

export function CustomCodeTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  // A 403 here (no website.publish) is the no-permission state DataState draws.
  const state = useAsync(() => storeDesignListCustomCode(apiClient, workspaceId), [workspaceId]);
  const [drafts, setDrafts] = useState<Partial<Record<CustomCodeSlotKey, Draft>>>({});
  const [open, setOpen] = useState<CustomCodeSlotKey | null>(null);
  const [saving, setSaving] = useState<CustomCodeSlotKey | null>(null);
  const [errors, setErrors] = useState<Partial<Record<CustomCodeSlotKey, string>>>({});

  const bySlot = new Map((state.data ?? []).map((s) => [s.slot, s]));
  const storedOf = (key: CustomCodeSlotKey): Draft => {
    const stored = bySlot.get(key);
    return { html: stored?.html ?? "", isActive: stored?.isActive ?? false };
  };
  const isDirty = (key: CustomCodeSlotKey) => {
    const draft = drafts[key];
    if (!draft) return false;
    const stored = storedOf(key);
    return draft.html !== stored.html || draft.isActive !== stored.isActive;
  };
  // The spots with an edit that is not saved yet: what the save bar saves, and what a switch of section asks about.
  const dirtySlots = ALL_SLOTS.filter(isDirty);
  useReportDirty(dirtySlots.length > 0);

  /** Saves one spot through its own endpoint, as before. Answers whether it went through. */
  async function save(slot: CustomCodeSlotKey, draft: Draft): Promise<boolean> {
    setSaving(slot);
    setErrors((prev) => ({ ...prev, [slot]: undefined }));
    try {
      const saved = await storeDesignSaveCustomCode(apiClient, workspaceId, slot, draft);
      state.setData((prev) => (prev ?? []).map((s) => (s.slot === slot ? saved : s)));
      setDrafts((prev) => ({ ...prev, [slot]: undefined }));
      return true;
    } catch (err) {
      setErrors((prev) => ({ ...prev, [slot]: errorMessage(err) }));
      // The spot that failed opens, so its message is on screen.
      setOpen(slot);
      return false;
    } finally {
      setSaving(null);
    }
  }

  /** The save bar: every changed spot, one after the other. One that fails keeps its edit and says why. */
  async function saveAll() {
    let done = 0;
    for (const slot of dirtySlots) {
      const draft = drafts[slot];
      if (draft && (await save(slot, draft))) done += 1;
    }
    if (done > 0) toast.success(t.saved);
  }

  function discardAll() {
    setDrafts({});
    setErrors({});
  }

  function row(key: CustomCodeSlotKey) {
    const stored: CustomCodeSlot | undefined = bySlot.get(key);
    const draft: Draft = drafts[key] ?? storedOf(key);
    const dirty = isDirty(key);
    const expanded = open === key;
    const busy = saving !== null;
    const edit = (patch: Partial<Draft>) => setDrafts((prev) => ({ ...prev, [key]: { ...draft, ...patch } }));
    const live = Boolean(stored?.isActive && stored.html.trim());

    return (
      <li key={key} className="relative border-t border-line first:border-t-0">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setOpen(expanded ? null : key)}
          className="flex min-h-13 w-full cursor-pointer items-center justify-between gap-3 px-4 py-2 text-start transition-colors hover:bg-ink/4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        >
          <span className="min-w-0 flex-1 text-sm leading-5 font-medium text-ink">{t[key]}</span>
          {dirty ? (
            <Badge variant="secondary">{t.unsaved}</Badge>
          ) : live ? (
            <Badge>{t.on}</Badge>
          ) : (
            <span className="text-[13px] text-ink-soft">{stored?.html.trim() ? t.off : t.empty}</span>
          )}
          <IconCaretDown
            className={cn("size-4 shrink-0 text-ink-soft transition-transform duration-[var(--dur-fade)] motion-reduce:transition-none", expanded && "rotate-180")}
            weight="bold"
            aria-hidden
          />
        </button>

        {expanded && (
          <div className="space-y-3 px-4 pb-4">
            <ToggleRow label={t.enabled} checked={draft.isActive} disabled={busy} onChange={(isActive) => edit({ isActive })} />
            <Field label={t.code} error={errors[key]} labelHidden>
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={8}
                  dir="ltr"
                  spellCheck={false}
                  autoCapitalize="none"
                  autoCorrect="off"
                  maxLength={CUSTOM_CODE_MAX_LENGTH}
                  // 16px on a phone (no zoom on focus), small from sm up where code wants the room.
                  className="font-mono text-base sm:text-xs"
                  disabled={busy}
                  value={draft.html}
                  onChange={(e) => edit({ html: e.target.value })}
                />
              )}
            </Field>
            {stored?.updatedAt && <p className="text-xs text-ink-soft">{t.lastEdit.replace("{date}", formatDate(stored.updatedAt))}</p>}
          </div>
        )}
      </li>
    );
  }

  const firstError = dirtySlots.map((slot) => errors[slot]).find(Boolean);

  return (
    <DataState loading={state.loading} error={state.error} onRetry={() => void state.refresh()} skeleton={<SettingsSkeleton groups={2} rows={4} />}>
      <div className={STACK}>
        <Alert variant="danger">{t.warning}</Alert>
        {GROUPS.map((group) => (
          <SettingsGroup key={group.id} title={t[group.id]} description={t[`${group.id}Description`]} footer={group.id === "files" ? t.where : undefined}>
            <ul role="list">{group.slots.map(row)}</ul>
          </SettingsGroup>
        ))}
        <SaveBar
          dirty={dirtySlots.length > 0}
          saving={saving !== null}
          onSave={() => void saveAll()}
          onDiscard={discardAll}
          saveLabel={t.save}
          savingLabel={t.saving}
          discardLabel={t.discard}
          message={
            firstError ? (
              <span role="alert" className="text-danger">
                {firstError}
              </span>
            ) : undefined
          }
        />
      </div>
    </DataState>
  );
}
