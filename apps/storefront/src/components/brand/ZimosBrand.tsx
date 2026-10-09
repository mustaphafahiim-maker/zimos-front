import type { CSSProperties } from "react";
import { CAP, STEM, WORDMARK } from "./geometry";

// A copy of apps/merchant-dashboard/src/brand/ZimosBrand.tsx — keep the two in step.
const cn = (...classes: Array<string | undefined | false>) => classes.filter(Boolean).join(" ");

/**
 * The ZIMOS identity as components: the mark, the wordmark, the lockups and
 * the app icon, all drawn from `geometry.ts`. `components/ZimosLogo.tsx`
 * renders these in the dashboard; the design lab shows the full system.
 *
 * Colours come from the brand board's own tokens (`--zb-*`) when it is on
 * screen, and from the product's tokens everywhere else.
 */

/**
 * The sliced Z (brand identity 2026): the letter cut into the five lanes an order travels —
 * ordered, paid, packed, shipped, delivered. Four lanes take the logo's colour; the middle one,
 * "where the order is now", takes the accent. In ZIMOS's own palette the accent is Product Blue
 * on a light surface and Cyan on a dark one (the identity's orange is not used).
 */
const Z_BOX = { width: 112, height: 100 };
const Z_LANES = "M0 0H112V16H0Z M57.44 21H107.44L92.85 37H42.85Z M19.15 63H69.15L54.56 79H4.56Z M0 84H112V100H0Z";
const Z_NOW = "M38.29 42H88.29L73.71 58H23.71Z";
/** Space between the Z and the I, in the wordmark's own units. */
const Z_GAP = 15;

/** Colours per logo version: [the lanes and the letters, the accent lane]. */
const TONES = {
  color: ["var(--zb-navy, var(--color-ink))", "var(--zb-blue, var(--color-primary))"],
  navy: ["var(--zb-navy, var(--color-ink))", "var(--zb-navy, var(--color-ink))"],
  /** The brand colours themselves, for a surface that is light in both themes. */
  fixed: ["#081F5C", "#165DFF"],
  /** The brand's own colours whatever the host palette: a store or the console has its own primary. */
  brand: ["var(--zimos-word, #081F5C)", "#165DFF"],
  black: ["#000000", "#000000"],
  white: ["#ffffff", "#ffffff"],
  /** For dark surfaces: white lanes and letters, the accent lane in Cyan. */
  dark: ["#ffffff", "#12C8DA"],
} as const;
export type BrandTone = keyof typeof TONES;

