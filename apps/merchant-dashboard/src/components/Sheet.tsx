import {
  createContext,
  useContext,
  useRef,
  type ComponentProps,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@store-builder/ui";
import { IconClose } from "@/components/icons";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { close: "Close" },
  ar: { close: "إغلاق" },
} satisfies Messages;

export type SheetSize = "sm" | "md" | "lg";
/**
 * Where the sheet sits.
 *  - `auto`     a bottom sheet under 640px, a centred dialog from 640px;
 *  - `bottom`   a bottom sheet at every width;
 *  - `center`   a centred dialog at every width;
 *  - `end`      a panel on the end edge (inspectors, the Notification Centre);
 *  - `auto-end` a bottom sheet under 640px, the end panel from 640px (Quick Look).
 */
export type SheetSide = "auto" | "bottom" | "center" | "end" | "auto-end";

/** When a side is a bottom sheet: that is when it has the grab handle and can be dragged away. */
type BottomWhen = "always" | "phone" | "never";
const BOTTOM: Record<SheetSide, BottomWhen> = {
  auto: "phone",
  bottom: "always",
  center: "never",
  end: "never",
  "auto-end": "phone",
};

/** Where the popup is placed in the screen-sized viewport. */
const VIEWPORT: Record<SheetSide, string> = {
  auto: "items-end justify-center sm:items-center sm:p-4",
  bottom: "items-end justify-center",
  center: "items-center justify-center p-4",
  end: "items-stretch justify-end px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]",
  "auto-end": "items-end justify-center sm:items-stretch sm:justify-end sm:p-3",
};

/*
 * The popup's box per side, and where it comes from: --sheet-x / --sheet-y are
 * the offset it enters from and leaves to, --sheet-scale and --sheet-fade the
 * scale and opacity it has there. A bottom sheet rises opaque from below the
 * screen; a centred dialog swells in from 96%; the end panel slides in from
 * the end edge (mirrored in RTL).
 */
const SURFACE: Record<SheetSide, string> = {
  auto: "w-full max-h-[92dvh] rounded-t-[1.75rem] [--sheet-y:100%] sm:max-h-[min(85dvh,46rem)] sm:rounded-[1.75rem] sm:[--sheet-y:0.75rem] sm:[--sheet-scale:0.96] sm:[--sheet-fade:0]",
  bottom: "w-full max-h-[92dvh] rounded-t-[1.75rem] [--sheet-y:100%]",
  center: "w-full max-h-[min(85dvh,46rem)] rounded-[1.75rem] [--sheet-y:0.75rem] [--sheet-scale:0.96] [--sheet-fade:0]",
  end: "h-full w-[min(28rem,calc(100vw_-_1.5rem))] rounded-[1.75rem] [--sheet-x:calc(100%_+_0.75rem)] rtl:[--sheet-x:calc(-100%_-_0.75rem)]",
  "auto-end":
    "w-full max-h-[92dvh] rounded-t-[1.75rem] [--sheet-y:100%] sm:h-full sm:max-h-none sm:w-[min(28rem,calc(100vw_-_1.5rem))] sm:rounded-[1.75rem] sm:[--sheet-y:0px] sm:[--sheet-x:calc(100%_+_0.75rem)] sm:rtl:[--sheet-x:calc(-100%_-_0.75rem)]",
};

/** Width by size: a bottom sheet is full width on the phone, a centred dialog is capped everywhere. */
const WIDTH_FROM_SM: Record<SheetSize, string> = {
  sm: "sm:max-w-[26rem]",
  md: "sm:max-w-[34rem]",
  lg: "sm:max-w-[46rem]",
};
const WIDTH_ALWAYS: Record<SheetSize, string> = {
  sm: "max-w-[26rem]",
  md: "max-w-[34rem]",
  lg: "max-w-[46rem]",
};

/*
 * Motion: translate, scale and opacity only, on the house spring. Base UI sets
 * data-starting-style for the first frame and data-ending-style while it
 * leaves; in between the popup is simply at rest.
 */
const MOTION =
  "transition-[translate,scale,opacity] duration-[var(--dur-move)] ease-[var(--ease-spring)] motion-reduce:transition-none " +
  "data-[starting-style]:[translate:var(--sheet-x,0px)_var(--sheet-y,0px)] data-[ending-style]:[translate:var(--sheet-x,0px)_var(--sheet-y,0px)] " +
  "data-[starting-style]:[scale:var(--sheet-scale,1)] data-[ending-style]:[scale:var(--sheet-scale,1)] " +
  "data-[starting-style]:[opacity:var(--sheet-fade,1)] data-[ending-style]:[opacity:var(--sheet-fade,1)]";

