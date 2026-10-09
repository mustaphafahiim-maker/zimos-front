import { useState } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@store-builder/ui";
import { IconMoreActions, IconRefresh, IconSheet, IconSpinner, IconUpload } from "@/components/icons";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { canManageProducts } from "@/lib/productAccess";
import { useViewNavigate } from "@/lib/viewTransition";
import { ProductTransferDialog } from "../components/ProductTransferDialog";
import { useProductToolLinks } from "../ProductToolLinks";
import { SHEET_UPDATE_STRINGS } from "../sheetUpdate/sheetUpdateStrings";

const STRINGS = {
  en: {
    tools: "Tools",
    transfer: "Import / export",
    refresh: "Refresh",
  },
  ar: {
    tools: "أدوات",
    transfer: "استيراد / تصدير",
    refresh: "تحديث",
  },
} satisfies Messages;

/** A menu line: 36px with a mouse, 44px under a finger; rounded to sit inside the menu's own corners. */
const ITEM = "min-h-9 cursor-pointer gap-2.5 rounded-[0.625rem] px-2.5 pointer-coarse:min-h-11";
const GLYPH = "size-[18px] text-ink-soft";

/**
 * The products list's «أدوات» menu, at the end of the page header: what is
 * used now and then, one tap away instead of on the page — import / export
 * (the transfer dialog: from a file, from a product link, the export), the
 * bulk update from a sheet (handoff 243; not offered to a role known to lack
 * products.manage, as before), the screens that live under Products
 * (collections, specifications, size charts, search synonyms), and Refresh.
 *
 * The dialog it opens lives here beside the menu, not inside it, so it stays
 * up after the menu has closed.
 */
export function CatalogHeaderTools({
  onRefresh,
  refreshing = false,
  onImported,
}: {
  onRefresh: () => void;
  /** The list is being read again: the button shows it. */
  refreshing?: boolean;
  /** An import changed the store's products. */
  onImported: () => void;
}) {
  const t = useT(STRINGS);
  const sheet = useT(SHEET_UPDATE_STRINGS);
  const { dir } = useLocale();
  const { currentWorkspace } = useWorkspace();
  const navigate = useViewNavigate();
  const links = useProductToolLinks();
  const [transferOpen, setTransferOpen] = useState(false);

  return (
    <>
      <DirectionProvider direction={dir}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                aria-label={t.tools}
                title={t.tools}
                aria-busy={refreshing || undefined}
                className="size-11 rounded-full p-0 md:w-auto md:gap-2 md:ps-3.5 md:pe-4"
              />
            }
          >
            {refreshing ? (
              <IconSpinner className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <IconMoreActions className="size-5" aria-hidden />
            )}
            <span className="hidden md:inline">{t.tools}</span>
          </DropdownMenuTrigger>
          {/* The button is the last thing in the header: the menu hangs from the end of it. */}
          <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-auto min-w-60 rounded-[1.125rem] p-1.5">
            <DropdownMenuItem onClick={() => setTransferOpen(true)} className={ITEM}>
              <IconUpload className={GLYPH} aria-hidden />
              {t.transfer}
            </DropdownMenuItem>
            {/* Stock and prices of many products from one sheet (handoff 243). */}
            {canManageProducts(currentWorkspace?.role) && (
              <DropdownMenuItem onClick={() => navigate("/catalog/bulk-update")} className={ITEM}>
                <IconSheet className={GLYPH} aria-hidden />
                {sheet.link}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="mx-1.5" />
            {links.map((link) => {
              const LinkIcon = link.icon;
              return (
                <DropdownMenuItem key={link.id} onClick={() => navigate(link.to)} className={ITEM}>
                  <LinkIcon className={GLYPH} aria-hidden />
                  {link.label}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator className="mx-1.5" />
            <DropdownMenuItem onClick={onRefresh} className={ITEM}>
              <IconRefresh className={GLYPH} aria-hidden />
              {t.refresh}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </DirectionProvider>

      {transferOpen && <ProductTransferDialog onClose={() => setTransferOpen(false)} onImported={onImported} />}
    </>
  );
}
