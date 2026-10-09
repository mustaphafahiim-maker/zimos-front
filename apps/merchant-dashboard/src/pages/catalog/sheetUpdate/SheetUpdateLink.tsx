import { Link } from "react-router-dom";
import { IconSheet } from "@/components/icons";
import { Button } from "@store-builder/ui";
import { useWorkspace } from "@/context/WorkspaceContext";
import { canManageProducts } from "@/lib/productAccess";
import { useT } from "@/i18n/LocaleContext";
import { SHEET_UPDATE_STRINGS } from "./sheetUpdateStrings";

/**
 * The Products page's way into «تحديث جماعي من شيت» (handoff 243). Not shown
 * to a role known to lack products.manage, which the update needs.
 */
export function SheetUpdateLink() {
  const t = useT(SHEET_UPDATE_STRINGS);
  const { currentWorkspace } = useWorkspace();
  if (!canManageProducts(currentWorkspace?.role)) return null;
  return (
    <Button asChild variant="outline">
      <Link to="/catalog/bulk-update">
        <IconSheet className="size-4" aria-hidden />
        {t.link}
      </Link>
    </Button>
  );
}
