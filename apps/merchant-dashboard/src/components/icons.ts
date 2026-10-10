/**
 * The icons of the screens ported from zimos-additions, named by what each
 * glyph means here. Every one is a lucide-react icon, like the rest of the
 * dashboard; those screens import from this file, so a glyph is changed in
 * one place.
 *
 * Decorative icons are `aria-hidden`; an icon-only button has an `aria-label`
 * through `useT`. Arrows, carets and "back" flip in RTL (`rtl:rotate-180` /
 * `rtl:-scale-x-100`); a phone, a clock or a chart does not.
 */
import type { LucideIcon, LucideProps } from "lucide-react";

export type Icon = LucideIcon;
/** The same type under a name that never collides with a local `Icon` variable. */
export type IconComponent = LucideIcon;
export type IconProps = LucideProps;

export {
  ChevronRight as IconCaretRight,
  ExternalLink as IconExternal,
  KeyRound as IconKey,
  LoaderCircle as IconSpinner,
  Lock as IconLock,
  ShieldCheck as IconShield,
} from "lucide-react";
