import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { useLocation } from "react-router-dom";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@store-builder/ui";
import { IconClose } from "@/components/icons";
import { tabRoutesFor } from "@/components/MobileTabBar";
import { SidebarShortcuts } from "@/components/SidebarShortcuts";
import { StoreLinkBar } from "@/components/StoreLinkBar";
import { NavRow, visibleNavItems } from "@/components/shell/SidebarNav";
import { StoreSwitcher } from "@/components/shell/StoreSwitcher";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { NAV_GROUPS, NAV_GROUP_LABELS, NAV_LABELS, findNavItem, sidebarHome } from "@/lib/navigation";
import { useWorkCounts } from "@/lib/workCounts";

const STRINGS = {
  en: {
    title: "Menu",
    closeNav: "Close the menu",
    navLabel: "Main navigation",
  },
  ar: {
    title: "القائمة",
    closeNav: "اقفل القائمة",
    navLabel: "القائمة الرئيسية",
  },
} satisfies Messages;

/** From `md` up the side menu is on screen and this sheet has no business being open. */
const DESKTOP = "(min-width: 48rem)";
/** Pulled down further than this, or flicked down, the sheet lets go. */
const DISMISS_PX = 120;
const FLICK_PX_PER_MS = 0.5;

/**
 * Pulling the sheet down by its top strip. The finger moves the sheet itself
 * (one style write per move, no render); on release it either springs back —
 * the sheet's own transition takes over again — or closes from where it is.
 */
function useDragToDismiss(sheet: RefObject<HTMLDivElement | null>, onDismiss: () => void) {
  const drag = useRef<{ pointer: number; startY: number; lastY: number; lastAt: number; speed: number } | null>(null);

  function release(e: ReactPointerEvent<HTMLDivElement>, dismiss: boolean) {
    const state = drag.current;
    if (!state || state.pointer !== e.pointerId) return;
    drag.current = null;
    const el = sheet.current;
    if (el) {
      el.style.removeProperty("transition");
      el.style.removeProperty("translate");
    }
    const pulled = e.clientY - state.startY;
    if (dismiss && (pulled > DISMISS_PX || (pulled > 24 && state.speed > FLICK_PX_PER_MS))) onDismiss();
  }

  return {
    onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // The close button inside the strip is pressed, not dragged.
      if ((e.target as HTMLElement).closest("button, a")) return;
      drag.current = { pointer: e.pointerId, startY: e.clientY, lastY: e.clientY, lastAt: e.timeStamp, speed: 0 };
      e.currentTarget.setPointerCapture(e.pointerId);
      sheet.current?.style.setProperty("transition", "none");
    },
    onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
      const state = drag.current;
      if (!state || state.pointer !== e.pointerId) return;
      const elapsed = e.timeStamp - state.lastAt;
      if (elapsed > 0) state.speed = (e.clientY - state.lastY) / elapsed;
      state.lastY = e.clientY;
      state.lastAt = e.timeStamp;
      sheet.current?.style.setProperty("translate", `0 ${Math.max(0, e.clientY - state.startY)}px`);
    },
    onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
      release(e, true);
    },
    onPointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
      release(e, false);
    },
  };
}

interface PhoneMenuProps {
  open: boolean;
  onClose: () => void;
}

/**
 * «المزيد» on a phone: the whole menu as a sheet that rises from the bottom,
 * where the thumb that opened it already is. On Base UI's Dialog, so focus is
 * held inside and handed back to the dock; Esc, the close button, a tap on the
 * dimmed page, a pull down on the grab handle and following a link all close
 * it. The sheet is solid — it covers the page, so there is nothing to blur.
 *
 * The dock's own pages are not listed a second time (re-audit N-06), and the
 * groups are always open here: a sheet is opened to see everything at once.
 */
