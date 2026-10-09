import { useState } from "react";
import { IconInfo } from "@/components/icons";
import { buttonVariants, cn } from "@store-builder/ui";
import { apiFieldProblems, isApiErrorCode } from "@store-builder/api-client";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

/**
 * Store settings → Domains → "Buy a domain", when buying is not possible
 * (handoff item 305):
 *
 * - 503 DOMAIN_PURCHASE_UNAVAILABLE from the search or the purchase: this
 *   server has no registrar connected. The search form gives way to a note
 *   that points at "Connect a domain", and stays away for the rest of the visit
 *   (the answer is the server's, not the store's — nothing the merchant does
 *   changes it, so it is not asked again until the dashboard is reloaded).
 * - Only a name like mystore.com on one of the endings sold here can be bought;
 *   anything else is a 422 on `domain`, said in the merchant's words.
 */

/** The endings a name can be bought on (backend domains/purchases.js). */
const ENDINGS = ["com", "net", "store", "shop", "online", "co"];
/** ".com .net …" kept left-to-right as one piece inside an Arabic sentence (LRI … PDI). */
const ENDINGS_TEXT = `⁦${ENDINGS.map((ending) => `.${ending}`).join(" ")}⁩`;

/** Where "Connect a domain" sits on the Domains tab: the note's link scrolls there. */
export const DOMAIN_CONNECT_ANCHOR = "domain-connect";

const STRINGS = {
  en: {
    unavailable: "Buying a domain isn't available yet — connect one you own",
    connect: "Connect a domain",
    endings: "You can buy names ending in {endings}",
    badName: "This name can't be bought here. Choose a name like mystore.com ending in {endings}",
  },
  ar: {
    unavailable: "شراء الدومين مش متاح دلوقتي — اربط دومين عندك",
    connect: "ربط دومين",
    endings: "ينفع تشتري أسماء آخرها {endings}",
    badName: "الاسم ده مينفعش يتشتري من هنا. اختار اسم زي mystore.com آخره {endings}",
  },
} satisfies Messages;

export function isDomainPurchaseUnavailable(err: unknown): boolean {
  return isApiErrorCode(err, "DOMAIN_PURCHASE_UNAVAILABLE");
}

// Learned from the first 503 of this visit; a reload asks the server again.
let knownUnavailable = false;

export interface DomainPurchaseAvailability {
  /** True once the server said buying is not available here. */
  unavailable: boolean;
  /** Call with a failed search or purchase: true when it was that refusal (the section now shows the note). */
  refused: (err: unknown) => boolean;
  /** Under the search field: the endings sold here. */
  endingsHint: string;
}

export function useDomainPurchaseAvailability(): DomainPurchaseAvailability {
  const t = useT(STRINGS);
  const [unavailable, setUnavailable] = useState(knownUnavailable);
  return {
    unavailable,
    refused: (err) => {
      if (!isDomainPurchaseUnavailable(err)) return false;
      knownUnavailable = true;
      setUnavailable(true);
      return true;
    },
    endingsHint: fmt(t.endings, { endings: ENDINGS_TEXT }),
  };
}

/**
 * The purchase's refusal of the name itself (422 on `domain`), or null for any
 * other failure. The search only lists names that can be bought, so this is a
 * name that stopped being one in between.
 */
export function useDomainNameRefusal(): (err: unknown) => string | null {
  const t = useT(STRINGS);
  return (err) => (apiFieldProblems(err).some((problem) => problem.field === "domain") ? fmt(t.badName, { endings: ENDINGS_TEXT }) : null);
}

/** In place of the search form: buying is not available, with the way to "Connect a domain". */
export function DomainPurchaseUnavailableNotice() {
  const t = useT(STRINGS);
  return (
    <div role="status" className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] bg-paper-sunken px-4 py-4 sm:flex-row sm:items-center">
      <IconInfo className="size-5 shrink-0 text-ink-soft" aria-hidden />
      <p className="min-w-0 flex-1 text-sm font-medium text-ink">{t.unavailable}</p>
      <a
        href={`#${DOMAIN_CONNECT_ANCHOR}`}
        className={cn(buttonVariants({ variant: "outline" }), "min-h-11 bg-paper-raised sm:min-h-0")}
        onClick={(e) => {
          // Same page: bring the form into view and put the cursor in it, without touching the address bar.
          e.preventDefault();
          const target = document.getElementById(DOMAIN_CONNECT_ANCHOR);
          const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          target?.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
          target?.querySelector("input")?.focus({ preventScroll: true });
        }}
      >
        {t.connect}
      </a>
    </div>
  );
}
