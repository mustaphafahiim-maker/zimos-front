import { useState } from "react";
import { Alert, Button, Input, Label } from "@store-builder/ui";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { STEP_TYPE_LABELS } from "./FunnelEditorPage.strings";
import type { UiStepType } from "./funnelAdapter";

const STRINGS = {
  en: {
    title: "Page title",
    titleHint: "Your own name for the page. On a generic page it is also the link's text in the funnel's footer.",
    address: "Address",
    addressHint: "Lowercase letters, digits and hyphens.",
    lockedAddress: "A page on the funnel map keeps its address: the map's links and visitors' sessions use it.",
    type: "Type",
    preview: "Opens at",
    invalid: "Use lowercase letters, digits and hyphens, starting and ending with a letter or digit.",
    taken: "Another page of this funnel already uses this address.",
    oldKept: "Links to the old address keep opening this page.",
    save: "Apply",
    applied: "Applied to the funnel. Save the funnel to keep it; the new address goes live when you publish.",
  },
  ar: {
    title: "اسم الصفحة",
    titleHint: "اسمك انت للصفحة. في الصفحة العامة بيبقى كمان نص اللينك في فوتر مسار البيع.",
    address: "العنوان",
    addressHint: "حروف إنجليزي صغيرة وأرقام وشَرطات (-).",
    lockedAddress: "الصفحة اللي على خريطة مسار البيع عنوانها ثابت: الأسهم على الخريطة وجلسات الزوار بتستخدمه.",
    type: "النوع",
    preview: "بتفتح على",
    invalid: "استخدم حروف إنجليزي صغيرة وأرقام وشَرطات، ويبدأ وينتهي بحرف أو رقم.",
    taken: "فيه صفحة تانية في مسار البيع ده بنفس العنوان.",
    oldKept: "اللينكات على العنوان القديم هتفضل تفتح الصفحة دي.",
    save: "تطبيق",
    applied: "اتطبق على مسار البيع. احفظ مسار البيع عشان يتسجّل، والعنوان الجديد يشتغل لما تنشر.",
  },
} satisfies Messages;

const KEY_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** What a typed address becomes: lowercase, spaces and underscores to hyphens, nothing else. */
const tidy = (v: string) =>
  v
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-");

/**
 * Page settings → Details for a funnel step (SPEC §9.3: "the link using
 * letters, digits and hyphens, internal title, type"). The title can always
 * change. The address (the step's key) only can on a generic page; the
 * backend (funnels/genericPageAddress.js) keeps the old one working. Changes
 * go into the funnel draft like any other edit and are saved with it.
 */
export function StepDetailsForm({
  name,
  stepKey,
  type,
  generic,
  taken,
  pathOf,
  onApply,
}: {
  name: string;
  stepKey: string;
  type: UiStepType;
  /** A generic page (no edge in or out): its address can change. */
  generic: boolean;
  /** Addresses this page may not take: the funnel's other pages, saved or not. */
  taken: string[];
  /** A generic page's public address for a key. */
  pathOf: (key: string) => string;
  onApply: (changes: { name: string; key: string }) => void;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const toast = useToast();
  const [title, setTitle] = useState(name);
  const [key, setKey] = useState(stepKey);

  const cleanKey = key.replace(/^-+|-+$/g, "");
  const problem = !generic || cleanKey === stepKey ? null : !KEY_RE.test(cleanKey) ? t.invalid : taken.includes(cleanKey) ? t.taken : null;
  const changed = title.trim() !== name || (generic && cleanKey !== stepKey);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pd-title">{t.title}</Label>
        <Input id="pd-title" dir="auto" maxLength={200} value={title} aria-describedby="pd-title-hint" onChange={(e) => setTitle(e.target.value)} />
        <p id="pd-title-hint" className="text-xs text-ink-soft">
          {t.titleHint}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pd-key">{t.address}</Label>
        <Input
          id="pd-key"
          dir="ltr"
          maxLength={100}
          value={key}
          readOnly={!generic}
          aria-invalid={problem ? true : undefined}
          aria-describedby="pd-key-hint"
          onChange={(e) => setKey(tidy(e.target.value))}
        />
        <p id="pd-key-hint" className="text-xs text-ink-soft">
          {generic ? t.addressHint : t.lockedAddress}{" "}
          {generic && cleanKey && (
            <>
              {t.preview} <bdi dir="ltr">{pathOf(cleanKey)}</bdi>
            </>
          )}
        </p>
        {problem && <p className="text-xs text-danger">{problem}</p>}
        {generic && !problem && cleanKey !== stepKey && <Alert>{t.oldKept}</Alert>}
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium text-ink">{t.type}</span>
        <p className="text-sm text-ink-soft">{STEP_TYPE_LABELS[locale][type]}</p>
      </div>
      <div className="text-end">
        <Button
          type="button"
          disabled={!changed || Boolean(problem) || !title.trim() || !cleanKey}
          onClick={() => {
            onApply({ name: title.trim(), key: generic ? cleanKey : stepKey });
            toast.success(t.applied);
          }}
        >
          {t.save}
        </Button>
      </div>
    </div>
  );
}
