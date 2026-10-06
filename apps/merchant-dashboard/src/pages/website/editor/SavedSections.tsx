import { useState } from "react";
import { BookmarkPlus, Link2, Link2Off, Trash2 } from "lucide-react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  SAVED_SECTION_LINK_KEY,
  storeDesignCreateSavedSection,
  storeDesignDeleteSavedSection,
  storeDesignListSavedSections,
  storeDesignUpdateSavedSection,
  type PageSection,
  type SavedSectionDto,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useToast } from "@/components/Toast";
import { useEditorLocale } from "./editorLocale";

/**
 * Saved sections in the website editor (SPEC §9.3 "smart sections").
 *
 * A section can be saved to the store's library. From the library it is
 * inserted either as a plain copy, or linked: a linked section carries
 * `settings.savedSectionId`, and publishing the website fills it from the
 * saved section — so updating the saved section and publishing changes every
 * linked copy. "Detach" removes the link and leaves an ordinary section.
 */

const STRINGS = {
  en: {
    title: "Saved sections",
    empty: "Nothing saved yet. Open a section and save it to use it again on any page.",
    insert: "Insert a copy",
    insertLinked: "Insert linked",
    remove: "Delete from the library",
    saveTitle: "Reuse this section",
    name: "Name for the saved section",
    save: "Save to library",
    saved: "Section saved to the library.",
    linked: "This section is linked to a saved section. Its content is taken from the library when you publish.",
    update: "Update the saved section with this content",
    updated: "Saved section updated. Publish to apply it to every linked copy.",
    detach: "Detach",
    deleted: "Removed from the library.",
    // Funnel-only saved sections (backend savedSections: scope "funnel").
    onlyThisFunnel: "Only in this funnel",
    funnelOnly: "This funnel",
  },
  ar: {
    title: "السكاشن المحفوظة",
    empty: "لا يوجد شيء محفوظ بعد. افتح قسمًا واحفظه لتستخدمه في أي صفحة.",
    insert: "إدراج نسخة",
    insertLinked: "إدراج مرتبط",
    remove: "حذف من المكتبة",
    saveTitle: "إعادة استخدام هذا القسم",
    name: "اسم القسم المحفوظ",
    save: "حفظ في المكتبة",
    saved: "تم حفظ القسم في المكتبة.",
    linked: "هذا القسم مرتبط بقسم محفوظ. محتواه يؤخذ من المكتبة عند النشر.",
    update: "تحديث القسم المحفوظ بهذا المحتوى",
    updated: "تم تحديث القسم المحفوظ. انشر الموقع لتطبيقه على كل النسخ المرتبطة.",
    detach: "فصل",
    deleted: "تم الحذف من المكتبة.",
    onlyThisFunnel: "في مسار البيع ده فقط",
    funnelOnly: "مسار البيع ده",
  },
} as const;

const uid = () => Math.random().toString(36).slice(2, 10);

/** A fresh copy of a saved section: new ids throughout, so two copies never clash on a page. */
export function instantiateSavedSection(saved: SavedSectionDto, linked: boolean): PageSection {
  const stamp = uid();
  const renamed = JSON.parse(JSON.stringify(saved.tree)) as PageSection;
  const bump = (node: { id?: string }) => {
    node.id = `${typeof node.id === "string" && node.id ? node.id : "n"}-${stamp}`;
  };
  bump(renamed);
  for (const row of renamed.rows ?? []) {
    bump(row);
    for (const column of row.columns ?? []) {
      bump(column);
      for (const element of column.elements ?? []) bump(element);
    }
  }
  const settings = { ...(renamed.settings ?? {}) } as Record<string, unknown>;
  if (linked) settings[SAVED_SECTION_LINK_KEY] = saved.id;
  else delete settings[SAVED_SECTION_LINK_KEY];
  return { ...renamed, settings };
}

export function linkedSavedSectionId(section: PageSection): string | null {
  const value = (section.settings as Record<string, unknown> | undefined)?.[SAVED_SECTION_LINK_KEY];
  return typeof value === "string" && value ? value : null;
}

/** The section without its link — what gets stored in the library and what "detach" leaves. */
function withoutLink(section: PageSection): PageSection {
  const settings = { ...(section.settings ?? {}) } as Record<string, unknown>;
  delete settings[SAVED_SECTION_LINK_KEY];
  const { settings: _old, ...bare } = section;
  void _old;
  return Object.keys(settings).length > 0 ? { ...bare, settings } : bare;
}

