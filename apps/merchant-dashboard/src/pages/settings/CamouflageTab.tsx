import { useEffect, useState, type KeyboardEvent } from "react";
import { EyeOff, X } from "lucide-react";
import { Alert, Button, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { CamouflageSettings } from "@/mock/types";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { DataState } from "@/components/DataState";
import { TextField, Field } from "@/components/Field";
import { Toggle } from "@store-builder/ui";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    removeChip: "Remove {value}",
    saved: "Ad review shield saved.",
    title: "Ad review shield",
    aka: "Also known as camouflage (التمويه).",
    whatTitle: "What it does",
    whatBody:
      "Ad-review bots and reviewers from listed countries or user agents see a harmless decoy page (or no product at all) instead of your offer, so the real page stays live for customers. Use it responsibly — it does not change what customers see.",
    enable: "Enable shield",
    enableHint: "Turn the decoy on for matching visitors.",
    mode: "Mode",
    decoy: "Show decoy page",
    decoyHint: "Serve a neutral content page with the title below.",
    hide: "Hide product",
    hideHint: "Return a plain 'not available' page with no offer or price.",
    decoyTitle: "Decoy page title",
    countries: "Blocked countries",
    countriesHint: "Two-letter codes. Press Enter or comma to add.",
    agents: "Blocked user agents",
    agentsHint: "Substring match, case-insensitive.",
    rules: "Targeting rules",
  },
  ar: {
    removeChip: "إزالة {value}",
    saved: "تم حفظ إعدادات حماية مراجعة الإعلانات.",
    title: "حماية مراجعة الإعلانات",
    aka: "تُعرف أيضًا بالتمويه (Camouflage).",
    whatTitle: "ماذا تفعل؟",
    whatBody:
      "روبوتات ومراجعو الإعلانات القادمون من الدول أو متصفحات User Agent المحددة يرون صفحة بديلة غير ضارة (أو لا يرون المنتج إطلاقًا) بدلًا من عرضك، فتظل الصفحة الحقيقية متاحة لعملائك. استخدمها بمسؤولية — فهي لا تغيّر ما يراه العملاء.",
    enable: "تفعيل الحماية",
    enableHint: "إظهار الصفحة البديلة للزوار المطابقين للقواعد.",
    mode: "الوضع",
    decoy: "عرض صفحة بديلة",
    decoyHint: "عرض صفحة محتوى محايدة بالعنوان المحدد أدناه.",
    hide: "إخفاء المنتج",
    hideHint: "عرض صفحة بسيطة «غير متاح» بدون عرض أو سعر.",
    decoyTitle: "عنوان الصفحة البديلة",
    countries: "الدول المحظورة",
    countriesHint: "رموز الدول من حرفين. اضغط Enter أو فاصلة للإضافة.",
    agents: "متصفحات User Agent المحظورة",
    agentsHint: "مطابقة جزئية للنص، دون تمييز بين الأحرف الكبيرة والصغيرة.",
    rules: "قواعد الاستهداف",
  },
} satisfies Messages;

function ChipsInput({
  id,
  values,
  onChange,
  placeholder,
  transform = (s) => s,
}: {
  id: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  transform?: (s: string) => string;
}) {
  const t = useT(STRINGS);
  const [text, setText] = useState("");

  function commit() {
    const v = transform(text.trim());
    if (v && !values.includes(v)) onChange([...values, v]);
    setText("");
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && text === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-[var(--radius-button)] border border-line bg-paper-raised px-2 py-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/40">
      {values.map((v) => (
        <span
          key={v}
          dir="ltr"
          className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary"
        >
          {v}
          <button
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            aria-label={fmt(t.removeChip, { value: v })}
            className="rounded-full hover:bg-primary/20"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        dir="ltr"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
        placeholder={values.length === 0 ? placeholder : undefined}
        className="min-w-[120px] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
      />
    </div>
  );
}

const SECTION_CARD = "rounded-2xl border border-line bg-paper-raised p-5 shadow-card";

export function CamouflageTab() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const c = useCommon();
  const settings = useAsync(() => mockApi.getCamouflage(workspaceId), [workspaceId]);
  const [draft, setDraft] = useState<CamouflageSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  function patch(p: Partial<CamouflageSettings>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await mockApi.saveCamouflage(workspaceId, draft);
      settings.setData(draft);
      toast.success(t.saved);
    } finally {
      setSaving(false);
    }
  }

  const modes = [
    ["decoy_page", t.decoy, t.decoyHint],
    ["hide_product", t.hide, t.hideHint],
  ] as const;

  return (
    <DataState loading={settings.loading || !draft} error={settings.error} onRetry={() => settings.refresh()}>
      {draft && (
        <div className="max-w-3xl space-y-6">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
              <EyeOff className="size-4 text-primary" /> {t.title}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">{t.aka}</p>
          </div>

          <Alert variant="info" className="rounded-2xl">
            <p className="font-medium text-ink">{t.whatTitle}</p>
            <p className="text-xs text-ink-soft">{t.whatBody}</p>
          </Alert>

          <section className={SECTION_CARD}>
            <Toggle label={t.enable} description={t.enableHint} checked={draft.enabled} onChange={(v) => patch({ enabled: v })} />
          </section>

          <section className={cn(SECTION_CARD, "space-y-5 transition-opacity", !draft.enabled && "opacity-60")}>
            <h3 className="text-sm font-semibold text-ink">{t.rules}</h3>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium text-ink">{t.mode}</legend>
              {modes.map(([v, title, hint]) => (
                <label
                  key={v}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors",
                    draft.mode === v ? "border-primary bg-primary-soft" : "border-line hover:bg-paper"
                  )}
                >
                  <input
                    type="radio"
                    name="camo-mode"
                    className="mt-1 accent-primary"
                    checked={draft.mode === v}
                    onChange={() => patch({ mode: v })}
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">{title}</span>
                    <span className="block text-xs text-ink-soft">{hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {draft.mode === "decoy_page" && (
              <TextField label={t.decoyTitle} value={draft.decoyPageTitle} onChange={(e) => patch({ decoyPageTitle: e.target.value })} dir="auto" />
            )}

            <Field label={t.countries} hint={t.countriesHint}>
              {({ id }) => (
                <ChipsInput
                  id={id}
                  values={draft.blockedCountries}
                  onChange={(v) => patch({ blockedCountries: v })}
                  placeholder="US, IE, SG"
                  transform={(s) => s.toUpperCase().slice(0, 2)}
                />
              )}
            </Field>

            <Field label={t.agents} hint={t.agentsHint}>
              {({ id }) => (
                <ChipsInput id={id} values={draft.blockedUserAgents} onChange={(v) => patch({ blockedUserAgents: v })} placeholder="facebookexternalhit" />
              )}
            </Field>
          </section>

          <div className="sticky bottom-0 z-10 flex justify-end rounded-2xl border border-line bg-paper-raised/95 px-4 py-3 shadow-card backdrop-blur">
            <Button onClick={save} disabled={saving}>
              {saving ? c.saving : c.save}
            </Button>
          </div>
        </div>
      )}
    </DataState>
  );
}