/*
 * The spring carries a bottom sheet a few pixels past its resting place before
 * it settles. This tail of the same colour hangs under it, off screen, so the
 * dimmed page never shows through the gap.
 */
const TAIL_ALWAYS = "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-24 after:bg-inherit";
const TAIL_PHONE =
  "max-sm:after:pointer-events-none max-sm:after:absolute max-sm:after:inset-x-0 max-sm:after:top-full max-sm:after:h-24 max-sm:after:bg-inherit";

/** A drag never starts on something that is pressed. */
const NO_DRAG = "button, a, input, select, textarea, [role='button'], [data-no-drag]";
/** Dragged this far down (or 40% of a short sheet), the sheet closes on release. */
const DISMISS_DISTANCE = 120;
/** Or flicked down faster than this, in px per ms. */
const FLICK_VELOCITY = 0.5;

/** The first thing to type in, for a sheet that opens on a form. */
const FIRST_FIELD =
  '[data-slot="sheet-body"] :is(input:not([type="hidden"], [type="checkbox"], [type="radio"], [type="file"], [type="range"], [type="color"], [type="button"], [type="submit"], [type="reset"], :disabled, [readonly]), textarea:not(:disabled, [readonly]), select:not(:disabled))';

type GripEvent = ReactPointerEvent<HTMLDivElement>;
interface Grip {
  onPointerDown: (e: GripEvent) => void;
  onPointerMove: (e: GripEvent) => void;
  onPointerUp: (e: GripEvent) => void;
  onPointerCancel: (e: GripEvent) => void;
}
interface Drag {
  id: number;
  startY: number;
  lastY: number;
  lastT: number;
  velocity: number;
  offset: number;
}

interface SheetContextValue {
  side: SheetSide;
  grip: Grip;
}
const SheetContext = createContext<SheetContextValue | null>(null);

function isBottomSheetNow(side: SheetSide): boolean {
  const when = BOTTOM[side];
  if (when === "always") return true;
  if (when === "never") return false;
  return !window.matchMedia("(min-width: 40rem)").matches;
}

function shown(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false && node !== "";
}

export interface SheetFrameProps {
  open: boolean;
  /** Called with `false` by Escape, a tap on the dimmed page, the close button and a drag down. */
  onOpenChange: (open: boolean) => void;
  side?: SheetSide;
  /** Width from 640px. Leave out to set the width yourself through `className` (Modal does). */
  size?: SheetSize;
  /** On a mouse or keyboard open, start in the first field of the body instead of on the close button. */
  focusField?: boolean;
  className?: string;
  /** Passed to the popup: typing listeners, a key handler, where focus starts and returns. */
  popupProps?: Pick<DialogPrimitive.Popup.Props, "onInput" | "onChange" | "onKeyDown" | "initialFocus" | "finalFocus">;
  children: ReactNode;
}

/**
 * The surface every overlay shares: the dimmed page, the pane, its spring and
 * the drag-to-dismiss of a phone bottom sheet. `Sheet` is this plus a header,
 * a scrolling body and a pinned footer; Modal and Quick Look put their own
 * parts in the same frame. Built on Base UI's Dialog, so focus is trapped
 * inside and goes back to what opened it.
 */
