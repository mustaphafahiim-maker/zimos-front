import { useNavigate } from "react-router-dom";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { SectionTabs } from "@/components/SectionTabs";
import { CUSTOMER_REFERRALS_ENABLED, LOYALTY_ENABLED, STORE_CREDIT_ENABLED, VIP_TIERS_ENABLED } from "@/lib/features";

const STRINGS = {
  en: {
    label: "Loyalty and rewards sections",
    loyalty: "Loyalty points",
    vip: "VIP tiers",
    referrals: "Refer a friend",
    credit: "Store credit",
  },
  ar: {
    label: "أقسام الولاء والمكافآت",
    loyalty: "نقاط الولاء",
    vip: "مستويات VIP",
    referrals: "ادعُ صديقك",
    credit: "أرصدة العملاء",
  },
} satisfies Messages;

/**
 * What rewards a returning customer, one tab per programme; each tab is its own URL.
 * Store credit keeps its address (/store-credit) and sits under the same sidebar
 * entry (`under: "/loyalty"` in lib/navigation.ts).
 */
export const REWARDS_PATHS = {
  loyalty: "/loyalty",
  vip: "/loyalty/vip",
  referrals: "/loyalty/referrals",
  credit: "/store-credit",
} as const;

export type RewardsTab = keyof typeof REWARDS_PATHS;

/** Each programme is switched on by itself (lib/features): only those that are on have a tab and a page. */
const ON: Record<RewardsTab, boolean> = {
  loyalty: LOYALTY_ENABLED,
  vip: VIP_TIERS_ENABLED,
  referrals: CUSTOMER_REFERRALS_ENABLED,
  credit: STORE_CREDIT_ENABLED,
};

const ORDER: RewardsTab[] = (["loyalty", "vip", "referrals", "credit"] as const).filter((tab) => ON[tab]);

/** Where "Loyalty & rewards" opens: the first programme that is on; null while none is. */
export const REWARDS_HOME: string | null = ORDER.length > 0 ? REWARDS_PATHS[ORDER[0]] : null;

/**
 * The tabs of Customers → Loyalty & rewards: loyalty points, VIP tiers,
 * "refer a friend" and store credit balances sit on one sidebar entry, each
 * page under its own header. Rendered by the four pages right after their
 * PageHeader; a programme that is switched off has no tab.
 */
export function RewardsTabs({ active }: { active: RewardsTab }) {
  const t = useT(STRINGS);
  const navigate = useNavigate();
  return (
    <SectionTabs
      label={t.label}
      value={active}
      onChange={(next) => navigate(REWARDS_PATHS[next])}
      tabs={ORDER.map((value) => ({ value, label: t[value] }))}
    />
  );
}
