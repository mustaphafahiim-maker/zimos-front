import type { CSSProperties, ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { useLocale, useT } from "@/i18n/LocaleContext";
import { LAB_MESSAGES } from "../messages";
import { BRAND_MESSAGES } from "./messages";
import { ANGLE_DEG, LOCKUP, MARK, MICRO, markModules, markPaths } from "@/brand/geometry";
import { ZAppIcon, ZLogo, ZMark, ZTaglineLockup, ZWordmark } from "@/brand/ZimosBrand";
import "./brand.css";

type Tone = "white" | "surface" | "navy" | "black" | "blue" | "busy";
type Layout = "center" | "top" | "tight" | "fill" | "bare";

function Group({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4">
      <div className="max-w-2xl">
        <h3 id={`${id}-title`} className="zb-h2">
          {title}
        </h3>
        <p className="zb-soft mt-1 text-sm leading-relaxed">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Tile({
  label,
  note,
  tone = "white",
  layout = "center",
  className,
  children,
}: {
  label: string;
  note?: string;
  tone?: Tone;
  layout?: Layout;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className={cn("zb-tile", className)}>
      <div className="zb-stage" data-tone={tone} data-layout={layout}>
        {children}
      </div>
      <figcaption className="zb-cap">
        <strong>{label}</strong>
        {note && <span className="zb-soft">{note}</span>}
      </figcaption>
    </figure>
  );
}

const MASTER_MODULES = markModules(MARK);
const MASTER_PATHS = markPaths(MARK);
const MICRO_PATHS = markPaths(MICRO);

/** The mark over its grid: module heights, the gap, the one angle and the one radius. */
function ConstructionGrid({ t }: { t: Record<"module" | "gap" | "angle" | "radius", string> }) {
  const rows = [
    { y: 0, h: MARK.bar, label: `${MARK.bar} · ${t.module}` },
    { y: MARK.bar, h: MARK.gap, label: `${MARK.gap} · ${t.gap}` },
    { y: MARK.bar + MARK.gap, h: MARK.middle, label: `${MARK.middle} · ${t.module}` },
    { y: MARK.bar + MARK.gap + MARK.middle, h: MARK.gap, label: `${MARK.gap} · ${t.gap}` },
    { y: MARK.size - MARK.bar, h: MARK.bar, label: `${MARK.bar} · ${t.module}` },
  ];
  const elbow = MASTER_MODULES[1][5];
  return (
    <svg viewBox="-14 -12 190 124" className="h-auto w-full max-w-md" style={{ direction: "ltr" }} aria-hidden>
      {Array.from({ length: 26 }, (_, i) => i * 4).map((v) => (
        <g key={v} stroke="#e3e8f2" strokeWidth="0.3">
          <line x1={v} y1="0" x2={v} y2="100" />
          <line x1="0" y1={v} x2="100" y2={v} />
        </g>
      ))}
      <rect x="0" y="0" width="100" height="100" fill="none" stroke="#b9c4dc" strokeWidth="0.5" />
      {MASTER_PATHS.map((d) => (
        <path key={d} d={d} fill="#165DFF" fillOpacity="0.14" stroke="#165DFF" strokeWidth="0.7" />
      ))}
      {MASTER_MODULES.map((module) => (
        <polygon key={module.join()} points={module.map((p) => p.join(",")).join(" ")} fill="none" stroke="#081F5C" strokeWidth="0.3" strokeDasharray="1.2 1.2" />
      ))}
      {/* The angle, read where the diagonal leaves the grid edge. */}
      <line x1={elbow[0]} y1={elbow[1]} x2={elbow[0] + 26} y2={elbow[1]} stroke="#12C8DA" strokeWidth="0.6" />
      <path d={`M${elbow[0] + 18} ${elbow[1]}A18 18 0 0 0 ${(elbow[0] + 18 * Math.cos((ANGLE_DEG * Math.PI) / 180)).toFixed(2)} ${(elbow[1] - 18 * Math.sin((ANGLE_DEG * Math.PI) / 180)).toFixed(2)}`} fill="none" stroke="#12C8DA" strokeWidth="0.8" />
      {rows.map((row) => (
        <g key={row.y}>
          <line x1="104" y1={row.y} x2="110" y2={row.y} stroke="#081F5C" strokeWidth="0.4" />
          <line x1="104" y1={row.y + row.h} x2="110" y2={row.y + row.h} stroke="#081F5C" strokeWidth="0.4" />
          <line x1="107" y1={row.y} x2="107" y2={row.y + row.h} stroke="#081F5C" strokeWidth="0.4" />
          <text x="113" y={row.y + row.h / 2 + 1.6} fontSize="4.6" fill="#081F5C">
            {row.label}
          </text>
        </g>
      ))}
      <text x="113" y="-4" fontSize="4.6" fill="#08707b" fontWeight="600">
        {ANGLE_DEG}° · {t.angle}
      </text>
      <text x="0" y="-4" fontSize="4.6" fill="#56648c">
        {t.radius} {MARK.radius}
      </text>
      <circle cx={MARK.radius} cy={MARK.radius} r={MARK.radius} fill="none" stroke="#12C8DA" strokeWidth="0.6" />
    </svg>
  );
}

/** One module (X) of free space on every side of the logo. */
function ClearSpace() {
  const x = MARK.bar;
  const width = LOCKUP.width;
  const corners = [
    [-x, -x],
    [width, -x],
    [-x, MARK.size],
    [width, MARK.size],
  ];
  return (
    <svg viewBox={`${-x} ${-x} ${width + 2 * x} ${MARK.size + 2 * x}`} className="h-auto w-full max-w-md" style={{ direction: "ltr" }} aria-hidden>
      <rect x={-x + 0.5} y={-x + 0.5} width={width + 2 * x - 1} height={MARK.size + 2 * x - 1} fill="none" stroke="#12C8DA" strokeWidth="1" strokeDasharray="5 4" />
      <rect x="0" y="0" width={width} height={MARK.size} fill="none" stroke="#b9c4dc" strokeWidth="0.8" />
      {corners.map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <rect x={cx} y={cy} width={x} height={x} fill="#12C8DA" fillOpacity="0.16" />
          <text x={cx + x / 2} y={cy + x / 2 + 4} fontSize="11" textAnchor="middle" fill="#08707b" fontWeight="600">
            X
          </text>
        </g>
      ))}
      {/* Nested at the origin: one unit of the logo is one unit of this drawing. */}
      <ZLogo height={MARK.size} />
    </svg>
  );
}

function Swatch({ name, hex, use, color, textOnColor = "#fff", bordered = false }: { name: string; hex: string; use: string; color: string; textOnColor?: string; bordered?: boolean }) {
  return (
    <div className="zb-tile">
      <div className={cn("flex h-28 items-end p-3", bordered && "border-b")} style={{ background: color, color: textOnColor }}>
        <span className="zb-mono" dir="ltr">
          {hex}
        </span>
      </div>
      <div className="space-y-0.5 p-3">
        <p className="text-sm font-semibold">{name}</p>
        <p className="zb-soft text-xs leading-relaxed">{use}</p>
      </div>
    </div>
  );
}

const SCALE: Array<{ key: "display" | "h1" | "h2" | "h3" | "body" | "small" | "label" | "button" | "caption"; spec: string; style: CSSProperties; sample: "sampleDisplay" | "sampleHeading" | "sampleBody" | "sampleLabel" | "btnPrimary" | "sampleCaption" }> = [
  { key: "display", spec: "48 / 52 · 700", style: { fontSize: 48, lineHeight: "52px", fontWeight: 700, letterSpacing: "-0.02em" }, sample: "sampleDisplay" },
  { key: "h1", spec: "36 / 42 · 700", style: { fontSize: 36, lineHeight: "42px", fontWeight: 700, letterSpacing: "-0.015em" }, sample: "sampleHeading" },
  { key: "h2", spec: "28 / 36 · 650", style: { fontSize: 28, lineHeight: "36px", fontWeight: 650, letterSpacing: "-0.01em" }, sample: "sampleHeading" },
  { key: "h3", spec: "20 / 28 · 600", style: { fontSize: 20, lineHeight: "28px", fontWeight: 600 }, sample: "sampleHeading" },
  { key: "body", spec: "16 / 26 · 400", style: { fontSize: 16, lineHeight: "26px", fontWeight: 400 }, sample: "sampleBody" },
  { key: "small", spec: "14 / 22 · 400", style: { fontSize: 14, lineHeight: "22px", fontWeight: 400 }, sample: "sampleBody" },
  { key: "label", spec: "13 / 18 · 500", style: { fontSize: 13, lineHeight: "18px", fontWeight: 500 }, sample: "sampleLabel" },
  { key: "button", spec: "14 / 20 · 600", style: { fontSize: 14, lineHeight: "20px", fontWeight: 600 }, sample: "btnPrimary" },
  { key: "caption", spec: "12 / 16 · 500", style: { fontSize: 12, lineHeight: "16px", fontWeight: 500, letterSpacing: "0.02em" }, sample: "sampleCaption" },
];

function Window({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("zb-win w-full", className)}>
      <div className="zb-chrome">
        <span className="zb-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="zb-tab -mb-[7px] min-w-0">
          <ZAppIcon size={14} markRatio={0.64} />
          <span className="truncate">{title}</span>
        </span>
      </div>
      {children}
    </div>
  );
}

