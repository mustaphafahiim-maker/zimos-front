// shadcn/ui — Base UI "Vega" preset. Components are generated with
// `npx shadcn@4.19.0 add <name> -c apps/merchant-dashboard` (newer CLI versions
// fail with "Could not load the workspace config"), then moved here so the four
// apps have a single source of components.

export { Button, buttonVariants, type ButtonProps } from "./components/button";
export { Input } from "./components/input";
export { Label } from "./components/label";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "./components/card";
export { Alert, AlertTitle, AlertDescription, AlertAction } from "./components/alert";
export { Spinner } from "./components/spinner";

export { Badge, badgeVariants } from "./components/badge";
export { Textarea } from "./components/textarea";
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "./components/dialog";
export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./components/dropdown-menu";
export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants } from "./components/tabs";
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./components/table";
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./components/select";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./components/tooltip";
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./components/sheet";

export { cn } from "cn";

// ZIMOS brand primitives (RTL-safe, token-styled).
export {
  Skeleton,
  SkeletonRows,
  Avatar,
  Progress,
  SegmentedControl,
  Kbd,
  Stepper,
  Chip,
  type SegmentOption,
  type StepperStep,
} from "./components/zimos-extras";

// ZIMOS brand — official logo renderers + approved phrases.
export { ZimosLogo, ZimosMark, ZIMOS_PHRASES, type ZimosLogoSurface } from "./brand/ZimosLogo";

// App-shell primitives shared by merchant-dashboard and platform-admin. All
// user-visible text is overridable via props (English defaults) so bilingual
// apps pass translated strings; routing/error helpers are injected, never imported.
export { Modal, type ModalProps } from "./components/modal";
export { ConfirmDialog, type ConfirmDialogProps, type ConfirmDialogLabels } from "./components/confirm-dialog";
export {
  DataState,
  EmptyBlock,
  defaultErrorMessage,
  type DataStateProps,
  type DataStateLabels,
} from "./components/data-state";
export {
  ToastProvider,
  useToast,
  type ToastKind,
  type ToastContextValue,
  type ToastProviderProps,
} from "./components/toast";
export { Toggle, type ToggleProps } from "./components/toggle";
export { ThemeToggle, useTheme, toggleTheme, type Theme, type ThemeToggleProps } from "./components/theme-toggle";
export { PageHeader, AnchorLink, type PageHeaderProps, type LinkComponent } from "./components/page-header";
export { KpiCard, type KpiCardProps } from "./components/kpi-card";
export {
  LineAreaChart,
  BarChart,
  HBarList,
  FunnelBars,
  Sparkline,
  ChartAxis,
  type ChartPoint,
  type LineAreaChartProps,
  type BarChartProps,
  type HBarListProps,
  type FunnelBarsProps,
} from "./components/charts";
export { useAsync, type AsyncState } from "./hooks/useAsync";
