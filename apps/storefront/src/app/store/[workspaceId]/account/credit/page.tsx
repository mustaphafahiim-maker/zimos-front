import { notFound } from "next/navigation";
import { STORE_CREDIT_ENABLED } from "@/lib/features";
import { AccountCredit } from "@/components/account/AccountWallet";

/** «رصيدي»: the shopper's store credit. */
export default function AccountCreditPage() {
  // Switched on per deploy (lib/features): off, this address is not there.
  if (!STORE_CREDIT_ENABLED) notFound();
  return <AccountCredit />;
}
