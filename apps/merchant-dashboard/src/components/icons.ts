/**
 * The dashboard's icon set: Phosphor (`@phosphor-icons/react`, MIT), one
 * family, mapped to what each glyph *means* here. Pages import from this file
 * and never from the package, so a glyph is changed in one place.
 *
 * Weights (docs/ux/REDESIGN_PROMPT.md §4.2):
 *   - `regular` at rest (the default);
 *   - `fill` for the selected / current state — the Mac and iPhone convention
 *     (`<IconOrders weight={active ? "fill" : "regular"} />`);
 *   - `duotone` for empty states, feature tiles and onboarding;
 *   - `bold` only at 16px inside buttons.
 * Sizes: 18px in the side menu, 20px in toolbars, 22–24px in the dock, 16px in
 * buttons and chips, 40–48px duotone in empty states. Pass them as Tailwind
 * `size-*` classes; the `size` prop is left alone so CSS keeps control.
 *
 * Decorative icons are `aria-hidden`; an icon-only button has an `aria-label`
 * through `useT`. Arrows, carets and "back" flip in RTL (`rtl:rotate-180` /
 * `rtl:-scale-x-100`); a phone, a clock or a chart does not.
 *
 * Imported per icon from the package's CSR entry so the dev server bundles
 * only what is used, not the whole family.
 */
import type { Icon as PhosphorIcon, IconProps as PhosphorIconProps, IconWeight } from "@phosphor-icons/react";

export type Icon = PhosphorIcon;
/** The same type under a name that never collides with a local `Icon` variable. */
export type IconComponent = PhosphorIcon;
export type IconProps = PhosphorIconProps;
export type { IconWeight };

/* ---------------------------------------------------------------- *
 * Navigation — one per entry of lib/navigation.ts.
 * ---------------------------------------------------------------- */
