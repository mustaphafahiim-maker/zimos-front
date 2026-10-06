import { useId, type CSSProperties } from "react";
import { cn } from "@store-builder/ui";
import { CAP, LOCKUP, MARK, MICRO, STEM, WORDMARK, markPaths } from "./geometry";

/**
 * The ZIMOS identity as components: the mark, the wordmark, the lockups and
 * the app icon, all drawn from `geometry.ts`. `components/ZimosLogo.tsx`
 * renders these in the dashboard; the design lab shows the full system.
 *
 * Colours come from the brand board's own tokens (`--zb-*`) when it is on
 * screen, and from the product's tokens everywhere else.
 */

const MASTER_PATHS = markPaths(MARK);
const MICRO_PATHS = markPaths(MICRO);

/** Colours per logo version: [mark, wordmark]. */
const TONES = {
  color: ["var(--zb-blue, var(--color-primary))", "var(--zb-navy, var(--color-ink))"],
  navy: ["var(--zb-navy, var(--color-ink))", "var(--zb-navy, var(--color-ink))"],
  /** The brand colours themselves, for a surface that is light in both themes. */
  fixed: ["#165DFF", "#081F5C"],
  black: ["#000000", "#000000"],
  white: ["#ffffff", "#ffffff"],
  /** For dark surfaces: the mark keeps its blue, the wordmark turns white. */
  dark: ["var(--zb-blue, #5b8df6)", "#ffffff"],
} as const;
export type BrandTone = keyof typeof TONES;

interface MarkProps {
  /** Rendered size in px. 32 px and below switch to the small-size drawing. */
  size?: number;
  /** Force the master or the small-size drawing. */
  drawing?: "master" | "micro";
  /** Optional digital treatment: Product Blue to Cyan along the diagonal. */
  gradient?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

/** The Z: three modules, filled with the current text colour. */
export function ZMark({ size = 48, drawing, gradient = false, className, style, title }: MarkProps) {
  const gradientId = useId();
  const micro = (drawing ?? (size <= 32 ? "micro" : "master")) === "micro";
  const box = micro ? MICRO.size : MARK.size;
  const paths = micro ? MICRO_PATHS : MASTER_PATHS;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${box} ${box}`}
      className={cn("shrink-0", className)}
      style={style}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {gradient && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#165DFF" />
            <stop offset="1" stopColor="#12C8DA" />
          </linearGradient>
        </defs>
      )}
      <g fill={gradient ? `url(#${gradientId})` : "currentColor"}>
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

function WordmarkGlyphs({ color }: { color: string }) {
  return (
    <>
      {WORDMARK.glyphs.map((glyph) =>
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

/** Primary logo: the mark, then the wordmark. No tagline. */
export function ZLogo({ height = 40, tone = "color", gradient = false, className, style }: LogoProps) {
  const gradientId = useId();
  const [mark, word] = TONES[tone];
  const offset = (MARK.size - CAP * LOCKUP.scale) / 2;
  return (
    <svg
      height={height}
      width={(height * LOCKUP.width) / MARK.size}
      viewBox={`0 0 ${LOCKUP.width} ${MARK.size}`}
      className={cn("shrink-0", className)}
      style={style}
      role="img"
      aria-label="ZIMOS"
    >
      {gradient && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0" gradientUnits="objectBoundingBox">
            <stop offset="0" stopColor="#165DFF" />
            <stop offset="1" stopColor="#12C8DA" />
          </linearGradient>
        </defs>
      )}
      <g style={{ fill: gradient ? `url(#${gradientId})` : mark }}>
        {MASTER_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g transform={`translate(${MARK.size + LOCKUP.gap} ${offset}) scale(${LOCKUP.scale})`}>
        <WordmarkGlyphs color={word} />
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

/** App icon: the Z alone, centred in a Deep Navy container with half the side as padding. */
export function ZAppIcon({ size = 96, shape = "squircle", surface = "navy", markRatio = 0.5, className }: AppIconProps) {
  const background = surface === "navy" ? "var(--zb-navy, #081f5c)" : surface === "blue" ? "var(--zb-blue, #165dff)" : "#ffffff";
  const color = surface === "white" ? "var(--zb-blue, #165dff)" : "#ffffff";
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", surface === "white" && "border border-[var(--zb-line,var(--color-line))]", className)}
      style={{ width: size, height: size, background, color, borderRadius: shape === "circle" ? "50%" : size * 0.225 }}
      aria-hidden
    >
      <ZMark size={Math.round(size * markRatio)} />
    </span>
  );
}