export function PhoneMenu({ open, onClose }: PhoneMenuProps) {
  const sheet = useRef<HTMLDivElement>(null);

  // Rotated or resized onto the desktop layout while open: step aside for the side menu.
  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia(DESKTOP);
    const check = () => {
      if (desktop.matches) onClose();
    };
    check();
    desktop.addEventListener("change", check);
    return () => desktop.removeEventListener("change", check);
  }, [open, onClose]);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="zimos-phone-menu-backdrop fixed inset-0 z-50 bg-black/40 transition-opacity duration-(--dur-move) ease-(--ease-out) data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none md:hidden dark:bg-black/60" />
        <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-end md:hidden">
          <DialogPrimitive.Popup
            ref={sheet}
            data-slot="phone-menu"
            className={cn(
              "zimos-phone-menu relative flex h-[88dvh] w-full flex-col rounded-t-[1.75rem] bg-paper-raised text-ink shadow-[0_-20px_48px_-24px_rgb(20_22_26/0.45)] ring-1 ring-line outline-none",
              // Rises on the house spring. The spring runs a little past its end, so the
              // sheet's fill carries on below the screen edge and no gap opens under it.
              "transition-transform duration-(--dur-move) ease-(--ease-spring) will-change-transform data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full motion-reduce:transition-none",
              "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-24 after:bg-paper-raised"
            )}
          >
            <PhoneMenuBody sheet={sheet} onClose={onClose} />
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Mounted only while the sheet is open, so nothing here runs on a desktop. */
function PhoneMenuBody({ sheet, onClose }: { sheet: RefObject<HTMLDivElement | null>; onClose: () => void }) {
  const { currentWorkspace } = useWorkspace();
  const location = useLocation();
  const t = useT(STRINGS);
  const navLabels = useT(NAV_LABELS);
  const groupLabels = useT(NAV_GROUP_LABELS);
  const counts = useWorkCounts(currentWorkspace?.id);
  const role = currentWorkspace?.role;
  const drag = useDragToDismiss(sheet, onClose);

  const onDock = new Set(tabRoutesFor(role));
  const activeTo = sidebarHome(findNavItem(location.pathname));
  const groups = NAV_GROUPS.map((group) => ({ group, items: visibleNavItems(group, role, onDock) })).filter(({ items }) => items.length > 0);

  return (
    <>
      {/* The strip that is pulled: the grab handle, the title, the close button. */}
      <div {...drag} className="shrink-0 touch-none px-4 pt-2 select-none">
        <span aria-hidden className="zimos-phone-menu-grab mx-auto block h-[5px] w-9 rounded-full bg-line-strong/60" />
        <div className="flex h-12 items-center gap-2">
          <DialogPrimitive.Title className="min-w-0 flex-1 truncate ps-1 font-display text-[17px] font-semibold text-ink">{t.title}</DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label={t.closeNav}
            className="group/close -me-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="zimos-phone-menu-close flex size-[30px] items-center justify-center rounded-full bg-paper-sunken text-ink-soft transition-[color,scale] duration-150 group-hover/close:text-ink group-active/close:scale-90 motion-reduce:transition-none">
              <IconClose weight="bold" className="size-3.5" aria-hidden />
            </span>
          </DialogPrimitive.Close>
        </div>
      </div>

      <div className="shrink-0 px-4 pb-3">
        <StoreSwitcher size="lg" onNavigate={onClose} />
        {currentWorkspace?.slug && <StoreLinkBar slug={currentWorkspace.slug} className="mt-2 px-1" />}
      </div>

      <nav
        aria-label={t.navLabel}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-line px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <SidebarShortcuts variant="sheet" onNavigate={onClose} />
        {groups.map(({ group, items }, index) => {
          const heading = group.labelKey ? groupLabels[group.labelKey] : null;
          const headingId = `zimos-phone-nav-${group.id}`;
          return (
            <div
              key={group.id}
              role="group"
              aria-labelledby={heading ? headingId : undefined}
              // The unheaded last group (apps, settings, support) is set apart by a hairline.
              className={cn("mt-5 first:mt-0", !heading && index > 0 && "border-t border-line pt-5")}
            >
              {heading && (
                <h3 id={headingId} className="flex h-8 items-center ps-1 pb-1 font-sans text-[13px] font-semibold tracking-normal text-ink-soft">
                  {heading}
                </h3>
              )}
              <div className="grid grid-cols-2 gap-2">
                {items.map((item) => (
                  <NavRow
                    key={item.to}
                    item={item}
                    label={navLabels[item.key]}
                    counts={counts}
                    current={item.to === activeTo}
                    variant="sheet"
                    onNavigate={onClose}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </>
  );
}