/** Proposed ZIMOS identity, presented as one brand board inside the design lab. */
export function BrandBoard() {
  const t = useT(BRAND_MESSAGES);
  const names = useT(LAB_MESSAGES);
  const { dir, intlLocale } = useLocale();
  const money = (minor: number) =>
    new Intl.NumberFormat(intlLocale, { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(minor / 100);
  const number = (value: number) => new Intl.NumberFormat(intlLocale).format(value);
  const orders = [
    { id: "ZM-1048", name: names.sara, amount: 125000, status: t.stNew, tone: undefined },
    { id: "ZM-1047", name: names.nour, amount: 89000, status: t.stShipped, tone: "cyan" },
    { id: "ZM-1046", name: names.mona, amount: 234000, status: t.stDelivered, tone: "muted" },
  ] as const;
  const nav = [t.navOverview, t.navOrders, t.navProducts, t.navCustomers, t.navAnalytics, t.navApps, t.navBilling];
  const bars = [34, 52, 41, 66, 58, 80, 72];

  return (
    <div className="zb space-y-12 p-5 sm:p-8" dir={dir}>
      <header className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-end">
        <div>
          <p className="zb-eyebrow">{t.eyebrow}</p>
          <div className="mt-6 flex">
            <ZLogo height={64} className="max-w-full" />
          </div>
          <h2 className="mt-8 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">{t.title}</h2>
          <p className="zb-soft mt-3 max-w-xl text-sm leading-relaxed">{t.intro}</p>
        </div>
        <div className="space-y-4">
          <div className="flex h-2 overflow-hidden rounded-sm" dir="ltr" aria-hidden>
            <span className="bg-[var(--zb-navy)]" style={{ width: "70%" }} />
            <span className="bg-[var(--zb-blue)]" style={{ width: "20%" }} />
            <span className="bg-[var(--zb-cyan)]" style={{ width: "10%" }} />
          </div>
          <ul className="grid grid-cols-3 gap-3 text-xs">
            {(
              [
                ["70%", t.mixProduct],
                ["20%", t.mixCommerce],
                ["10%", t.mixMotion],
              ] as const
            ).map(([share, label]) => (
              <li key={label}>
                <span className="block text-lg font-bold tabular-nums">{share}</span>
                <span className="zb-soft">{label}</span>
              </li>
            ))}
          </ul>
          <p className="zb-soft border-t pt-3 text-xs leading-relaxed">{t.proposalNote}</p>
        </div>
      </header>

      <Group id="zb-logos" title={t.logos} description={t.logosDesc}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Tile label={t.primary} note={t.primaryNote} className="xl:col-span-2">
            <ZLogo height={56} className="max-w-full" />
          </Tile>
          <Tile label={t.tagline} note={t.taglineNote} className="xl:col-span-2">
            <ZTaglineLockup height={48} />
          </Tile>
          <Tile label={t.iconOnly} note={t.iconOnlyNote}>
            <ZMark size={84} style={{ color: "var(--zb-blue)" }} />
          </Tile>
          <Tile label={t.wordmark} note={t.wordmarkNote}>
            <ZWordmark height={34} className="max-w-full" />
          </Tile>
          <Tile label={t.onLight} tone="surface">
            <ZLogo height={40} className="max-w-full" />
          </Tile>
          <Tile label={t.onDark} tone="navy">
            <ZLogo height={40} tone="dark" className="max-w-full" />
          </Tile>
        </div>
      </Group>

      <Group id="zb-versions" title={t.versions} description={t.versionsDesc}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Tile label={t.fullColor}>
            <ZLogo height={40} className="max-w-full" />
          </Tile>
          <Tile label={t.solidNavy}>
            <ZLogo height={40} tone="navy" className="max-w-full" />
          </Tile>
          <Tile label={t.solidBlack}>
            <ZLogo height={40} tone="black" className="max-w-full" />
          </Tile>
          <Tile label={t.solidWhite} tone="black">
            <ZLogo height={40} tone="white" className="max-w-full" />
          </Tile>
          <Tile label={t.reversed} note={t.reversedNote} tone="blue">
            <ZLogo height={40} tone="white" className="max-w-full" />
          </Tile>
          <Tile label={t.gradient} note={t.gradientNote}>
            <ZLogo height={40} gradient className="max-w-full" />
          </Tile>
        </div>
      </Group>

      <Group id="zb-icons" title={t.icons} description={t.iconsDesc}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label={t.ios} tone="surface">
            <ZAppIcon size={104} />
          </Tile>
          <Tile label={t.android} tone="surface">
            <ZAppIcon size={104} shape="circle" />
          </Tile>
          <Tile label={t.sidebar} layout="fill">
            <div className="zb-side flex w-14 flex-col items-center gap-3 py-4">
              <ZMark size={24} style={{ color: "#fff" }} />
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn("h-1.5 w-6 rounded-sm", i === 0 ? "bg-white" : "bg-white/25")} />
              ))}
            </div>
            <div className="flex flex-1 flex-col gap-2 bg-[var(--zb-surface)] p-4">
              <span className="h-2 w-2/3 rounded-sm bg-[#dbe2f0]" />
              <span className="h-2 w-1/2 rounded-sm bg-[#dbe2f0]" />
              <span className="mt-2 h-14 rounded-md border bg-white" />
            </div>
          </Tile>
          <Tile label={t.favicon} layout="tight">
            <Window title={t.tabTitle} className="self-center">
              <div className="flex items-center gap-2 p-3">
                <span className="h-2 flex-1 rounded-sm bg-[#e3e8f2]" />
                <span className="h-2 w-10 rounded-sm bg-[#e3e8f2]" />
              </div>
            </Window>
          </Tile>
          <Tile label={t.micro} note={t.microNote} className="sm:col-span-2">
            <div className="flex flex-wrap items-end justify-center gap-8" dir="ltr">
              {[16, 20, 24, 32].map((size) => (
                <span key={size} className="flex flex-col items-center gap-2">
                  <ZMark size={size} />
                  <span className="zb-mono zb-soft">{size}</span>
                </span>
              ))}
            </div>
          </Tile>
          <Tile label={t.pixelGrid} note={t.pixelGridNote}>
            <svg viewBox="0 0 16 16" className="size-28" shapeRendering="geometricPrecision" aria-hidden>
              {MICRO_PATHS.map((d) => (
                <path key={d} d={d} fill="#081F5C" />
              ))}
              {Array.from({ length: 17 }, (_, i) => i).map((v) => (
                <g key={v} stroke="#12C8DA" strokeOpacity="0.55" strokeWidth="0.04">
                  <line x1={v} y1="0" x2={v} y2="16" />
                  <line x1="0" y1={v} x2="16" y2={v} />
                </g>
              ))}
            </svg>
          </Tile>
          <Tile label={t.pinned} note={t.pinnedNote}>
            <ZMark size={40} drawing="micro" style={{ color: "#000" }} />
          </Tile>
        </div>
      </Group>

      <Group id="zb-construction" title={t.construction} description={t.constructionDesc}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Tile label={t.grid} note={t.gridNote}>
            <ConstructionGrid t={t} />
          </Tile>
          <div className="grid gap-4">
            <Tile label={t.clear} note={`${t.clearNote} · ${t.clearMin} · ${t.clearPremium}`}>
              <ClearSpace />
            </Tile>
            <Tile label={t.minimum} note={`${t.screen} / ${t.print}`}>
              <ul className="grid w-full grid-cols-3 gap-4 text-xs" dir="ltr">
                <li className="flex flex-col items-center gap-3">
                  <ZMark size={16} />
                  <span className="text-center">
                    <span className="block font-semibold">{t.minIcon}</span>
                    <span className="zb-soft zb-mono">16 px · 5 mm</span>
                  </span>
                </li>
                <li className="flex flex-col items-center gap-3">
                  <ZLogo height={20} tone="navy" />
                  <span className="text-center">
                    <span className="block font-semibold">{t.minLogo}</span>
                    <span className="zb-soft zb-mono">76 px · 20 mm</span>
                  </span>
                </li>
                <li className="flex flex-col items-center gap-3">
                  <ZTaglineLockup height={28} tone="navy" />
                  <span className="text-center">
                    <span className="block font-semibold">{t.minTagline}</span>
                    <span className="zb-soft zb-mono">120 px · 32 mm</span>
                  </span>
                </li>
              </ul>
            </Tile>
          </div>
        </div>
      </Group>

      <Group id="zb-colour" title={t.colour} description={t.colourDesc}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Swatch name={t.navy} hex="#081F5C" use={t.navyUse} color="var(--zb-navy)" />
          <Swatch name={t.blue} hex="#165DFF" use={t.blueUse} color="var(--zb-blue)" />
          <Swatch name={t.cyan} hex="#12C8DA" use={t.cyanUse} color="var(--zb-cyan)" textOnColor="#081F5C" />
          <Swatch name={t.surface} hex="#F6F9FF" use={t.surfaceUse} color="var(--zb-surface)" textOnColor="#081F5C" bordered />
          <Swatch name={t.white} hex="#FFFFFF" use={t.whiteUse} color="#fff" textOnColor="#081F5C" bordered />
        </div>
        <div className="zb-tile">
          <div className="space-y-3 p-4">
            <p className="text-sm font-semibold">{t.balance}</p>
            <div className="flex h-3 overflow-hidden rounded-sm border" dir="ltr" aria-hidden>
              <span className="bg-white" style={{ width: "62%" }} />
              <span className="bg-[var(--zb-surface)]" style={{ width: "12%" }} />
              <span className="bg-[var(--zb-navy)]" style={{ width: "14%" }} />
              <span className="bg-[var(--zb-blue)]" style={{ width: "9%" }} />
              <span className="bg-[var(--zb-cyan)]" style={{ width: "3%" }} />
            </div>
            <ul className="zb-soft flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <li>{t.contrastNavy}</li>
              <li>{t.contrastBlue}</li>
              <li>{t.contrastCyan}</li>
            </ul>
          </div>
        </div>
      </Group>

      <Group id="zb-type" title={t.type} description={t.typeDesc}>
        <div className="zb-tile divide-y">
          <div className="zb-soft grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 px-4 py-2 text-xs md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)]">
            <span />
            <span>{t.latin} · Inter</span>
            <span className="hidden md:block">{t.arabic} · Noto Sans Arabic</span>
          </div>
          {SCALE.map((row) => (
            <div key={row.key} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-baseline gap-4 px-4 py-3 md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="text-xs">
                <span className="block font-semibold">{t[row.key]}</span>
                <span className="zb-soft zb-mono" dir="ltr">
                  {row.spec}
                </span>
              </div>
              <p dir="ltr" lang="en" className="min-w-0 text-start [overflow-wrap:anywhere]" style={row.style}>
                {BRAND_MESSAGES.en[row.sample]}
              </p>
              <p dir="rtl" lang="ar" className="min-w-0 [overflow-wrap:anywhere] max-md:col-start-2" style={{ ...row.style, letterSpacing: 0 }}>
                {BRAND_MESSAGES.ar[row.sample]}
              </p>
            </div>
          ))}
        </div>
      </Group>

      <Group id="zb-buttons" title={t.buttons} description={t.buttonsDesc}>
        <div className="zb-tile">
          <div className="flex flex-wrap items-center gap-3 p-5">
            <button type="button" className="zb-btn" data-variant="primary">
              {t.btnPrimary}
            </button>
            <button type="button" className="zb-btn" data-variant="navy">
              {t.btnNavy}
            </button>
            <button type="button" className="zb-btn" data-variant="outline">
              {t.btnOutline}
            </button>
            <button type="button" className="zb-btn" data-variant="ghost">
              {t.btnGhost}
            </button>
            <button type="button" className="zb-btn" data-variant="danger">
              {t.btnDanger}
            </button>
            <button type="button" className="zb-btn" data-variant="primary" disabled>
              {t.btnDisabled}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t p-5">
            <span className="zb-soft text-xs">{t.sizes}</span>
            {(["sm", "md", "lg"] as const).map((size) => (
              <button key={size} type="button" className="zb-btn" data-variant="primary" data-size={size}>
                {t.btnPrimary}
              </button>
            ))}
            {(["sm", "md", "lg"] as const).map((size) => (
              <button key={size} type="button" className="zb-btn" data-variant="outline" data-size={size}>
                {t.btnOutline}
              </button>
            ))}
          </div>
        </div>
      </Group>

      <Group id="zb-graphics" title={t.graphics} description={t.graphicsDesc}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label={t.panels} tone="navy" className="sm:col-span-2" layout="tight">
            <div className="grid w-full grid-cols-3 gap-2" dir="ltr" aria-hidden>
              {[1, 0.5, 0.2, 0.2, 1, 0.5, 0.5, 0.2, 1].map((opacity, i) => (
                <span key={i} className="zb-cut h-9" style={{ background: i === 4 ? "var(--zb-cyan)" : "var(--zb-blue)", opacity }} />
              ))}
            </div>
          </Tile>
          <Tile label={t.loading} note={t.loadingNote}>
            <svg viewBox="-40 0 180 100" className="zb-loader h-16 w-28" role="img" aria-label={t.loading}>
              <g fill="#165DFF">
                {MASTER_PATHS.map((d) => (
                  <path key={d} d={d} />
                ))}
              </g>
            </svg>
          </Tile>
          <Tile label={t.progress} note={t.progressStep}>
            <div className="w-full space-y-4">
              <div className="zb-progress px-2" aria-hidden>
                <i data-done />
                <i data-current />
                <i />
                <i />
              </div>
              <div className="zb-progress px-2" aria-hidden>
                <i data-done />
                <i data-done />
                <i data-done />
                <i data-current />
              </div>
            </div>
          </Tile>
          <Tile label={t.divider} className="sm:col-span-2" layout="bare">
            <div className="flex w-full items-center gap-3" dir="ltr" aria-hidden>
              <span className="h-px flex-1 bg-[var(--zb-line)]" />
              <ZMark size={16} style={{ color: "var(--zb-blue)" }} />
              <span className="h-px flex-1 bg-[var(--zb-line)]" />
            </div>
          </Tile>
          <Tile label={t.empty} className="sm:col-span-2" tone="surface">
            <div className="flex flex-col items-center gap-3 text-center">
              <svg viewBox="-2 -2 104 104" className="size-12" aria-hidden>
                {MASTER_PATHS.map((d, i) => (
                  <path key={d} d={d} fill={i === 1 ? "#165DFF" : "none"} fillOpacity="0.12" stroke={i === 1 ? "#165DFF" : "#b9c4dc"} strokeWidth="2" strokeDasharray={i === 1 ? undefined : "5 4"} />
                ))}
              </svg>
              <div>
                <p className="text-sm font-semibold">{t.emptyTitle}</p>
                <p className="zb-soft text-xs">{t.emptyBody}</p>
              </div>
              <button type="button" className="zb-btn" data-variant="primary" data-size="sm">
                {t.btnPrimary}
              </button>
            </div>
          </Tile>
        </div>
      </Group>

      <Group id="zb-ui" title={t.ui} description={t.uiDesc}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Tile label={t.dashboard} note={t.sample} tone="surface" layout="top">
            <Window title={t.tabTitle}>
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] max-sm:grid-cols-1">
                <aside className="zb-side space-y-3 p-3 max-sm:hidden">
                  <ZLogo height={18} tone="white" />
                  <ul className="space-y-0.5">
                    {nav.map((item, i) => (
                      <li key={item} aria-current={i === 1 ? "page" : undefined} className="rounded px-2 py-1">
                        {item}
                      </li>
                    ))}
                  </ul>
                </aside>
                <div className="min-w-0 space-y-3 bg-[var(--zb-surface)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm">{t.navOrders}</strong>
                    <div className="flex items-center gap-2">
                      <span className="zb-field zb-soft flex w-24 items-center px-2">{t.search}</span>
                      <button type="button" className="zb-btn" data-variant="primary" data-size="sm">
                        {t.btnPrimary}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        [t.kpiOrders, number(128)],
                        [t.kpiRevenue, money(4480000)],
                        [t.kpiRate, new Intl.NumberFormat(intlLocale, { style: "percent" }).format(0.82)],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label} className="rounded-md border bg-white p-2">
                        <span className="zb-soft block">{label}</span>
                        <span className="text-sm font-bold tabular-nums">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-md border bg-white p-2">
                    <span className="zb-soft">{t.chart}</span>
                    <svg viewBox="0 0 140 40" className="mt-1 h-16 w-full" preserveAspectRatio="none" aria-hidden>
                      {bars.map((h, i) => (
                        <rect key={i} x={i * 20 + 4} y={40 - h * 0.45} width="12" height={h * 0.45} rx="1.5" fill={i === bars.length - 1 ? "#12C8DA" : "#165DFF"} fillOpacity={i === bars.length - 1 ? 1 : 0.22 + i * 0.12} />
                      ))}
                    </svg>
                  </div>
                  <table className="w-full overflow-hidden rounded-md border bg-white text-start">
                    <thead className="zb-soft">
                      <tr className="border-b">
                        {[t.order, t.customer, t.status, t.amount].map((heading, i) => (
                          <th key={heading} className={cn("px-2 py-1.5 font-medium", i === 3 ? "text-end" : "text-start")}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((row) => (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="px-2 py-1.5 font-semibold tabular-nums">
                            <bdi dir="ltr">{row.id}</bdi>
                          </td>
                          <td className="px-2 py-1.5">{row.name}</td>
                          <td className="px-2 py-1.5">
                            <span className="zb-pill" data-tone={row.tone}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-end font-semibold tabular-nums">{money(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Window>
          </Tile>
          <Tile label={t.mobile} note={t.sample} tone="surface" layout="tight">
            <div className="zb-phone">
              <div className="flex items-center justify-between bg-[var(--zb-navy)] px-3 py-2.5 text-white">
                <ZMark size={18} style={{ color: "#fff" }} />
                <strong>{t.navOrders}</strong>
                <span className="size-4 rounded-full bg-white/25" aria-hidden />
              </div>
              <ul className="divide-y">
                {orders.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <span className="min-w-0">
                      <bdi dir="ltr" className="block font-semibold">
                        {row.id}
                      </bdi>
                      <span className="zb-soft block truncate">{row.name}</span>
                    </span>
                    <span className="text-end">
                      <span className="block font-semibold tabular-nums">{money(row.amount)}</span>
                      <span className="zb-pill" data-tone={row.tone}>
                        {row.status}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-4 border-t px-2 py-2" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="mx-auto h-1.5 w-6 rounded-sm" style={{ background: i === 1 ? "var(--zb-blue)" : "#dbe2f0" }} />
                ))}
              </div>
            </div>
          </Tile>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Tile label={t.login} tone="surface" layout="tight">
            <div className="zb-win w-full space-y-2.5 p-4">
              <ZLogo height={18} />
              <p className="pt-1 text-sm font-bold">{t.welcome}</p>
              <label className="block space-y-1">
                <span className="font-medium">{t.email}</span>
                <span className="zb-field block" />
              </label>
              <label className="block space-y-1">
                <span className="font-medium">{t.password}</span>
                <span className="zb-field block" />
              </label>
              <button type="button" className="zb-btn w-full" data-variant="primary" data-size="sm">
                {t.signIn}
              </button>
            </div>
          </Tile>
          <Tile label={t.onboarding} tone="surface" layout="tight">
            <div className="zb-win w-full space-y-3 p-4">
              <p className="text-sm font-bold">{t.setup}</p>
              <div className="zb-progress" aria-hidden>
                <i data-done />
                <i data-current />
                <i />
                <i />
              </div>
              <ol className="space-y-1.5">
                {[t.stepStore, t.stepProducts, t.stepPayments, t.stepLaunch].map((step, i) => (
                  <li key={step} className={cn("flex items-center gap-2", i > 1 && "zb-soft")}>
                    <span
                      className="flex size-4 items-center justify-center rounded-sm text-[9px] font-bold tabular-nums"
                      style={{ background: i === 0 ? "var(--zb-blue)" : i === 1 ? "var(--zb-cyan)" : "#e3e8f2", color: i === 0 ? "#fff" : "var(--zb-navy)" }}
                    >
                      {number(i + 1)}
                    </span>
                    <span className={cn(i === 1 && "font-semibold")}>{step}</span>
                  </li>
                ))}
              </ol>
              <button type="button" className="zb-btn" data-variant="primary" data-size="sm">
                {t.next}
              </button>
            </div>
          </Tile>
          <Tile label={t.builder} tone="surface" layout="tight">
            <div className="zb-win grid w-full grid-cols-[4.5rem_minmax(0,1fr)]">
              <div className="space-y-1 border-e p-2">
                <span className="zb-soft block">{t.sections}</span>
                {[t.secHeader, t.secHero, t.secProducts, t.secFooter].map((section, i) => (
                  <span key={section} className={cn("block truncate rounded px-1.5 py-1", i === 1 && "bg-[var(--zb-blue-soft)] font-semibold text-[var(--zb-blue)]")}>
                    {section}
                  </span>
                ))}
              </div>
              <div className="space-y-1.5 bg-[var(--zb-surface)] p-2" aria-hidden>
                <span className="block h-3 rounded-sm border bg-white" />
                <span className="block h-12 rounded-sm border-2 border-[var(--zb-blue)] bg-white" />
                <span className="grid grid-cols-3 gap-1">
                  <span className="h-7 rounded-sm border bg-white" />
                  <span className="h-7 rounded-sm border bg-white" />
                  <span className="h-7 rounded-sm border bg-white" />
                </span>
                <span className="block h-3 rounded-sm border bg-white" />
              </div>
            </div>
          </Tile>
          <Tile label={t.marketplace} tone="surface" layout="tight">
            <ul className="grid w-full grid-cols-2 gap-2 text-[11px]">
              {[t.appShipping, t.appPayments, t.appMessages, t.appReports].map((app, i) => (
                <li key={app} className="space-y-2 rounded-md border bg-white p-2">
                  <span className="zb-cut block h-5 w-9" style={{ background: i === 2 ? "var(--zb-cyan)" : i === 0 ? "var(--zb-navy)" : "var(--zb-blue)", opacity: i === 3 ? 0.4 : 1 }} aria-hidden />
                  <span className="block truncate font-semibold">{app}</span>
                  <span className="zb-pill" data-tone={i === 0 ? "muted" : undefined}>
                    {i === 0 ? t.installed : t.install}
                  </span>
                </li>
              ))}
            </ul>
          </Tile>
          <Tile label={t.billing} tone="surface" layout="tight">
            <div className="zb-win w-full space-y-2.5 p-3">
              <div className="flex items-start justify-between gap-2">
                <span>
                  <span className="zb-soft block">{t.plan}</span>
                  <strong className="text-sm">{t.planName}</strong>
                </span>
                <button type="button" className="zb-btn" data-variant="outline" data-size="sm">
                  {t.change}
                </button>
              </div>
              <div className="border-t pt-2">
                <span className="zb-soft block pb-1">{t.invoices}</span>
                {["INV-0042", "INV-0041"].map((invoice) => (
                  <div key={invoice} className="flex items-center justify-between gap-2 py-1">
                    <bdi dir="ltr" className="font-semibold">
                      {invoice}
                    </bdi>
                    <span className="zb-pill" data-tone="cyan">
                      {t.paid}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Tile>
        </div>
      </Group>

      <Group id="zb-misuse" title={t.misuse} description={t.misuseDesc}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label={t.noStretch} className="zb-wrong">
            <ZLogo height={30} style={{ transform: "scaleX(1.45)" }} />
          </Tile>
          <Tile label={t.noRotate} className="zb-wrong">
            <ZLogo height={32} style={{ transform: "rotate(-14deg)" }} />
          </Tile>
          <Tile label={t.noGlow} className="zb-wrong">
            <ZLogo height={34} style={{ filter: "drop-shadow(0 0 9px #165DFF) drop-shadow(0 6px 6px rgb(8 31 92 / 0.45))" }} />
          </Tile>
          <Tile label={t.noRibbon} className="zb-wrong">
            <ZMark size={64} gradient style={{ transform: "perspective(180px) rotateY(38deg) skewY(-8deg)", filter: "drop-shadow(8px 8px 0 rgb(8 31 92 / 0.35))" }} />
          </Tile>
          <Tile label={t.noOutline} className="zb-wrong">
            <svg viewBox="-3 -3 106 106" className="size-16" aria-hidden>
              {MASTER_PATHS.map((d) => (
                <path key={d} d={d} fill="none" stroke="#165DFF" strokeWidth="3" />
              ))}
            </svg>
          </Tile>
          <Tile label={t.noColour} className="zb-wrong">
            <ZLogo height={34} style={{ filter: "hue-rotate(115deg) saturate(1.4)" }} />
          </Tile>
          <Tile label={t.noCrowd} className="zb-wrong" tone="busy">
            <ZLogo height={34} />
          </Tile>
          <Tile label={t.noRetype} className="zb-wrong">
            <span className="flex items-center gap-3" dir="ltr">
              <ZMark size={40} style={{ color: "var(--zb-blue)" }} />
              <span style={{ fontFamily: "Georgia, serif", fontSize: 30, fontStyle: "italic" }}>Zimos</span>
            </span>
          </Tile>
        </div>
      </Group>
    </div>
  );
}