export function SheetFrame({
  open,
  onOpenChange,
  side = "auto",
  size,
  focusField = false,
  className,
  popupProps,
  children,
}: SheetFrameProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  function settle(e: GripEvent, cancelled: boolean) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);

    const popup = popupRef.current;
    const backdrop = backdropRef.current;
    const height = popup?.offsetHeight ?? 0;
    const far = d.offset > (height > 0 ? Math.min(DISMISS_DISTANCE, height * 0.4) : DISMISS_DISTANCE);
    // A finger that stopped before lifting did not flick.
    const flicked = e.timeStamp - d.lastT < 80 && d.velocity > FLICK_VELOCITY && d.offset > 8;

    // Hand the pane back to its CSS: from where the finger left it, it either
    // springs home or — if this closes it — carries on down and out.
    if (popup) {
      popup.style.transition = "";
      popup.style.translate = "";
    }
    if (backdrop) {
      backdrop.style.transition = "";
      backdrop.style.opacity = "";
    }
    if (!cancelled && (far || flicked)) onOpenChange(false);
  }

  const grip: Grip = {
    onPointerDown(e) {
      if (drag.current || !isBottomSheetNow(side)) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target instanceof Element && e.target.closest(NO_DRAG)) return;
      drag.current = { id: e.pointerId, startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, velocity: 0, offset: 0 };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove(e) {
      const d = drag.current;
      const popup = popupRef.current;
      if (!d || d.id !== e.pointerId || !popup) return;
      const dt = e.timeStamp - d.lastT;
      if (dt > 0) {
        d.velocity = d.velocity * 0.4 + ((e.clientY - d.lastY) / dt) * 0.6;
        d.lastY = e.clientY;
        d.lastT = e.timeStamp;
      }
      // The sheet follows the finger down, never up past its resting place.
      d.offset = Math.max(0, e.clientY - d.startY);
      popup.style.transition = "none";
      popup.style.translate = `0 ${d.offset}px`;
      const backdrop = backdropRef.current;
      if (backdrop) {
        backdrop.style.transition = "none";
        backdrop.style.opacity = String(1 - Math.min(1, d.offset / (popup.offsetHeight || 1)) * 0.6);
      }
    },
    onPointerUp(e) {
      settle(e, false);
    },
    onPointerCancel(e) {
      settle(e, true);
    },
  };

  const initialFocus: DialogPrimitive.Popup.Props["initialFocus"] = focusField
    ? (openType) => {
        // By touch, focus the pane itself: a field would raise the keyboard over the sheet.
        if (openType === "touch") return popupRef.current;
        return popupRef.current?.querySelector<HTMLElement>(FIRST_FIELD) ?? true;
      }
    : popupProps?.initialFocus;

  const bottom = BOTTOM[side];
  const width =
    size === undefined || side === "end" || side === "auto-end"
      ? undefined
      : side === "center"
        ? WIDTH_ALWAYS[size]
        : WIDTH_FROM_SM[size];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          ref={backdropRef}
          forceRender
          data-slot="sheet-backdrop"
          className="fixed inset-0 z-40 bg-ink/32 transition-opacity duration-[var(--dur-fade)] ease-[var(--ease-out)] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none dark:bg-black/55"
        />
        {/* overflow: clip, not hidden — a hidden box can still be scrolled by the browser when focus lands on a
            field while the sheet is rising, which left the sheet shifted up with a gap under it. */}
        <DialogPrimitive.Viewport className={cn("fixed inset-0 z-40 flex overflow-clip", VIEWPORT[side])}>
          <DialogPrimitive.Popup
            ref={popupRef}
            data-slot="sheet"
            data-side={side}
            data-size={size}
            onInput={popupProps?.onInput}
            onChange={popupProps?.onChange}
            onKeyDown={popupProps?.onKeyDown}
            initialFocus={initialFocus}
            finalFocus={popupProps?.finalFocus}
            className={cn(
              "relative flex min-h-0 flex-col bg-paper-raised text-ink shadow-[var(--shadow-pop)] ring-1 ring-line outline-none",
              SURFACE[side],
              width,
              MOTION,
              bottom === "always" && TAIL_ALWAYS,
              bottom === "phone" && TAIL_PHONE,
              className
            )}
          >
            <SheetContext.Provider value={{ side, grip }}>{children}</SheetContext.Provider>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export interface SheetHeaderProps {
  title: ReactNode;
  /** A line under the title. */
  description?: ReactNode;
  /** Beside the title, on its line (Quick Look: the customer of an order). */
  subtitle?: ReactNode;
  /** After them on the same line (Quick Look: the status chip). */
  status?: ReactNode;
  className?: string;
}

/**
 * The top of a sheet: the grab handle of a bottom sheet, the title, and a
 * round close button at the end. On a bottom sheet the whole strip is the
 * drag zone — pull it down and the sheet follows the finger.
 */
