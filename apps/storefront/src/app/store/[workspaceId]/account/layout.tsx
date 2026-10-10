import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SHOPPER_ACCOUNTS_ENABLED } from "@/lib/features";
import { AccountShell } from "@/components/account/AccountShell";
import { getDictionary } from "@/lib/i18n";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

/** The shopper's account: never indexed, one frame for every tab. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): Promise<Metadata> {
  if (!SHOPPER_ACCOUNTS_ENABLED) return {};
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId);
  const t = getDictionary(await getStoreLocale(store));
  return { title: t.account.title, robots: { index: false, follow: false } };
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  // Shopper accounts are a feature switched on per deploy (lib/features): off, none of these addresses is there.
  if (!SHOPPER_ACCOUNTS_ENABLED) notFound();
  return <AccountShell>{children}</AccountShell>;
}
