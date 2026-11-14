import { notFound } from "next/navigation";
import { VIP_TIERS_ENABLED } from "@/lib/features";
import { AccountVip } from "@/components/rewards/AccountVip";

/** «مستواي»: the shopper's VIP level. */
export default function AccountVipPage() {
  // Switched on per deploy (lib/features): off, this address is not there.
  if (!VIP_TIERS_ENABLED) notFound();
  return <AccountVip />;
}