/**
 * The library list, shown above the block library: insert a copy or a linked
 * copy. In a funnel's editor (`funnelId`) it adds that funnel's own sections.
 */
export function SavedSectionsLibrary({ onInsert, funnelId }: { onInsert: (section: PageSection) => void; funnelId?: string }) {
  const locale = useEditorLocale();
  const t = STRINGS[locale];
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const state = useAsync(() => storeDesignListSavedSections(apiClient, workspaceId, funnelId), [workspaceId, funnelId]);
  const [open, setOpen] = useState(false);
  const list = state.data ?? [];

  return (
    <div className="border-b border-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void state.refresh({ silent: true });
        }}
        className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-start text-sm font-medium text-ink hover:bg-paper"
      >
        <span>
          {t.title}
          {list.length > 0 && <span className="ms-1.5 text-xs font-normal text-ink-soft">({list.length})</span>}
        </span>
        <BookmarkPlus className="size-4 text-ink-soft" aria-hidden />
      </button>
      {open && (
        <div className="space-y-2 px-4 pb-3">
          {list.length === 0 ? (
            <p className="text-xs text-ink-soft">{t.empty}</p>
          ) : (
            list.map((saved) => (
              <div key={saved.id} className="rounded-[0.5rem] border border-line p-2">
                <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <span className="truncate">{saved.name}</span>
                  {saved.scope === "funnel" && (
                    <span className="shrink-0 rounded-full bg-primary-soft px-1.5 py-0.5 text-[0.65rem] font-medium text-primary">{t.funnelOnly}</span>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button type="button" size="sm" variant="outline" onClick={() => onInsert(instantiateSavedSection(saved, false))}>
                    {t.insert}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => onInsert(instantiateSavedSection(saved, true))}>
                    <Link2 className="size-3.5" aria-hidden />
                    {t.insertLinked}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`${t.remove} — ${saved.name}`}
                    title={t.remove}
                    onClick={async () => {
                      try {
                        await storeDesignDeleteSavedSection(apiClient, workspaceId, saved.id);
                        toast.success(t.deleted);
                        await state.refresh({ silent: true });
                      } catch (err) {
                        toast.error(errorMessage(err));
                      }
                    }}
                  >
                    <Trash2 className="size-4 text-danger" aria-hidden />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * In the section inspector: save this section, or manage its link to a saved
 * one. In a funnel's editor (`funnelId`) it may be kept for that funnel only.
 */
export function SaveSectionPanel({ section, onChange, funnelId }: { section: PageSection; onChange: (next: PageSection) => void; funnelId?: string }) {
  const locale = useEditorLocale();
  const t = STRINGS[locale];
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [funnelOnly, setFunnelOnly] = useState(false);
  const linkId = linkedSavedSectionId(section);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (linkId) {
    return (
      <div className="space-y-2 border-t border-line px-4 py-3">
        <Alert>{t.linked}</Alert>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await storeDesignUpdateSavedSection(apiClient, workspaceId, linkId, { section: withoutLink(section) });
                toast.success(t.updated);
              })
            }
          >
            {t.update}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onChange(withoutLink(section))}>
            <Link2Off className="size-4" aria-hidden />
            {t.detach}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-line px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{t.saveTitle}</p>
      <div className="flex items-center gap-2">
        <Input aria-label={t.name} placeholder={t.name} maxLength={120} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
        <Button
          type="button"
          size="sm"
          disabled={busy || !name.trim()}
          onClick={() =>
            void run(async () => {
              await storeDesignCreateSavedSection(apiClient, workspaceId, {
                name: name.trim(),
                section: withoutLink(section),
                ...(funnelId && funnelOnly ? { scope: "funnel" as const, funnelId } : {}),
              });
              setName("");
              toast.success(t.saved);
            })
          }
        >
          {t.save}
        </Button>
      </div>
      {funnelId && (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
          <input type="checkbox" checked={funnelOnly} disabled={busy} onChange={(e) => setFunnelOnly(e.target.checked)} />
          {t.onlyThisFunnel}
        </label>
      )}
    </div>
  );
}
