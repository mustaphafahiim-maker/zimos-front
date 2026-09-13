/**
 * The shape every locale dictionary must satisfy.
 *
 * Both `dictionaries/ar.ts` and `dictionaries/en.ts` are typed as
 * `Dictionary`, so adding a key in one language forces a translation in the
 * other. Keep this limited to copy that is actually on screen.
 *
 * Copy rules (ZIMOS brand): no invented metrics, customer counts, ratings,
 * testimonials or prices. Illustrations use generic UI labels only.
 */

export interface Dictionary {
  meta: {
    /** Document <title>. */
    title: string;
    /** Meta description. */
    description: string;
  };

  /** Approved brand phrases, localized. `*Latin` is the English original, shown
   *  as a small secondary line in Arabic; `null` where the main line already is it. */
  brand: {
    name: string;
    limits: string;
    limitsLatin: string | null;
    loop: string;
    loopLatin: string | null;
    tomorrow: string;
  };

  nav: {
    /** Visually hidden skip link, first focusable element. */
    skipToContent: string;
    /** Accessible name of the logo link. */
    homeAria: string;
    /** Accessible name of the primary <nav>. */
    primaryLabel: string;
    product: string;
    solutions: string;
    pricing: string;
    faq: string;
    /** Visible label of the language switcher — the name of the OTHER language. */
    switchLanguage: string;
    switchLanguageAria: string;
    switchToDark: string;
    switchToLight: string;
    openMenu: string;
    closeMenu: string;
    /** Auth actions — link out to the dashboard. */
    signIn: string;
    startFree: string;
  };

  hero: {
    kicker: string;
    /** Main headline — the "Build. Sell. Grow." phrase. */
    headline: string;
    subheadline: string;
    primaryCta: string;
    secondaryCta: string;
    /** Microcopy under the CTAs. */
    ctaNote: string;
    visual: HeroVisual;
  };

  platform: {
    kicker: string;
    heading: string;
    intro: string;
    items: [
      Capability,
      Capability,
      Capability,
      Capability,
      Capability,
      Capability,
      Capability,
      Capability,
    ];
  };

  lifecycle: {
    kicker: string;
    heading: string;
    intro: string;
    points: [string, string, string];
    flowCaption: string;
    flowAria: string;
    trackingLabel: string;
    steps: [FlowStep, FlowStep, FlowStep, FlowStep];
  };

  howItWorks: {
    kicker: string;
    heading: string;
    intro: string;
    /** Visible "Step" label preceding the ordinal. */
    stepLabel: string;
    steps: [HowStep, HowStep, HowStep];
  };

  deepDives: {
    kicker: string;
    heading: string;
    intro: string;
    confirm: DeepDive & { visual: ConfirmVisual };
    profit: DeepDive & { visual: ProfitVisual };
    funnels: DeepDive & { visual: FunnelVisual };
  };

  integrations: {
    kicker: string;
    heading: string;
    intro: string;
    groups: [IntegrationGroup, IntegrationGroup, IntegrationGroup];
    note: string;
  };

  pricing: {
    kicker: string;
    heading: string;
    intro: string;
    badge: string;
    plans: [Plan, Plan, Plan];
    note: string;
  };

  faq: {
    kicker: string;
    heading: string;
    intro: string;
    items: FaqItem[];
  };

  /** Navy closing band; its heading is `brand.limits`. */
  finalCta: {
    body: string;
    primaryCta: string;
    secondaryCta: string;
  };

  footer: {
    navLabel: string;
    columns: [FooterColumn, FooterColumn, FooterColumn, FooterColumn];
    rights: string;
    languageLabel: string;
  };
}

export interface HeroVisual {
  aria: string;
  storeLabel: string;
  liveLabel: string;
  funnelTitle: string;
  funnelSteps: [string, string, string, string];
  pipelineTitle: string;
  columns: [string, string, string];
  order: string;
  confirmTitle: string;
  confirmBody: string;
}

export interface Capability {
  id:
    | "store"
    | "funnels"
    | "confirmation"
    | "shipping"
    | "analytics"
    | "fraud"
    | "automations"
    | "teams";
  title: string;
  body: string;
}

export interface FlowStep {
  /** Stable id, not shown. */
  id: "placed" | "confirmed" | "tracked" | "delivered";
  title: string;
  detail: string;
}

export interface HowStep {
  id: "build" | "sell" | "grow";
  title: string;
  body: string;
}

export interface DeepDive {
  kicker: string;
  heading: string;
  body: string;
  points: [string, string, string];
}

export interface ConfirmVisual {
  aria: string;
  queueTitle: string;
  order: string;
  cities: [string, string, string];
  statusCalling: string;
  statusConfirmed: string;
  statusWaiting: string;
  chatTitle: string;
  storeMessage: string;
  customerReply: string;
  systemMessage: string;
}

export interface ProfitVisual {
  aria: string;
  title: string;
  illustrative: string;
  bars: [string, string, string, string, string, string];
  metrics: [string, string, string];
}

export interface FunnelVisual {
  aria: string;
  title: string;
  landing: string;
  checkout: string;
  bump: string;
  upsell: string;
  accept: string;
  decline: string;
  downsell: string;
  thankYou: string;
}

export interface IntegrationGroup {
  label: string;
  items: string[];
}

export interface Plan {
  id: "starter" | "growth" | "scale";
  name: string;
  description: string;
  features: string[];
  cta: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FooterColumn {
  title: string;
  /** `#anchor` for in-page targets, `/path` for routes (locale is prefixed at render). */
  links: { label: string; href: string }[];
}