export { HouseIcon as IconHome } from "@phosphor-icons/react/dist/csr/House";
export { ShoppingBagOpenIcon as IconOrders } from "@phosphor-icons/react/dist/csr/ShoppingBagOpen";
export { PhoneCallIcon as IconConfirm } from "@phosphor-icons/react/dist/csr/PhoneCall";
export { ShoppingCartSimpleIcon as IconLostOrders } from "@phosphor-icons/react/dist/csr/ShoppingCartSimple";
export { ArrowUUpLeftIcon as IconReturns } from "@phosphor-icons/react/dist/csr/ArrowUUpLeft";
export { FileTextIcon as IconQuotes } from "@phosphor-icons/react/dist/csr/FileText";
export { ShieldWarningIcon as IconProtection } from "@phosphor-icons/react/dist/csr/ShieldWarning";
export { PackageIcon as IconProducts } from "@phosphor-icons/react/dist/csr/Package";
export { WarehouseIcon as IconInventory } from "@phosphor-icons/react/dist/csr/Warehouse";
export { GiftIcon as IconOffers } from "@phosphor-icons/react/dist/csr/Gift";
export { TagIcon as IconDiscounts } from "@phosphor-icons/react/dist/csr/Tag";
export { StarIcon as IconReviews } from "@phosphor-icons/react/dist/csr/Star";
export { QuestionIcon as IconQuestions } from "@phosphor-icons/react/dist/csr/Question";
export { RulerIcon as IconSizeCharts } from "@phosphor-icons/react/dist/csr/Ruler";
export { TextAaIcon as IconSynonyms } from "@phosphor-icons/react/dist/csr/TextAa";
export { ImagesIcon as IconMedia } from "@phosphor-icons/react/dist/csr/Images";
export { UsersIcon as IconCustomers } from "@phosphor-icons/react/dist/csr/Users";
export { ChatCircleDotsIcon as IconInbox } from "@phosphor-icons/react/dist/csr/ChatCircleDots";
export { MedalIcon as IconLoyalty } from "@phosphor-icons/react/dist/csr/Medal";
export { CoinsIcon as IconStoreCredit } from "@phosphor-icons/react/dist/csr/Coins";
export { PiggyBankIcon as IconProfit } from "@phosphor-icons/react/dist/csr/PiggyBank";
export { WalletIcon as IconSettlements } from "@phosphor-icons/react/dist/csr/Wallet";
export { CreditCardIcon as IconPayments } from "@phosphor-icons/react/dist/csr/CreditCard";
export { CurrencyCircleDollarIcon as IconAds } from "@phosphor-icons/react/dist/csr/CurrencyCircleDollar";
export { PlugIcon as IconAdAccounts } from "@phosphor-icons/react/dist/csr/Plug";
export { GlobeIcon as IconWebsite } from "@phosphor-icons/react/dist/csr/Globe";
export { NewspaperIcon as IconBlog } from "@phosphor-icons/react/dist/csr/Newspaper";
export { PathIcon as IconFunnels } from "@phosphor-icons/react/dist/csr/Path";
export { TruckIcon as IconShipping } from "@phosphor-icons/react/dist/csr/Truck";
export { StorefrontIcon as IconStoreSettings } from "@phosphor-icons/react/dist/csr/Storefront";
export { MegaphoneIcon as IconMarketing } from "@phosphor-icons/react/dist/csr/Megaphone";
export { RobotIcon as IconAutomations } from "@phosphor-icons/react/dist/csr/Robot";
export { UsersThreeIcon as IconAffiliates } from "@phosphor-icons/react/dist/csr/UsersThree";
export { TicketIcon as IconGiftCards } from "@phosphor-icons/react/dist/csr/Ticket";
export { SparkleIcon as IconAi } from "@phosphor-icons/react/dist/csr/Sparkle";
export { ChartBarIcon as IconReports } from "@phosphor-icons/react/dist/csr/ChartBar";
export { FileCsvIcon as IconMoreReports } from "@phosphor-icons/react/dist/csr/FileCsv";
export { PulseIcon as IconRealtime } from "@phosphor-icons/react/dist/csr/Pulse";
export { ChartLineUpIcon as IconWebAnalytics } from "@phosphor-icons/react/dist/csr/ChartLineUp";
export { TargetIcon as IconAttribution } from "@phosphor-icons/react/dist/csr/Target";
export { MagnifyingGlassIcon as IconSearch } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
export { DownloadSimpleIcon as IconDigital } from "@phosphor-icons/react/dist/csr/DownloadSimple";
export { GraduationCapIcon as IconCourses } from "@phosphor-icons/react/dist/csr/GraduationCap";
export { RepeatIcon as IconSubscriptions } from "@phosphor-icons/react/dist/csr/Repeat";
export { CursorClickIcon as IconShoppableImages } from "@phosphor-icons/react/dist/csr/CursorClick";
export { HandshakeIcon as IconServices } from "@phosphor-icons/react/dist/csr/Handshake";
export { SquaresFourIcon as IconApps } from "@phosphor-icons/react/dist/csr/SquaresFour";
export { GearSixIcon as IconSettings } from "@phosphor-icons/react/dist/csr/GearSix";
export { ClockCounterClockwiseIcon as IconActivity } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
export { HandHeartIcon as IconReferrals } from "@phosphor-icons/react/dist/csr/HandHeart";
export { LifebuoyIcon as IconSupport } from "@phosphor-icons/react/dist/csr/Lifebuoy";
export { ListIcon as IconMore } from "@phosphor-icons/react/dist/csr/List";

/* ---------------------------------------------------------------- *
 * Shell and controls.
 * ---------------------------------------------------------------- */
