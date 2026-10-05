import { useState } from "react";
import { Copy, FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@store-builder/ui";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import type { UiFunnel, UiStep } from "./funnelAdapter";
import { genericPagePath, isGenericStep, type GenericPreset } from "./genericPageRules";

/** The funnel map's sidebar list of generic pages (genericPageRules.ts): add, open, copy the link, delete. */

const STRINGS = {
  en: {
    title: "Generic pages",
    hint: "Contact, about, policies — off the map. Link to them from any page.",
    add: "Add page",
    contact: "Contact us",
    about: "About us",
    policies: "Policies",
    blank: "Blank page",
    empty: "No generic pages yet.",
    edit: "Edit page",
    copy: "Copy the link to {name}",
    copied: "Link copied: {path}",
    remove: "Delete {name}",
    unsaved: "Save the funnel to give it a link.",
    contactBody: "Write how customers can reach you: phone, WhatsApp, email and working hours.",
    aboutBody: "Tell your story: who you are, what you sell and why customers trust you.",
    policiesBody: "Write your shipping, returns and privacy policies here.",
    blankBody: "",
  },
  ar: {
    title: "صفحات عامة",
    hint: "تواصل معنا، من نحن، السياسات — برّه الخريطة. اربطها من أي صفحة.",
    add: "إضافة صفحة",
    contact: "تواصل معنا",
    about: "من نحن",
    policies: "السياسات",
    blank: "صفحة فاضية",
    empty: "مفيش صفحات عامة لسه.",
    edit: "تعديل الصفحة",
    copy: "نسخ رابط {name}",
    copied: "اتنسخ الرابط: {path}",
    remove: "حذف {name}",
    unsaved: "احفظ الفانل عشان الصفحة ياخد رابط.",
    contactBody: "اكتب إزاي العملاء يوصلولك: الموبايل، واتساب، الإيميل ومواعيد العمل.",
    aboutBody: "احكي قصتك: إنت مين، بتبيع إيه، وليه العملاء بيثقوا فيك.",
    policiesBody: "اكتب هنا سياسات الشحن والاسترجاع والخصوصية.",
    blankBody: "",
  },
} satisfies Messages;

export function GenericPagesPanel({
  funnel,
  selectedKey,
  onAdd,
  onOpen,
  onDelete,
}: {
  funnel: UiFunnel;
  selectedKey: string | null;
  onAdd: (preset: GenericPreset, name: string, body: string) => void;
  onOpen: (key: string) => void;
  onDelete: (step: UiStep) => void;
}) {
  const t = useT(STRINGS);
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const pages = funnel.steps.filter((s) => isGenericStep(s, funnel.edges));
  const presets: GenericPreset[] = ["contact", "about", "policies", "blank"];

  async function copy(step: UiStep) {
    const path = genericPagePath(funnel, step.key);
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      // Clipboard blocked: the toast still shows the link to copy by hand.
    }
    toast.success(fmt(t.copied, { path }));
  }

  return (
    <div className="border-t border-line">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.title}</span>
        <div className="relative">
          <Button type="button" size="sm" variant="ghost" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            <Plus className="size-3.5" aria-hidden /> {t.add}
          </Button>
          {menuOpen && (
            <ul className="absolute end-0 z-20 mt-1 w-44 rounded-[var(--radius-card)] border border-line bg-paper-raised py-1 shadow-lg">
              {presets.map((preset) => (
                <li key={preset}>
                  <button
                    type="button"
                    className="w-full cursor-pointer px-3 py-1.5 text-start text-sm text-ink hover:bg-paper"
                    onClick={() => {
                      setMenuOpen(false);
                      onAdd(preset, t[preset], t[`${preset}Body` as const]);
                    }}
                  >
                    {t[preset]}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="px-3 pb-2 text-xs text-ink-soft">{t.hint}</p>
      {pages.length === 0 ? (
        <p className="px-3 pb-3 text-xs text-ink-soft">{t.empty}</p>
      ) : (
        <ul className="space-y-1 px-2 pb-2">
          {pages.map((step) => (
            <li
              key={step.key}
              className={`flex items-center gap-1 rounded-[0.5rem] border px-2 py-1.5 ${step.key === selectedKey ? "border-primary bg-primary-soft" : "border-line bg-paper-raised"}`}
            >
              <FileText className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
              <button type="button" className="min-w-0 flex-1 cursor-pointer truncate text-start text-sm text-ink" dir="auto" title={t.edit} onClick={() => onOpen(step.key)}>
                {step.name}
              </button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={fmt(t.copy, { name: step.name })}
                title={step.id ? genericPagePath(funnel, step.key) : t.unsaved}
                onClick={() => void copy(step)}
              >
                <Copy className="size-3.5" aria-hidden />
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label={fmt(t.remove, { name: step.name })} onClick={() => onDelete(step)}>
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
