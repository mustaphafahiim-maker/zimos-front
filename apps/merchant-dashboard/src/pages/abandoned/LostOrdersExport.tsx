import { useState } from "react";
import { sheetFileLostOrdersExport, type LostOrderFilters, type SheetFileFormat } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { pluralOf } from "@/lib/plural";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    exported_zero: "Nothing to export: no lost order matches these filters.",
    exported_one: "{n} lost order exported.",
    exported_two: "{n} lost orders exported.",
    exported_few: "{n} lost orders exported.",
    exported_many: "{n} lost orders exported.",
    exported_other: "{n} lost orders exported.",
  },
  ar: {
    exported_zero: "مفيش حاجة تتصدّر: مفيش أوردر مفقود مطابق للفلاتر دي.",
    exported_one: "اتصدّر أوردر مفقود واحد.",
    exported_two: "اتصدّر أوردرين مفقودين.",
    exported_few: "اتصدّر {n} أوردرات مفقودة.",
    exported_many: "اتصدّر {n} أوردر مفقود.",
    exported_other: "اتصدّر {n} أوردر مفقود.",
  },
} satisfies Messages;

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * The lost orders export (handoff item 260): the list as it is filtered now,
 * as an Excel workbook or as CSV. Both hold the same columns and mask phones
 * the same way; the server names the file. The two choices live in the
 * header's «أدوات» menu (LostOrdersTools.tsx); this is what they run.
 */
export function useLostOrdersExport(filters: LostOrderFilters): { busy: boolean; run: (format: SheetFileFormat) => Promise<void> } {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);

  async function run(format: SheetFileFormat) {
    if (busy) return;
    setBusy(true);
    try {
      const file = await sheetFileLostOrdersExport(apiClient, workspaceId, filters, format);
      saveBlob(file.blob, file.filename);
      toast.success(file.count === 0 ? t.exported_zero : pluralOf(t, "exported", file.count));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return { busy, run };
}