export { BellIcon as IconBell } from "@phosphor-icons/react/dist/csr/Bell";
export { BellRingingIcon as IconBellRinging } from "@phosphor-icons/react/dist/csr/BellRinging";
export { PlusIcon as IconPlus } from "@phosphor-icons/react/dist/csr/Plus";
export { MinusIcon as IconMinus } from "@phosphor-icons/react/dist/csr/Minus";
export { XIcon as IconClose } from "@phosphor-icons/react/dist/csr/X";
export { CheckIcon as IconCheck } from "@phosphor-icons/react/dist/csr/Check";
export { CaretDownIcon as IconCaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
export { CaretUpIcon as IconCaretUp } from "@phosphor-icons/react/dist/csr/CaretUp";
export { CaretUpDownIcon as IconCaretUpDown } from "@phosphor-icons/react/dist/csr/CaretUpDown";
export { ArrowUpIcon as IconArrowUp } from "@phosphor-icons/react/dist/csr/ArrowUp";
export { ArrowDownIcon as IconArrowDown } from "@phosphor-icons/react/dist/csr/ArrowDown";
export { ArrowUpRightIcon as IconArrowOut } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
export { ArrowSquareOutIcon as IconExternal } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
export { KeyboardIcon as IconKeyboard } from "@phosphor-icons/react/dist/csr/Keyboard";
export { KeyReturnIcon as IconEnter } from "@phosphor-icons/react/dist/csr/KeyReturn";
export { SignOutIcon as IconSignOut } from "@phosphor-icons/react/dist/csr/SignOut";
export { ArrowsOutSimpleIcon as IconExpand } from "@phosphor-icons/react/dist/csr/ArrowsOutSimple";
export { ArrowsInSimpleIcon as IconCollapse } from "@phosphor-icons/react/dist/csr/ArrowsInSimple";
export { PushPinIcon as IconPin } from "@phosphor-icons/react/dist/csr/PushPin";
export { PushPinSlashIcon as IconUnpin } from "@phosphor-icons/react/dist/csr/PushPinSlash";
export { DotsThreeIcon as IconMoreActions } from "@phosphor-icons/react/dist/csr/DotsThree";
export { DotsThreeVerticalIcon as IconMoreVertical } from "@phosphor-icons/react/dist/csr/DotsThreeVertical";
export { DotsSixVerticalIcon as IconDragHandle } from "@phosphor-icons/react/dist/csr/DotsSixVertical";
export { FunnelSimpleIcon as IconFilter } from "@phosphor-icons/react/dist/csr/FunnelSimple";
export { SlidersHorizontalIcon as IconSliders } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
export { ArrowsDownUpIcon as IconSort } from "@phosphor-icons/react/dist/csr/ArrowsDownUp";
export { CalendarBlankIcon as IconCalendar } from "@phosphor-icons/react/dist/csr/CalendarBlank";
export { CalendarCheckIcon as IconCalendarCheck } from "@phosphor-icons/react/dist/csr/CalendarCheck";
export { ClockIcon as IconClock } from "@phosphor-icons/react/dist/csr/Clock";
export { ClockCountdownIcon as IconCountdown } from "@phosphor-icons/react/dist/csr/ClockCountdown";
export { HourglassIcon as IconHourglass } from "@phosphor-icons/react/dist/csr/Hourglass";
export { TranslateIcon as IconLanguage } from "@phosphor-icons/react/dist/csr/Translate";
export { SunIcon as IconSun } from "@phosphor-icons/react/dist/csr/Sun";
export { MoonIcon as IconMoon } from "@phosphor-icons/react/dist/csr/Moon";
export { MonitorIcon as IconDesktop } from "@phosphor-icons/react/dist/csr/Monitor";
export { DeviceTabletIcon as IconTablet } from "@phosphor-icons/react/dist/csr/DeviceTablet";
export { DeviceMobileIcon as IconPhoneDevice } from "@phosphor-icons/react/dist/csr/DeviceMobile";
export { ArrowsClockwiseIcon as IconRefresh } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
export { ArrowUUpLeftIcon as IconUndo } from "@phosphor-icons/react/dist/csr/ArrowUUpLeft";
export { ArrowUUpRightIcon as IconRedo } from "@phosphor-icons/react/dist/csr/ArrowUUpRight";
export { CommandIcon as IconCommand } from "@phosphor-icons/react/dist/csr/Command";
export { SidebarSimpleIcon as IconSidebar } from "@phosphor-icons/react/dist/csr/SidebarSimple";
export { EyeIcon as IconEye } from "@phosphor-icons/react/dist/csr/Eye";
export { EyeSlashIcon as IconEyeOff } from "@phosphor-icons/react/dist/csr/EyeSlash";
export { MagnifyingGlassPlusIcon as IconQuickLook } from "@phosphor-icons/react/dist/csr/MagnifyingGlassPlus";

/* ---------------------------------------------------------------- *
 * Actions on records.
 * ---------------------------------------------------------------- */
export { PencilSimpleIcon as IconEdit } from "@phosphor-icons/react/dist/csr/PencilSimple";
export { TrashIcon as IconDelete } from "@phosphor-icons/react/dist/csr/Trash";
export { CopyIcon as IconCopy } from "@phosphor-icons/react/dist/csr/Copy";
export { FloppyDiskIcon as IconSave } from "@phosphor-icons/react/dist/csr/FloppyDisk";
export { UploadSimpleIcon as IconUpload } from "@phosphor-icons/react/dist/csr/UploadSimple";
export { DownloadSimpleIcon as IconDownload } from "@phosphor-icons/react/dist/csr/DownloadSimple";
export { ExportIcon as IconExport } from "@phosphor-icons/react/dist/csr/Export";
export { PrinterIcon as IconPrint } from "@phosphor-icons/react/dist/csr/Printer";
export { ShareNetworkIcon as IconShare } from "@phosphor-icons/react/dist/csr/ShareNetwork";
export { LinkIcon as IconLink } from "@phosphor-icons/react/dist/csr/Link";
export { LinkBreakIcon as IconLinkOff } from "@phosphor-icons/react/dist/csr/LinkBreak";
export { PaperPlaneTiltIcon as IconSend } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
export { PlayIcon as IconPlay } from "@phosphor-icons/react/dist/csr/Play";
export { PauseIcon as IconPause } from "@phosphor-icons/react/dist/csr/Pause";
export { ScanIcon as IconScan } from "@phosphor-icons/react/dist/csr/Scan";
export { QrCodeIcon as IconQr } from "@phosphor-icons/react/dist/csr/QrCode";
export { ListChecksIcon as IconChecklist } from "@phosphor-icons/react/dist/csr/ListChecks";
export { ListBulletsIcon as IconListView } from "@phosphor-icons/react/dist/csr/ListBullets";
export { GridFourIcon as IconGridView } from "@phosphor-icons/react/dist/csr/GridFour";
export { ColumnsIcon as IconColumns } from "@phosphor-icons/react/dist/csr/Columns";
export { TableIcon as IconTable } from "@phosphor-icons/react/dist/csr/Table";

/* ---------------------------------------------------------------- *
 * The customer: one tap to call or WhatsApp, anywhere a customer appears.
 * ---------------------------------------------------------------- */
export { PhoneIcon as IconPhone } from "@phosphor-icons/react/dist/csr/Phone";
export { PhoneXIcon as IconNoAnswer } from "@phosphor-icons/react/dist/csr/PhoneX";
export { WhatsappLogoIcon as IconWhatsApp } from "@phosphor-icons/react/dist/csr/WhatsappLogo";
export { ChatTextIcon as IconMessage } from "@phosphor-icons/react/dist/csr/ChatText";
export { EnvelopeSimpleIcon as IconEmail } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
export { UserIcon as IconUser } from "@phosphor-icons/react/dist/csr/User";
export { UserPlusIcon as IconUserAdd } from "@phosphor-icons/react/dist/csr/UserPlus";
export { UserCircleIcon as IconAccount } from "@phosphor-icons/react/dist/csr/UserCircle";
export { MapPinIcon as IconPlace } from "@phosphor-icons/react/dist/csr/MapPin";
export { MapTrifoldIcon as IconMap } from "@phosphor-icons/react/dist/csr/MapTrifold";
export { AddressBookIcon as IconContacts } from "@phosphor-icons/react/dist/csr/AddressBook";

/* ---------------------------------------------------------------- *
 * The COD journey and money.
 * ---------------------------------------------------------------- */
export { ShoppingBagIcon as IconBag } from "@phosphor-icons/react/dist/csr/ShoppingBag";
export { ShoppingCartIcon as IconCart } from "@phosphor-icons/react/dist/csr/ShoppingCart";
export { PackageIcon as IconPackage } from "@phosphor-icons/react/dist/csr/Package";
export { CubeIcon as IconProduct } from "@phosphor-icons/react/dist/csr/Cube";
export { TrayArrowDownIcon as IconStockLow } from "@phosphor-icons/react/dist/csr/TrayArrowDown";
export { TruckIcon as IconCourier } from "@phosphor-icons/react/dist/csr/Truck";
export { SealCheckIcon as IconDelivered } from "@phosphor-icons/react/dist/csr/SealCheck";
export { ProhibitIcon as IconCancelled } from "@phosphor-icons/react/dist/csr/Prohibit";
export { MoneyIcon as IconCash } from "@phosphor-icons/react/dist/csr/Money";
export { BankIcon as IconBank } from "@phosphor-icons/react/dist/csr/Bank";
export { ReceiptIcon as IconReceipt } from "@phosphor-icons/react/dist/csr/Receipt";
export { InvoiceIcon as IconInvoice } from "@phosphor-icons/react/dist/csr/Invoice";
export { HandCoinsIcon as IconPayout } from "@phosphor-icons/react/dist/csr/HandCoins";
export { PercentIcon as IconPercent } from "@phosphor-icons/react/dist/csr/Percent";
export { SealPercentIcon as IconSale } from "@phosphor-icons/react/dist/csr/SealPercent";
export { TrendUpIcon as IconTrendUp } from "@phosphor-icons/react/dist/csr/TrendUp";
export { TrendDownIcon as IconTrendDown } from "@phosphor-icons/react/dist/csr/TrendDown";
export { ChartPieIcon as IconChartPie } from "@phosphor-icons/react/dist/csr/ChartPie";
export { ChartLineIcon as IconChartLine } from "@phosphor-icons/react/dist/csr/ChartLine";
export { TrophyIcon as IconTrophy } from "@phosphor-icons/react/dist/csr/Trophy";
export { CrownIcon as IconCrown } from "@phosphor-icons/react/dist/csr/Crown";
export { FireIcon as IconHot } from "@phosphor-icons/react/dist/csr/Fire";
export { HeartIcon as IconHeart } from "@phosphor-icons/react/dist/csr/Heart";
export { LightningIcon as IconLightning } from "@phosphor-icons/react/dist/csr/Lightning";
export { RocketLaunchIcon as IconLaunch } from "@phosphor-icons/react/dist/csr/RocketLaunch";
export { ConfettiIcon as IconCelebrate } from "@phosphor-icons/react/dist/csr/Confetti";

/* ---------------------------------------------------------------- *
 * Status and feedback — always next to a word, never colour alone.
 * ---------------------------------------------------------------- */
export { CheckCircleIcon as IconSuccess } from "@phosphor-icons/react/dist/csr/CheckCircle";
export { WarningCircleIcon as IconError } from "@phosphor-icons/react/dist/csr/WarningCircle";
export { WarningIcon as IconWarning } from "@phosphor-icons/react/dist/csr/Warning";
export { InfoIcon as IconInfo } from "@phosphor-icons/react/dist/csr/Info";
export { XCircleIcon as IconFailed } from "@phosphor-icons/react/dist/csr/XCircle";
export { CircleIcon as IconCircle } from "@phosphor-icons/react/dist/csr/Circle";
export { CircleDashedIcon as IconPending } from "@phosphor-icons/react/dist/csr/CircleDashed";
export { LockIcon as IconLock } from "@phosphor-icons/react/dist/csr/Lock";
export { LockOpenIcon as IconUnlock } from "@phosphor-icons/react/dist/csr/LockOpen";
export { KeyIcon as IconKey } from "@phosphor-icons/react/dist/csr/Key";
export { ShieldCheckIcon as IconShield } from "@phosphor-icons/react/dist/csr/ShieldCheck";
export { CloudSlashIcon as IconOffline } from "@phosphor-icons/react/dist/csr/CloudSlash";
export { SpinnerGapIcon as IconSpinner } from "@phosphor-icons/react/dist/csr/SpinnerGap";
export { LightbulbIcon as IconTip } from "@phosphor-icons/react/dist/csr/Lightbulb";
export { BookOpenIcon as IconGuide } from "@phosphor-icons/react/dist/csr/BookOpen";
export { HeadsetIcon as IconHelp } from "@phosphor-icons/react/dist/csr/Headset";

/* ---------------------------------------------------------------- *
 * Content and the editor.
 * ---------------------------------------------------------------- */
export { ImageSquareIcon as IconImage } from "@phosphor-icons/react/dist/csr/ImageSquare";
export { ImageBrokenIcon as IconImageMissing } from "@phosphor-icons/react/dist/csr/ImageBroken";
export { VideoCameraIcon as IconVideo } from "@phosphor-icons/react/dist/csr/VideoCamera";
export { PaletteIcon as IconTheme } from "@phosphor-icons/react/dist/csr/Palette";
export { PaintBrushIcon as IconStyle } from "@phosphor-icons/react/dist/csr/PaintBrush";
export { TextTIcon as IconText } from "@phosphor-icons/react/dist/csr/TextT";
export { LayoutIcon as IconLayout } from "@phosphor-icons/react/dist/csr/Layout";
export { StackIcon as IconSections } from "@phosphor-icons/react/dist/csr/Stack";
export { TreeStructureIcon as IconTree } from "@phosphor-icons/react/dist/csr/TreeStructure";
export { CodeIcon as IconCode } from "@phosphor-icons/react/dist/csr/Code";
export { BrowserIcon as IconPage } from "@phosphor-icons/react/dist/csr/Browser";
export { FolderIcon as IconFolder } from "@phosphor-icons/react/dist/csr/Folder";
export { ArchiveIcon as IconArchive } from "@phosphor-icons/react/dist/csr/Archive";
export { NotePencilIcon as IconNote } from "@phosphor-icons/react/dist/csr/NotePencil";
export { FilePdfIcon as IconPdf } from "@phosphor-icons/react/dist/csr/FilePdf";
export { FileXlsIcon as IconSheet } from "@phosphor-icons/react/dist/csr/FileXls";
export { BarcodeIcon as IconBarcode } from "@phosphor-icons/react/dist/csr/Barcode";
export { FlaskIcon as IconExperiment } from "@phosphor-icons/react/dist/csr/Flask";
export { MagicWandIcon as IconMagic } from "@phosphor-icons/react/dist/csr/MagicWand";
export { DatabaseIcon as IconData } from "@phosphor-icons/react/dist/csr/Database";
export { PuzzlePieceIcon as IconIntegration } from "@phosphor-icons/react/dist/csr/PuzzlePiece";
export { WrenchIcon as IconTool } from "@phosphor-icons/react/dist/csr/Wrench";

/* ---------------------------------------------------------------- *
 * Everything else the pages use, by what it means.
 * ---------------------------------------------------------------- */
export { AlarmIcon as IconAlarm } from "@phosphor-icons/react/dist/csr/Alarm";
export { TextAlignLeftIcon as IconAlignStart } from "@phosphor-icons/react/dist/csr/TextAlignLeft";
export { MegaphoneIcon as IconAnnounce } from "@phosphor-icons/react/dist/csr/Megaphone";
export { ArrowDownRightIcon as IconArrowDownRight } from "@phosphor-icons/react/dist/csr/ArrowDownRight";
export { ArrowLeftIcon as IconArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
export { ArrowRightIcon as IconArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
export { MedalIcon as IconAward } from "@phosphor-icons/react/dist/csr/Medal";
export { ProhibitIcon as IconBlock } from "@phosphor-icons/react/dist/csr/Prohibit";
export { TextBIcon as IconBold } from "@phosphor-icons/react/dist/csr/TextB";
export { BookmarkSimpleIcon as IconBookmark } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
export { StackIcon as IconBoxes } from "@phosphor-icons/react/dist/csr/Stack";
export { BuildingsIcon as IconBuilding } from "@phosphor-icons/react/dist/csr/Buildings";
export { CameraIcon as IconCamera } from "@phosphor-icons/react/dist/csr/Camera";
export { CreditCardIcon as IconCard } from "@phosphor-icons/react/dist/csr/CreditCard";
export { CaretLeftIcon as IconCaretLeft } from "@phosphor-icons/react/dist/csr/CaretLeft";
export { CaretRightIcon as IconCaretRight } from "@phosphor-icons/react/dist/csr/CaretRight";
export { SlideshowIcon as IconCarousel } from "@phosphor-icons/react/dist/csr/Slideshow";
export { ChartBarIcon as IconChart } from "@phosphor-icons/react/dist/csr/ChartBar";
export { ChatCircleIcon as IconChat } from "@phosphor-icons/react/dist/csr/ChatCircle";
export { ChecksIcon as IconCheckAll } from "@phosphor-icons/react/dist/csr/Checks";
export { CursorClickIcon as IconClick } from "@phosphor-icons/react/dist/csr/CursorClick";
export { ClipboardTextIcon as IconClipboard } from "@phosphor-icons/react/dist/csr/ClipboardText";
export { CoinsIcon as IconCoins } from "@phosphor-icons/react/dist/csr/Coins";
export { ArrowsMergeIcon as IconCombine } from "@phosphor-icons/react/dist/csr/ArrowsMerge";
export { CompassIcon as IconCompass } from "@phosphor-icons/react/dist/csr/Compass";
export { CircleHalfIcon as IconContrast } from "@phosphor-icons/react/dist/csr/CircleHalf";
export { ArrowBendLeftUpIcon as IconCornerUp } from "@phosphor-icons/react/dist/csr/ArrowBendLeftUp";
export { SquaresFourIcon as IconDashboard } from "@phosphor-icons/react/dist/csr/SquaresFour";
export { DevicesIcon as IconDevices } from "@phosphor-icons/react/dist/csr/Devices";
export { ArrowsInLineVerticalIcon as IconDivider } from "@phosphor-icons/react/dist/csr/ArrowsInLineVertical";
export { FileTextIcon as IconDocument } from "@phosphor-icons/react/dist/csr/FileText";
export { DoorOpenIcon as IconDoor } from "@phosphor-icons/react/dist/csr/DoorOpen";
export { PencilRulerIcon as IconDraft } from "@phosphor-icons/react/dist/csr/PencilRuler";
export { EnvelopeSimpleOpenIcon as IconEmailOpen } from "@phosphor-icons/react/dist/csr/EnvelopeSimpleOpen";
export { FactoryIcon as IconFactory } from "@phosphor-icons/react/dist/csr/Factory";
export { TextboxIcon as IconField } from "@phosphor-icons/react/dist/csr/Textbox";
export { FilePlusIcon as IconFileAdd } from "@phosphor-icons/react/dist/csr/FilePlus";
export { FileArrowDownIcon as IconFileDown } from "@phosphor-icons/react/dist/csr/FileArrowDown";
export { FileDashedIcon as IconFileUnknown } from "@phosphor-icons/react/dist/csr/FileDashed";
export { FileArrowUpIcon as IconFileUp } from "@phosphor-icons/react/dist/csr/FileArrowUp";
export { FilmStripIcon as IconFilm } from "@phosphor-icons/react/dist/csr/FilmStrip";
export { FlowArrowIcon as IconFlow } from "@phosphor-icons/react/dist/csr/FlowArrow";
export { FrameCornersIcon as IconFrame } from "@phosphor-icons/react/dist/csr/FrameCorners";
export { GiftIcon as IconGift } from "@phosphor-icons/react/dist/csr/Gift";
export { GlobeIcon as IconGlobe } from "@phosphor-icons/react/dist/csr/Globe";
export { GridNineIcon as IconGridDense } from "@phosphor-icons/react/dist/csr/GridNine";
export { TextHIcon as IconHeading } from "@phosphor-icons/react/dist/csr/TextH";
export { TextHOneIcon as IconHeadingOne } from "@phosphor-icons/react/dist/csr/TextHOne";
export { TextHTwoIcon as IconHeadingTwo } from "@phosphor-icons/react/dist/csr/TextHTwo";
export { HexagonIcon as IconHexagon } from "@phosphor-icons/react/dist/csr/Hexagon";
export { TreePalmIcon as IconHoliday } from "@phosphor-icons/react/dist/csr/TreePalm";
export { ImageIcon as IconImageAdd } from "@phosphor-icons/react/dist/csr/Image";
export { TextIndentIcon as IconIndent } from "@phosphor-icons/react/dist/csr/TextIndent";
export { CrosshairIcon as IconInspect } from "@phosphor-icons/react/dist/csr/Crosshair";
export { TextItalicIcon as IconItalic } from "@phosphor-icons/react/dist/csr/TextItalic";
export { StackIcon as IconLayers } from "@phosphor-icons/react/dist/csr/Stack";
export { SquareSplitHorizontalIcon as IconLayoutSplit } from "@phosphor-icons/react/dist/csr/SquareSplitHorizontal";
export { ListNumbersIcon as IconListNumbers } from "@phosphor-icons/react/dist/csr/ListNumbers";
export { BroadcastIcon as IconLive } from "@phosphor-icons/react/dist/csr/Broadcast";
export { MapPinAreaIcon as IconMapPinned } from "@phosphor-icons/react/dist/csr/MapPinArea";
export { ChatCenteredDotsIcon as IconMessageAdd } from "@phosphor-icons/react/dist/csr/ChatCenteredDots";
export { SignpostIcon as IconMilestone } from "@phosphor-icons/react/dist/csr/Signpost";
export { ArrowsVerticalIcon as IconMoveVertical } from "@phosphor-icons/react/dist/csr/ArrowsVertical";
export { PlanetIcon as IconOrbit } from "@phosphor-icons/react/dist/csr/Planet";
export { TextOutdentIcon as IconOutdent } from "@phosphor-icons/react/dist/csr/TextOutdent";
export { PackageIcon as IconPackageFailed } from "@phosphor-icons/react/dist/csr/Package";
export { PackageIcon as IconPackageOpen } from "@phosphor-icons/react/dist/csr/Package";
export { PackageIcon as IconPackageSearch } from "@phosphor-icons/react/dist/csr/Package";
export { CheckSquareOffsetIcon as IconPacked } from "@phosphor-icons/react/dist/csr/CheckSquareOffset";
export { SquareHalfBottomIcon as IconPanelBottom } from "@phosphor-icons/react/dist/csr/SquareHalfBottom";
export { BrowserIcon as IconPanelTop } from "@phosphor-icons/react/dist/csr/Browser";
export { ParagraphIcon as IconParagraph } from "@phosphor-icons/react/dist/csr/Paragraph";
export { PauseCircleIcon as IconPauseCircle } from "@phosphor-icons/react/dist/csr/PauseCircle";
export { UsersIcon as IconPeople } from "@phosphor-icons/react/dist/csr/Users";
export { MapPinSimpleIcon as IconPlaceOff } from "@phosphor-icons/react/dist/csr/MapPinSimple";
export { PlayCircleIcon as IconPlayCircle } from "@phosphor-icons/react/dist/csr/PlayCircle";
export { PlugIcon as IconPlug } from "@phosphor-icons/react/dist/csr/Plug";
export { PlugsIcon as IconPlugFailed } from "@phosphor-icons/react/dist/csr/Plugs";
export { PowerIcon as IconPower } from "@phosphor-icons/react/dist/csr/Power";
export { PackageIcon as IconProductAdd } from "@phosphor-icons/react/dist/csr/Package";
export { ArrowLineLeftIcon as IconPushLeft } from "@phosphor-icons/react/dist/csr/ArrowLineLeft";
export { ArrowLineRightIcon as IconPushRight } from "@phosphor-icons/react/dist/csr/ArrowLineRight";
export { QuotesIcon as IconQuote } from "@phosphor-icons/react/dist/csr/Quotes";
export { RadioButtonIcon as IconRadio } from "@phosphor-icons/react/dist/csr/RadioButton";
export { RepeatIcon as IconRepeat } from "@phosphor-icons/react/dist/csr/Repeat";
export { RobotIcon as IconRobot } from "@phosphor-icons/react/dist/csr/Robot";
export { ArrowClockwiseIcon as IconRotate } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
export { ArrowCounterClockwiseIcon as IconRotateBack } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
export { RowsIcon as IconRows } from "@phosphor-icons/react/dist/csr/Rows";
export { RssIcon as IconRss } from "@phosphor-icons/react/dist/csr/Rss";
export { RulerIcon as IconRuler } from "@phosphor-icons/react/dist/csr/Ruler";
export { ScalesIcon as IconScale } from "@phosphor-icons/react/dist/csr/Scales";
export { CalendarDotsIcon as IconSchedule } from "@phosphor-icons/react/dist/csr/CalendarDots";
export { ShuffleIcon as IconShuffle } from "@phosphor-icons/react/dist/csr/Shuffle";
export { SparkleIcon as IconSparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
export { StarIcon as IconStar } from "@phosphor-icons/react/dist/csr/Star";
export { NoteIcon as IconStickyNote } from "@phosphor-icons/react/dist/csr/Note";
export { StorefrontIcon as IconStore } from "@phosphor-icons/react/dist/csr/Storefront";
export { ArrowsLeftRightIcon as IconSwap } from "@phosphor-icons/react/dist/csr/ArrowsLeftRight";
export { TagIcon as IconTag } from "@phosphor-icons/react/dist/csr/Tag";
export { TargetIcon as IconTarget } from "@phosphor-icons/react/dist/csr/Target";
export { UsersThreeIcon as IconTeam } from "@phosphor-icons/react/dist/csr/UsersThree";
export { TicketIcon as IconTicket } from "@phosphor-icons/react/dist/csr/Ticket";
export { TimerIcon as IconTimer } from "@phosphor-icons/react/dist/csr/Timer";
export { TrayIcon as IconTray } from "@phosphor-icons/react/dist/csr/Tray";
export { PlugsIcon as IconUnplug } from "@phosphor-icons/react/dist/csr/Plugs";
export { UserMinusIcon as IconUserBlocked } from "@phosphor-icons/react/dist/csr/UserMinus";
export { SealCheckIcon as IconVerified } from "@phosphor-icons/react/dist/csr/SealCheck";
export { MonitorPlayIcon as IconVideoBlock } from "@phosphor-icons/react/dist/csr/MonitorPlay";
export { FilmSlateIcon as IconVideoClip } from "@phosphor-icons/react/dist/csr/FilmSlate";
export { WalletIcon as IconWallet } from "@phosphor-icons/react/dist/csr/Wallet";
export { WavesIcon as IconWaves } from "@phosphor-icons/react/dist/csr/Waves";

/* Sets a default weight / size for every icon beneath it: `<IconContext.Provider value={{ weight: "duotone" }}>`. */
export { IconContext } from "@phosphor-icons/react/dist/lib/context";
