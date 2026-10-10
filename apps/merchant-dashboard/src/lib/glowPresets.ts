/**
 * The ready palettes of Settings → Language and look → Glow colours: the two
 * colours the glass backdrop glows in, one for each side of the screen.
 *
 * A colour here is the one the merchant sees and picks; theme/liquid-glass.css
 * mixes it toward white (light) or black (dark) before it reaches the backdrop,
 * so no pick can take the text over it under 4.5:1 (theme/theme.test.ts).
 */
export interface GlowPreset {
  id: "original" | "ocean" | "emerald" | "violet" | "sunset" | "grey" | "none";
  /** null: the colours the backdrop always had on that side. */
  left: string | null;
  right: string | null;
  /** 0 = no glows at all. */
  intensity: number;
}

/**
 * What the two pickers show while a side still has the colours it always had:
 * the orange of the bottom-left pool and the magenta of the bottom-right one.
 */
export const ORIGINAL_GLOW_LEFT = "#ff7c30";
export const ORIGINAL_GLOW_RIGHT = "#f03ab8";

export const GLOW_PRESETS: ReadonlyArray<GlowPreset> = [
  { id: "original", left: null, right: null, intensity: 100 },
  { id: "ocean", left: "#2f7bff", right: "#14b8a6", intensity: 100 },
  { id: "emerald", left: "#10b981", right: "#a3e635", intensity: 100 },
  { id: "violet", left: "#8b5cf6", right: "#ec4899", intensity: 100 },
  { id: "sunset", left: "#ef4444", right: "#f59e0b", intensity: 100 },
  { id: "grey", left: "#9ca3af", right: "#6b7280", intensity: 100 },
  { id: "none", left: null, right: null, intensity: 0 },
];
