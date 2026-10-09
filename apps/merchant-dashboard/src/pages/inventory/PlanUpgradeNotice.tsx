import { Link } from "react-router-dom";
import { IconInventory } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@store-builder/ui";
import { useWorkspace } from "@/context/WorkspaceContext";
import { canSeeBilling } from "@/lib/inventoryAccess";
import { useT } from "@/i18n/LocaleContext";
import { INVENTORY_STRINGS } from "./inventoryStrings";

/**
 * Shown where a second stock location would be added on a plan without
 * `multi_warehouse` (handoff 206): says why, and sends whoever may change the
 * plan to Settings → Plan & billing — the same destination as the access
 * banner's billing link. Other roles are told to ask the owner.
 */
export function PlanUpgradeNotice({ className }: { className?: string }) {
  const t = useT(INVENTORY_STRINGS);
  const { currentWorkspace } = useWorkspace();
  const billing = canSeeBilling(currentWorkspace?.role);
  return (
    <Alert className={className}>
      <IconInventory aria-hidden />
      <AlertTitle>{t.upgradeTitle}</AlertTitle>
      <AlertDescription>
        {t.upgradeBody}{" "}
        {billing ? (
          <Link to="/settings?tab=billing" className="inline-flex min-h-11 items-center font-medium text-primary sm:min-h-0">
            {t.upgradeLink}
          </Link>
        ) : (
          t.upgradeAskOwner
        )}
      </AlertDescription>
    </Alert>
  );
}