interface MarkProps {
  /** Rendered width in px (the Z is a little wider than tall: the height is 100/112 of it). */
  size?: number;
  /** Kept for callers of the previous mark; the sliced Z has one drawing. */
  drawing?: "master" | "micro";
  /** Kept for callers of the previous mark; the sliced Z is never drawn as a gradient. */
  gradient?: boolean;
  /** The accent lane's colour. Defaults to Product Blue; at 16 px and below it takes the lanes' colour. */
  accent?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

/** The sliced Z: four lanes in the current text colour, the middle lane in the accent. */
export function ZMark({ size = 48, accent, className, style, title }: MarkProps) {
  // The identity's rule for 16 px: one colour, the accent would only be a smudge.
  const now = size <= 16 ? "currentColor" : (accent ?? "var(--zb-blue, #165dff)");
  return (
    <svg
      width={size}
      height={(size * Z_BOX.height) / Z_BOX.width}
      viewBox={`0 0 ${Z_BOX.width} ${Z_BOX.height}`}
      className={cn("shrink-0", className)}
      style={style}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={Z_LANES} fill="currentColor" />
      <path d={Z_NOW} style={{ fill: now }} />
    </svg>
  );
}

function WordmarkGlyphs({ color, glyphs = WORDMARK.glyphs }: { color: string; glyphs?: typeof WORDMARK.glyphs }) {
  return (
    <>
      {glyphs.map((glyph) =>
        glyph.kind === "fill" ? (
          <path key={glyph.x} d={glyph.d} transform={`translate(${glyph.x} 0)`} style={{ fill: color }} />
        ) : glyph.kind === "stroke" ? (
          <path key={glyph.x} d={glyph.d} transform={`translate(${glyph.x} 0)`} fill="none" strokeWidth={STEM} style={{ stroke: color }} />
        ) : (
          <rect
            key={glyph.x}
            x={glyph.x + STEM / 2}
            y={STEM / 2}
            width={glyph.width - STEM}
            height={CAP - STEM}
            rx={glyph.rx}
            ry={glyph.ry}
            fill="none"
            strokeWidth={STEM}
            style={{ stroke: color }}
          />
        )
      )}
    </>
  );
}

/** ZIMOS, drawn — never typed in a font. */
export function ZWordmark({ height = 24, className, title = "ZIMOS" }: { height?: number; className?: string; title?: string }) {
  return (
    <svg
      height={height}
      width={(height * WORDMARK.width) / CAP}
      viewBox={`0 0 ${WORDMARK.width} ${CAP}`}
      className={cn("shrink-0", className)}
      role="img"
      aria-label={title}
    >
      <WordmarkGlyphs color="currentColor" />
    </svg>
  );
}

interface LogoProps {
  /** Height of the mark in px; the wordmark follows. */
  height?: number;
  tone?: BrandTone;
  gradient?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** The letters after the Z, as drawn in geometry.ts, set back to start at zero. */
const IMOS = WORDMARK.glyphs.slice(1);
const IMOS_START = IMOS[0]?.x ?? 0;
const LOGO_WIDTH = Z_BOX.width + Z_GAP + (WORDMARK.width - IMOS_START);
/** The logo is one line of capitals; it is drawn a little under the asked height so it sits like the old lockup did. */
const LOGO_SCALE = 0.86;

/**
 * Primary logo: the sliced Z IS the first letter of the name — Z, then I M O S drawn at the same cap
 * height — never a symbol beside the word. No tagline.
 */
export function ZLogo({ height = 40, tone = "color", className, style }: LogoProps) {
  const [ink, now] = TONES[tone];
  const h = height * LOGO_SCALE;
  return (
    <svg
      height={h}
      width={(h * LOGO_WIDTH) / CAP}
      viewBox={`0 0 ${LOGO_WIDTH} ${CAP}`}
      className={cn("shrink-0", className)}
      style={style}
      role="img"
      aria-label="ZIMOS"
    >
      <path d={Z_LANES} style={{ fill: ink }} />
      <path d={Z_NOW} style={{ fill: now }} />
      <g transform={`translate(${Z_BOX.width + Z_GAP - IMOS_START} 0)`}>
        <WordmarkGlyphs color={ink} glyphs={IMOS} />
      </g>
    </svg>
  );
}
/** Secondary lockup. The tagline is never needed to recognise the logo. */
export function ZTaglineLockup({ height = 40, tone = "color", className }: LogoProps) {
  const soft = tone === "white" || tone === "dark";
  return (
    <span className={cn("inline-flex flex-col items-start", className)} dir="ltr" style={{ gap: height * 0.5 }}>
      <ZLogo height={height} tone={tone} />
      <span
        className="zb-tagline"
        style={{ fontSize: Math.max(9, height * 0.22), color: soft ? "rgb(255 255 255 / 0.78)" : "var(--zb-ink-soft, var(--color-ink-soft))" }}
      >
        Commerce, in motion.
      </span>
    </span>
  );
}

interface AppIconProps {
  size?: number;
  /** `squircle` for iOS and the dashboard, `circle` for Android's round mask. */
  shape?: "squircle" | "circle";
  surface?: "navy" | "blue" | "white";
  /** Share of the side the Z takes. Half by default; favicons need a little more. */
  markRatio?: number;
  className?: string;
}

/** App icon: the sliced Z alone, centred in a Deep Navy container; its accent lane is Cyan there. */
export function ZAppIcon({ size = 96, shape = "squircle", surface = "navy", markRatio = 0.5, className }: AppIconProps) {
  const background = surface === "navy" ? "var(--zb-navy, #081f5c)" : surface === "blue" ? "var(--zb-blue, #165dff)" : "#ffffff";
  const color = surface === "white" ? "var(--zb-navy, #081f5c)" : "#ffffff";
  const accent = surface === "navy" ? "#12C8DA" : surface === "blue" ? "#081F5C" : "var(--zb-blue, #165dff)";
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", surface === "white" && "border border-[var(--zb-line,var(--color-line))]", className)}
      style={{ width: size, height: size, background, color, borderRadius: shape === "circle" ? "50%" : size * 0.225 }}
      aria-hidden
    >
      <ZMark size={Math.round(size * (markRatio + 0.08))} accent={accent} />
    </span>
  );
}
