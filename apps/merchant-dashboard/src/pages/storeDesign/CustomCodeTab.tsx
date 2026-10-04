import { useState } from "react";
import { Alert, Badge, Button } from "@store-builder/ui";
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
import { Section } from "@/components/Section";
import { Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { ToggleRow } from "./SettingsFormFooter";

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
    empty: "فارغ",
    lastEdit: "آخر تعديل {date}",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    discard: "تجاهل",
    saved: "تم حفظ الكود.",
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

  async function save(slot: CustomCodeSlotKey, draft: Draft) {
    setSaving(slot);
    setErrors((prev) => ({ ...prev, [slot]: undefined }));
    try {
      const saved = await storeDesignSaveCustomCode(apiClient, workspaceId, slot, draft);
      state.setData((prev) => (prev ?? []).map((s) => (s.slot === slot ? saved : s)));
      setDrafts((prev) => ({ ...prev, [slot]: undefined }));
      toast.success(t.saved);
    } catch (err) {
      setErrors((prev) => ({ ...prev, [slot]: errorMessage(err) }));
    } finally {
      setSaving(null);
    }
  }

  function row(key: CustomCodeSlotKey) {
    const stored: CustomCodeSlot | undefined = bySlot.get(key);
    const draft: Draft = drafts[key] ?? { html: stored?.html ?? "", isActive: stored?.isActive ?? false };
    const dirty = drafts[key] !== undefined && (draft.html !== (stored?.html ?? "") || draft.isActive !== (stored?.isActive ?? false));
    const expanded = open === key;
    const busy = saving === key;
    const edit = (patch: Partial<Draft>) => setDrafts((prev) => ({ ...prev, [key]: { ...draft, ...patch } }));

    return (
      <li key={key} className="py-3 first:pt-0 last:pb-0">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setOpen(expanded ? null : key)}
          className="flex w-full cursor-pointer items-center justify-between gap-3 text-start"
        >
          <span className="text-sm font-medium text-ink">{t[key]}</span>
          {stored?.isActive && stored.html.trim() ? (
            <Badge>{t.on}</Badge>
          ) : (
            <span className="text-xs text-ink-soft">{stored?.html.trim() ? "" : t.empty}</span>
          )}
        </button>

        {expanded && (
          <div className="mt-3 space-y-3 rounded-[0.5rem] bg-paper p-3">
            <ToggleRow label={t.enabled} checked={draft.isActive} disabled={busy} onChange={(isActive) => edit({ isActive })} />
            <Field label={t.code} error={errors[key]} labelHidden>
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={8}
                  dir="ltr"
                  spellCheck={false}
                  maxLength={CUSTOM_CODE_MAX_LENGTH}
                  className="font-mono text-xs"
                  disabled={busy}
                  value={draft.html}
                  onChange={(e) => edit({ html: e.target.value })}
                />
              )}
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-ink-soft">
                {stored?.updatedAt ? t.lastEdit.replace("{date}", formatDate(stored.updatedAt)) : ""}
              </span>
              <div className="flex gap-2">
                {dirty && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => setDrafts((prev) => ({ ...prev, [key]: undefined }))}
                  >
                    {t.discard}
                  </Button>
                )}
                <Button size="sm" disabled={busy || !dirty} onClick={() => void save(key, draft)}>
                  {busy ? t.saving : t.save}
                </Button>
              </div>
            </div>
          </div>
        )}
      </li>
    );
  }

  return (
    <DataState loading={state.loading} error={state.error} onRetry={() => void state.refresh()}>
      <div className="space-y-5">
        <Alert variant="danger">{t.warning}</Alert>
        <Alert>{t.where}</Alert>
        {GROUPS.map((group) => (
          <Section key={group.id} title={t[group.id]} description={t[`${group.id}Description`]}>
            <ul className="divide-y divide-line">{group.slots.map(row)}</ul>
          </Section>
        ))}
      </div>
    </DataState>
  );
}
