import { ConfirmDialog as SharedConfirmDialog, type ConfirmDialogProps } from "@store-builder/ui";
import { getErrorMessage } from "@/lib/errors";
import { useCommon } from "@/i18n/LocaleContext";

/** Shared ConfirmDialog bound to the admin API error messages and bilingual labels. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const c = useCommon();
  return (
    <SharedConfirmDialog
      getErrorMessage={(err) => getErrorMessage(err)}
      labels={{ cancel: c.cancel, confirm: c.confirm, working: c.working, close: c.close }}
      {...props}
    />
  );
}
