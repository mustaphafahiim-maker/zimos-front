import { ConfirmDialog as SharedConfirmDialog, type ConfirmDialogProps } from "@store-builder/ui";
import { getErrorMessage } from "@/lib/errors";

/** Shared ConfirmDialog bound to the admin API error messages. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  return <SharedConfirmDialog getErrorMessage={(err) => getErrorMessage(err)} {...props} />;
}
