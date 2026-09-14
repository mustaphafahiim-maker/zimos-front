import { ConfirmDialog as SharedConfirmDialog, type ConfirmDialogProps } from "@store-builder/ui";
import { getErrorMessage } from "@/lib/errors";
import { useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { cancel: "Cancel", confirm: "Confirm", working: "Working…", close: "Close" },
  ar: { cancel: "إلغاء", confirm: "تأكيد", working: "جارٍ التنفيذ…", close: "إغلاق" },
};

/** Shared ConfirmDialog bound to the dashboard's strings and API error messages. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const t = useT(STRINGS);
  return <SharedConfirmDialog labels={t} getErrorMessage={(err) => getErrorMessage(err)} {...props} />;
}
