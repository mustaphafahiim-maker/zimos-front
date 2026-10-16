import { notFound } from "next/navigation";
import { LOYALTY_ENABLED } from "@/lib/features";
import { AccountPoints } from "@/components/account/AccountWallet";

/** «نقطي»: the shopper's loyalty points. */
export default function AccountPointsPage() {
  // Switched on per deploy (lib/features): off, this address is not there.
  if (!LOYALTY_ENABLED) notFound();
  return <AccountPoints />;
}
