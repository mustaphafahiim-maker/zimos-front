import { useState } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@store-builder/ui";
import { contactsExportCsv, type ContactFilter } from "@store-builder/api-client";
import { IconDownload, IconMoreActions, IconSpinner, IconTray, IconUpload, IconUserAdd } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { pluralOf } from "@/lib/plural";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useViewNavigate } from "@/lib/viewTransition";

const STRINGS = {
  en: {
    tools: "Tools",
    add: "Add contact",
    import: "Import contacts",
    forms: "Form submissions",
    export: "Export CSV",
    exportHint: "The list as it is filtered now",
    exported: "{count} exported.",
    contacts_one: "1 contact",
    contacts_other: "{n} contacts",
  },
  ar: {
    tools: "أدوات",
    add: "إضافة جهة اتصال",
    import: "استيراد العملاء",
    forms: "رسائل النماذج",
    export: "تصدير CSV",
    exportHint: "القائمة بالفلاتر اللي عليها دلوقتي",
    exported: "اتصدّرت {count}.",
    contacts_one: "جهة اتصال واحدة",
    contacts_two: "جهتين اتصال",
    contacts_few: "{n} جهات اتصال",
    contacts_other: "{n} جهة اتصال",
  },
} satisfies Messages;

/** A menu line: 36px with a mouse, 44px under a finger; rounded to sit inside the menu's own corners. */
const ITEM = "min-h-9 cursor-pointer gap-2.5 rounded-[0.625rem] px-2.5 pointer-coarse:min-h-11";
const GLYPH = "size-[18px] shrink-0 text-ink-soft";

function downloadCsv(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The contacts page's «أدوات» menu, at the end of the header: what is reached
 * for now and then, one tap away instead of on the page — importing a sheet,
 * the form submissions inbox, and the CSV export of the list as it is filtered
 * (at most 10,000 rows; it needs the role that may see whole phone numbers,
 * and the server says so when it is missing). On a tab whose main action is
 * not «إضافة جهة اتصال», that one is here too.
 */
export function ContactsHeaderTools({
  exportFilter,
  onAdd,
}: {
  /** The list's filter; null where there is no contacts list to export (another tab, an RFM group). */
  exportFilter: ContactFilter | null;
  /** Given where «إضافة جهة اتصال» is not already the page's main button. */
  onAdd?: () => void;
}) {
  const t = useT(STRINGS);
  const { dir } = useLocale();
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [exporting, setExporting] = useState(false);

  async function exportCsv() {
    if (!exportFilter || exporting) return;
    setExporting(true);
    try {
      const text = await contactsExportCsv(apiClient, workspaceId, exportFilter);
      downloadCsv(text, `contacts-${new Date().toISOString().slice(0, 10)}.csv`);
      const rows = Math.max(0, text.trim().split(/\r?\n/).length - 1);
      toast.success(fmt(t.exported, { count: pluralOf(t, "contacts", rows) }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <DirectionProvider direction={dir}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              aria-label={t.tools}
              title={t.tools}
              aria-busy={exporting || undefined}
              className="size-11 rounded-full p-0 md:w-auto md:gap-2 md:ps-3.5 md:pe-4"
            />
          }
        >
          {exporting ? (
            <IconSpinner className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <IconMoreActions className="size-5" aria-hidden />
          )}
          <span className="hidden md:inline">{t.tools}</span>
        </DropdownMenuTrigger>
        {/* The button is the last thing in the header: the menu hangs from the end of it. */}
        <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-auto min-w-60 rounded-[1.125rem] p-1.5">
          {onAdd && (
            <>
              <DropdownMenuItem onClick={onAdd} className={ITEM}>
                <IconUserAdd className={GLYPH} aria-hidden />
                {t.add}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mx-1.5" />
            </>
          )}
          <DropdownMenuItem onClick={() => navigate("/customers/import")} className={ITEM}>
            <IconUpload className={GLYPH} aria-hidden />
            {t.import}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/form-submissions")} className={ITEM}>
            <IconTray className={GLYPH} aria-hidden />
            {t.forms}
          </DropdownMenuItem>
          {exportFilter && (
            <>
              <DropdownMenuSeparator className="mx-1.5" />
              <DropdownMenuItem onClick={() => void exportCsv()} className={ITEM}>
                <IconDownload className={GLYPH} aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span>{t.export}</span>
                  <span className="text-xs leading-4 text-ink-soft">{t.exportHint}</span>
                </span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </DirectionProvider>
  );
}
