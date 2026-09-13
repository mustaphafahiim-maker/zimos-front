import type { Dictionary } from "../dictionary";

export const en: Dictionary = {
  meta: {
    title: "ZIMOS — Commerce Without Limits",
    description:
      "ZIMOS is commerce infrastructure for merchants in Egypt and the Arab world: stores, funnels, cash-on-delivery confirmation, shipping and real profit analytics in one platform.",
  },

  brand: {
    name: "ZIMOS",
    limits: "Commerce Without Limits",
    limitsLatin: null,
    loop: "Build. Sell. Grow.",
    loopLatin: null,
    tomorrow: "Commerce for a brighter tomorrow.",
  },

  nav: {
    skipToContent: "Skip to content",
    homeAria: "ZIMOS home",
    primaryLabel: "Main",
    product: "Product",
    solutions: "Solutions",
    pricing: "Pricing",
    faq: "FAQ",
    switchLanguage: "العربية",
    switchLanguageAria: "Switch language to Arabic",
    switchToDark: "Switch to dark theme",
    switchToLight: "Switch to light theme",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    signIn: "Sign in",
    startFree: "Start free",
  },

  hero: {
    kicker: "Commerce infrastructure for cash-on-delivery brands",
    headline: "Build. Sell. Grow.",
    subheadline:
      "Launch your store and funnels, confirm every cash-on-delivery order, ship with local carriers, and see what each delivered order really earns — in one platform built for Egypt and the Arab world.",
    primaryCta: "Start free",
    secondaryCta: "See how it works",
    ctaNote: "Free during early access. No card required.",
    visual: {
      aria: "Illustration of the ZIMOS dashboard: a funnel from landing page to checkout, upsell and thank-you page, an order pipeline, and an order confirmed on WhatsApp.",
      storeLabel: "Your store",
      liveLabel: "Live",
      funnelTitle: "Funnel",
      funnelSteps: ["Landing", "Checkout", "Upsell", "Thank you"],
      pipelineTitle: "Orders",
      columns: ["New", "Confirming", "Ready to ship"],
      order: "Order",
      confirmTitle: "Confirmed",
      confirmBody: "Customer replied on WhatsApp",
    },
  },

  platform: {
    kicker: "One platform",
    heading: "Everything a COD brand runs on, in one place",
    intro:
      "Stop stitching together a store builder, spreadsheets, call sheets and carrier portals. ZIMOS connects each step so orders move without re-entry.",
    items: [
      {
        id: "store",
        title: "Store builder & templates",
        body: "Start from a ready template, add your brand, and publish a fast storefront in Arabic or English.",
      },
      {
        id: "funnels",
        title: "Funnels, order bumps & upsells",
        body: "Build landing pages and checkout flows with order bumps and one-click upsells after purchase.",
      },
      {
        id: "confirmation",
        title: "Cash-on-delivery confirmation",
        body: "Confirm orders through a call-center queue or an automated WhatsApp message before anything ships.",
      },
      {
        id: "shipping",
        title: "Shipping carriers & COD settlements",
        body: "Send confirmed orders to your carrier, track shipments, and reconcile the cash that was collected.",
      },
      {
        id: "analytics",
        title: "Media buying analytics",
        body: "See cost per delivered order, real ROAS and break-even — based on delivered orders, not placed ones.",
      },
      {
        id: "fraud",
        title: "Fraud & fake-order protection",
        body: "Flag duplicate, suspicious or previously refused orders before you pay to ship them.",
      },
      {
        id: "automations",
        title: "Automations",
        body: "Trigger messages, status changes and assignments as orders move, without manual follow-up.",
      },
      {
        id: "teams",
        title: "Multi-store & team roles",
        body: "Run several stores from one account and give each teammate only the access they need.",
      },
    ],
  },

  lifecycle: {
    kicker: "Order lifecycle",
    heading: "One order record, from checkout to doorstep",
    intro:
      "Every order carries its own history — who confirmed it, when it shipped, and where it is now.",
    points: [
      "Confirmation happens before a shipping label exists.",
      "A tracking code is issued the moment an order is confirmed.",
      "Delivered and collected orders close without manual follow-up.",
    ],
    flowCaption: "How an order moves through ZIMOS",
    flowAria:
      "Animated walkthrough of an order: placed, confirmed, tracking code issued, out for delivery.",
    trackingLabel: "Tracking code",
    steps: [
      {
        id: "placed",
        title: "Order comes in",
        detail: "A customer checks out from your store or funnel — name, address and items in one place.",
      },
      {
        id: "confirmed",
        title: "Confirmed",
        detail: "Your team or an automated WhatsApp message confirms the order and address before anything ships.",
      },
      {
        id: "tracked",
        title: "Tracking code issued",
        detail: "ZIMOS generates a tracking code as soon as the order is confirmed.",
      },
      {
        id: "delivered",
        title: "Out for delivery",
        detail: "The courier delivers and collects the cash, and the order closes itself.",
      },
    ],
  },

  howItWorks: {
    kicker: "How it works",
    heading: "From first product to steady growth",
    intro: "Three stages, one platform. Start simple and add what you need as you scale.",
    stepLabel: "Step",
    steps: [
      {
        id: "build",
        title: "Build",
        body: "Pick a template, add your products and publish your store or funnel. No designer or developer needed.",
      },
      {
        id: "sell",
        title: "Sell",
        body: "Take orders, confirm them by call or WhatsApp, and hand them to your carrier with a tracking code.",
      },
      {
        id: "grow",
        title: "Grow",
        body: "Read profit per delivered order, cut what doesn't pay back, and scale the campaigns that do.",
      },
    ],
  },

  deepDives: {
    kicker: "Solutions",
    heading: "Built around how COD commerce actually works",
    intro:
      "The hard parts of selling with cash on delivery happen after checkout. These are the ones ZIMOS is designed for.",
    confirm: {
      kicker: "Confirmation",
      heading: "Confirm every COD order",
      body: "An unconfirmed order can mean paying for shipping in both directions. ZIMOS puts every new order through a confirmation step before it reaches a carrier.",
      points: [
        "A shared call queue for your confirmation team, with the outcome of each call on the order.",
        "Automated WhatsApp messages — customers reply 1 to confirm or 2 to cancel.",
        "Confirmed orders move to shipping; cancelled ones never leave the warehouse.",
      ],
      visual: {
        aria: "Illustration: a confirmation queue with orders being called, confirmed or awaiting a reply, next to a WhatsApp conversation where the customer replies 1 to confirm.",
        queueTitle: "Confirmation queue",
        order: "Order",
        cities: ["Cairo", "Alexandria", "Giza"],
        statusCalling: "Calling",
        statusConfirmed: "Confirmed",
        statusWaiting: "Awaiting reply",
        chatTitle: "WhatsApp",
        storeMessage: "Hi! Reply 1 to confirm your order, or 2 to cancel.",
        customerReply: "1",
        systemMessage: "Order confirmed — moved to shipping",
      },
    },
    profit: {
      kicker: "Profit",
      heading: "Know your real profit",
      body: "Revenue on placed orders hides returns, refusals and shipping costs. ZIMOS calculates profit on what was actually delivered and collected.",
      points: [
        "Cost per delivered order — not per click or per placed order.",
        "Real ROAS based on collected cash, per campaign and per product.",
        "A break-even view, so you know when a campaign pays for itself.",
      ],
      visual: {
        aria: "Illustration: a profit waterfall that starts from revenue, subtracts product cost, shipping, ad spend and returns, and ends at net profit.",
        title: "Profit breakdown",
        illustrative: "Illustrative",
        bars: ["Revenue", "Product cost", "Shipping", "Ad spend", "Returns", "Net profit"],
        metrics: ["Cost per delivered order", "Real ROAS", "Break-even"],
      },
    },
    funnels: {
      kicker: "Funnels",
      heading: "Launch funnels that convert",
      body: "Turn a single product page into a complete sales flow — without extra tools or code.",
      points: [
        "Landing pages and checkout built for cash on delivery.",
        "Order bumps at checkout and one-click upsells after purchase.",
        "A downsell path when a customer declines the first offer.",
      ],
      visual: {
        aria: "Illustration of a funnel: landing page, checkout with an order bump, then an upsell that leads to the thank-you page or to a downsell.",
        title: "Funnel",
        landing: "Landing page",
        checkout: "Checkout",
        bump: "Order bump",
        upsell: "Upsell",
        accept: "Accepted",
        decline: "Declined",
        downsell: "Downsell",
        thankYou: "Thank-you page",
      },
    },
  },

  integrations: {
    kicker: "Integrations",
    heading: "Works with the tools you already use",
    intro: "Connect your messaging, ad platforms, carriers and payment providers from the dashboard.",
    groups: [
      { label: "Messaging & ads", items: ["WhatsApp", "Facebook", "TikTok", "Snapchat", "Google"] },
      { label: "Shipping", items: ["Bosta", "J&T", "Aramex"] },
      { label: "Payments", items: ["Paymob", "InstaPay"] },
    ],
    note: "Trademarks belong to their respective owners.",
  },

  pricing: {
    kicker: "Pricing",
    heading: "Plans that grow with your brand",
    intro:
      "Start free while ZIMOS is in early access. We'll announce public pricing well before it takes effect.",
    badge: "Early access",
    plans: [
      {
        id: "starter",
        name: "Starter",
        description: "For merchants launching their first store.",
        features: [
          "Store builder & templates",
          "Checkout built for cash on delivery",
          "WhatsApp order confirmation",
          "Arabic and English storefronts",
        ],
        cta: "Start free",
      },
      {
        id: "growth",
        name: "Growth",
        description: "For brands running paid campaigns every day.",
        features: [
          "Everything in Starter",
          "Funnels, order bumps & upsells",
          "Call-center confirmation queue",
          "Media buying & profit analytics",
          "Fraud & fake-order protection",
        ],
        cta: "Start free",
      },
      {
        id: "scale",
        name: "Scale",
        description: "For teams running several stores and carriers.",
        features: [
          "Everything in Growth",
          "Multiple stores in one account",
          "Team roles & permissions",
          "Automations",
          "Help with onboarding and migration",
        ],
        cta: "Contact sales",
      },
    ],
    note: "No card required.",
  },

  faq: {
    kicker: "FAQ",
    heading: "Clear answers before you start",
    intro: "Can't find what you're looking for? Contact our team and we'll help.",
    items: [
      {
        question: "How does cash-on-delivery confirmation work?",
        answer:
          "New orders go through a confirmation step before shipping. Your team can work through a call queue and record each outcome, or ZIMOS can send a WhatsApp message asking the customer to reply to confirm or cancel. Only confirmed orders move on to shipping.",
      },
      {
        question: "Can I use my own domain?",
        answer:
          "Your store starts on a ZIMOS subdomain so you can go live right away. When you're ready, you can connect a domain you own from your store settings.",
      },
      {
        question: "Which shipping carriers can I use?",
        answer:
          "ZIMOS is built to work with local carriers such as Bosta, J&T and Aramex. Available carriers can depend on your country and account — you'll find the current list in your dashboard.",
      },
      {
        question: "Do I have to use cash on delivery?",
        answer:
          "No. Cash on delivery is fully supported, and you can also accept online payments through supported providers such as Paymob and InstaPay where they're available to your business.",
      },
      {
        question: "Which languages does ZIMOS support?",
        answer:
          "The dashboard and storefronts support Arabic (right-to-left) and English. You can run your store in either language, or both.",
      },
      {
        question: "Can I export my data?",
        answer:
          "Yes. Your store data belongs to you, and you can export your orders, customers and products from the dashboard.",
      },
      {
        question: "Can my team work in the same account?",
        answer:
          "Yes. Invite teammates and assign roles — for example, confirmation agents who only see the order queue — so everyone has the access their work needs.",
      },
      {
        question: "How do I get started?",
        answer:
          "Create a free account, pick a template and add your products. Publish your store when it's ready, and add more as your business grows.",
      },
    ],
  },

  finalCta: {
    body: "Build your store, confirm every order and grow on real profit — with infrastructure made for the way you sell.",
    primaryCta: "Start free",
    secondaryCta: "Talk to sales",
  },

  footer: {
    navLabel: "Footer",
    columns: [
      {
        title: "Product",
        links: [
          { label: "Platform", href: "#product" },
          { label: "Solutions", href: "#solutions" },
          { label: "Pricing", href: "#pricing" },
          { label: "FAQ", href: "#faq" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "About", href: "/about" },
          { label: "Careers", href: "/careers" },
          { label: "Contact", href: "/contact" },
        ],
      },
      {
        title: "Resources",
        links: [
          { label: "Help center", href: "/help" },
          { label: "Guides", href: "/guides" },
          { label: "Blog", href: "/blog" },
        ],
      },
      {
        title: "Legal",
        links: [
          { label: "Terms of service", href: "/terms" },
          { label: "Privacy policy", href: "/privacy" },
        ],
      },
    ],
    rights: "All rights reserved.",
    languageLabel: "Language",
  },
};
