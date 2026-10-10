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
  ArrowDown as IconArrowDown,
  ArrowUpRight as IconArrowOut,
  ArrowUp as IconArrowUp,
  Bell as IconBell,
  ChevronDown as IconCaretDown,
  ChevronRight as IconCaretRight,
  ChevronUp as IconCaretUp,
  MessageCircle as IconChat,
  Check as IconCheck,
  ListChecks as IconChecklist,
  X as IconClose,
  Coins as IconCoins,
  Trash2 as IconDelete,
  Pencil as IconEdit,
  CornerDownLeft as IconEnter,
  ExternalLink as IconExternal,
  Eye as IconEye,
  EyeOff as IconEyeOff,
  FileUp as IconFileUp,
  ListFilter as IconFilter,
  Folder as IconFolder,
  Gift as IconGift,
  Image as IconImage,
  KeyRound as IconKey,
  Lock as IconLock,
  Ellipsis as IconMoreActions,
  NotebookPen as IconNote,
  Gift as IconOffers,
  Package as IconPackage,
  AppWindow as IconPage,
  Pin as IconPin,
  Plus as IconPlus,
  Box as IconProduct,
  CircleQuestionMark as IconQuestions,
  ZoomIn as IconQuickLook,
  RefreshCw as IconRefresh,
  Ruler as IconRuler,
  CalendarDays as IconSchedule,
  Search as IconSearch,
  ShieldCheck as IconShield,
  SlidersHorizontal as IconSliders,
  LoaderCircle as IconSpinner,
  CircleCheck as IconSuccess,
} from "lucide-react";
