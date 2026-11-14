import { notFound } from "next/navigation";
import { CUSTOMER_REFERRALS_ENABLED } from "@/lib/features";
import { AccountInvite } from "@/components/rewards/AccountInvite";

/** «ادعي صحابك»: the shopper's invite link and invites. */
export default function AccountInvitePage() {
  // Switched on per deploy (lib/features): off, this address is not there.
  if (!CUSTOMER_REFERRALS_ENABLED) notFound();
  return <AccountInvite />;
}
