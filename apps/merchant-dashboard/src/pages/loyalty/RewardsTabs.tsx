import { useNavigate } from "react-router-dom";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { SectionTabs } from "@/components/SectionTabs";

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
    loyalty: "نقط الولاء",
    vip: "مستويات VIP",
    referrals: "ادعي صاحبك",
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

const ORDER: RewardsTab[] = ["loyalty", "vip", "referrals", "credit"];

/**
 * The tabs of Customers → Loyalty & rewards: loyalty points (handoff 203),
 * VIP tiers (218), "refer a friend" (222) and store credit balances (204) sit
 * on one sidebar entry, each page under its own header. Rendered by the four
 * pages right after their PageHeader.
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