export function SheetHeader({ title, description, subtitle, status, className }: SheetHeaderProps) {
  const t = useT(STRINGS);
  const ctx = useContext(SheetContext);
  const bottom: BottomWhen = ctx ? BOTTOM[ctx.side] : "never";

  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "relative flex shrink-0 items-start gap-2 ps-5 pe-3 pt-3 pb-2.5",
        bottom === "always" && "touch-none pt-5 select-none",
        bottom === "phone" && "touch-none max-sm:pt-5 max-sm:select-none",
        className
      )}
      {...(bottom === "never" ? undefined : ctx?.grip)}
    >
      {bottom !== "never" && (
        <span
          aria-hidden
          data-slot="sheet-handle"
          className={cn(
            "pointer-events-none absolute inset-x-0 top-2 mx-auto h-[5px] w-9 rounded-full bg-line-strong/60",
            bottom === "phone" && "sm:hidden"
          )}
        />
      )}
      <div className="min-w-0 flex-1 py-2.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <DialogPrimitive.Title
            data-slot="sheet-title"
            className="min-w-0 font-display text-[17px] leading-6 font-semibold break-words text-ink"
          >
            {title}
          </DialogPrimitive.Title>
          {shown(subtitle) && (
            <span data-slot="sheet-subtitle" className="max-w-full min-w-0 truncate text-sm leading-6 text-ink-soft">
              {subtitle}
            </span>
          )}
          {shown(status) && <span className="flex shrink-0 items-center">{status}</span>}
        </div>
        {shown(description) && (
          <DialogPrimitive.Description data-slot="sheet-description" className="mt-0.5 text-sm leading-5 text-ink-soft">
            {description}
          </DialogPrimitive.Description>
        )}
      </div>
      <DialogPrimitive.Close
        data-slot="sheet-close"
        aria-label={t.close}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ink/6 text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
      >
        <IconClose className="size-4" aria-hidden />
      </DialogPrimitive.Close>
    </div>
  );
}

/**
 * The part that scrolls; the page behind never scrolls with it. Its two
 * hairlines separate it from the header and the footer. With nothing in it (a
 * plain confirmation) it is not drawn at all.
 */
export function SheetBody({ className, ...props }: ComponentProps<"div">) {
  const ctx = useContext(SheetContext);
  const bottom: BottomWhen = ctx ? BOTTOM[ctx.side] : "never";
  return (
    <div
      data-slot="sheet-body"
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain border-y border-line px-5 py-4 last:rounded-b-[inherit] last:border-b-0",
        // A dialog with nothing to say beyond its title is just title and actions; the end panel keeps its height.
        ctx?.side !== "end" && ctx?.side !== "auto-end" && "empty:hidden",
        // With no footer under it, a bottom sheet's last line stays clear of the home indicator.
        bottom === "always" && "last:pb-[max(1rem,env(safe-area-inset-bottom))]",
        bottom === "phone" && "max-sm:last:pb-[max(1rem,env(safe-area-inset-bottom))]",
        className
      )}
      {...props}
    />
  );
}

/**
 * Pinned under the body: actions at the end on a desktop; on the phone each
 * one is a full-width row, the main action (the last one given) on top, clear
 * of the home indicator.
 */
export function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  const ctx = useContext(SheetContext);
  const bottom: BottomWhen = ctx ? BOTTOM[ctx.side] : "never";
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 px-5 pt-3 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3",
        // Its buttons share one comfortable height: 40px with a pointer, 44px rows on the phone.
        "*:data-[slot=button]:min-h-10 max-sm:*:data-[slot=button]:min-h-11",
        bottom === "always" && "pb-[max(1rem,env(safe-area-inset-bottom))]",
        bottom === "phone" && "max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]",
        className
      )}
      {...props}
    />
  );
}

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** The actions, pinned under the body. Give the main one last. */
  footer?: ReactNode;
  /** Width from 640px: sm 26rem, md 34rem, lg 46rem. The end panel has its own. */
  size?: SheetSize;
  side?: SheetSide;
  className?: string;
  children?: ReactNode;
}

/**
 * A sheet: create, edit and filter open in one and never leave the list
 * underneath (docs/ux/REDESIGN_PROMPT.md §2.3). On the phone it rises from the
 * bottom with a grab handle and can be pulled down to dismiss; from 640px it
 * is a centred dialog, or with `side="end"` a panel on the end edge. Escape,
 * a tap on the dimmed page and the close button close it; the body scrolls
 * and the footer stays put.
 *
 * For an unusual layout, put `SheetHeader`, `SheetBody` and `SheetFooter` in a
 * `SheetFrame` yourself.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  size = "md",
  side = "auto",
  className,
  children,
}: SheetProps) {
  return (
    <SheetFrame open={open} onOpenChange={onOpenChange} side={side} size={size} focusField className={className}>
      <SheetHeader title={title} description={description} />
      <SheetBody>{children}</SheetBody>
      {shown(footer) && <SheetFooter>{footer}</SheetFooter>}
    </SheetFrame>
  );
}
