/**
 * Shared class recipes for the storefront's default visual language: raised
 * paper surfaces, rounded-2xl cards, hairline borders, generous spacing. Every
 * colour is a semantic token from globals.css, so merchant branding
 * (.brand-theme) flows through and light/dark flips without `dark:` variants.
 * Tap targets are ≥ 44px (min-h-11).
 */

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export const btnPrimary = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;

export const btnPrimaryLg = `${btnPrimary} w-full text-base py-3.5`;

/**
 * The buy button, given some weight: a brushed-metal gradient in the store's
 * own primary colour, a highlight along the top edge and a real press. Pure
 * CSS on top of btnPrimary, so it keeps the same size, focus ring and
 * disabled behaviour.
 */
export const btnMetal = `${btnPrimary} relative overflow-hidden border border-primary-dark/40 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primary)_82%,white)_0%,var(--color-primary)_45%,var(--color-primary-dark)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_6px_rgba(0,0,0,0.18)] transition-[transform,box-shadow] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_4px_10px_rgba(0,0,0,0.22)] active:translate-y-px active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)] motion-reduce:transition-none`;

export const btnMetalLg = `${btnMetal} w-full text-base py-3.5`;

export const btnSecondary = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-paper-raised px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;

export const btnGhost = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary-soft ${focus}`;

export const iconBtn = `relative inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-line bg-paper-raised text-ink transition-colors hover:border-primary hover:text-primary ${focus}`;

export const card = "rounded-2xl border border-line bg-paper-raised";

export const input =
  "block w-full min-h-11 rounded-xl border border-line-strong bg-paper-raised px-3.5 py-2.5 text-base text-ink placeholder:text-ink-soft outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/10";

export const label = "mb-1.5 block text-sm font-medium text-ink";

export const sectionTitle = "text-lg font-semibold text-ink";

export const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";

/** The same focus ring the buttons carry, for controls built outside these recipes. */
export const focusRing = focus;

/** A placeholder block while a list or a price is on its way; still for reduced motion. */
export const skeleton = "animate-pulse rounded-xl bg-line/70 motion-reduce:animate-none";

/**
 * A choice among a few options — variant values, payment methods, tabs — as a
 * pill that reads selected without relying on colour alone (border weight).
 */
export const pill = (selected: boolean) =>
  `inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-4 text-sm font-medium transition-colors ${
    selected ? "border-primary bg-primary-soft text-primary" : "border-line bg-paper-raised text-ink hover:border-primary"
  } ${focus}`;

/**
 * A modal layer (the cart drawer, the mobile menu): the backdrop and a sheet
 * that slides in from the inline-end edge, both inside one full-viewport box
 * that clips them. The clipping matters: a sheet parked off the edge by a
 * transform would otherwise extend the document sideways, and a phone
 * browser answers that by zooming the whole page out.
 *
 * `open` drives the sheet's transform; the RTL variant flips it so the sheet
 * still parks off the edge it lives on. Motion collapses to a cut under
 * reduced motion.
 */
export const modalLayer = "fixed inset-0 z-50 overflow-hidden";

export const sheet = (open: boolean) =>
  `absolute inset-y-0 end-0 flex w-full max-w-md flex-col bg-paper-raised shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
    open ? "translate-x-0" : "translate-x-full rtl:-translate-x-full"
  }`;

export const backdrop = (open: boolean) =>
  `absolute inset-0 bg-ink/40 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none ${
    open ? "opacity-100" : "pointer-events-none opacity-0"
  }`;
