// How a dashboard looks on this device (store.ts), the toolbar switch that
// reads it, and the two controls of the settings that are more than a switch:
// the tone of the Dark look and the glow colours of the glass backdrop.
// A subpath of its own, never re-exported from the package's index: importing
// the store draws the kept look on <html>, which only the two dashboards want.
export * from "./store";
export { ThemeToggle } from "./ThemeToggle";
export { ToneSlider, type ToneSliderProps } from "./ToneSlider";
export { GlowColours } from "./GlowColours";
export { GLOW_PRESETS, ORIGINAL_GLOW_LEFT, ORIGINAL_GLOW_RIGHT, type GlowPreset } from "./glowPresets";
export type { AppearanceLocale } from "./strings";
