import type { Metadata } from "next";
import Link from "next/link";
import { MyOrdersList } from "@/components/MyOrdersList";
import { container } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

type Params = Promise<{ workspaceId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId);
  const t = getDictionary(await getStoreLocale(store));
  return { title: t.myOrders.title, description: t.myOrders.notice, robots: { index: false, follow: false } };
}

/**
 * Orders this browser placed in this store. There are no customer accounts:
 * the list is the per-workspace order snapshots saved after checkout
 * (lib/orders.ts `rememberOrder`, status fetched live), so only the list itself is a
 * client component — the heading and the device notice render on the server.
 */
export default async function MyOrdersPage({ params }: { params: Params }) {
  const { workspaceId } = await params;
  const t = getDictionary(await getStoreLocale(await getStoreMeta(workspaceId)));
  const base = `/store/${workspaceId}`;

  return (
    <main className={`${container} flex-1 py-10 sm:py-14`}>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{t.myOrders.title}</h1>
        <p className="mt-3 rounded-xl border border-line bg-paper-raised px-4 py-3 text-sm leading-relaxed text-ink-soft">
          {t.myOrders.notice}
        </p>

        <MyOrdersList workspaceId={workspaceId} />

        <p className="mt-8 text-sm text-ink-soft">
          {t.myOrders.lookupOther}{" "}
          <Link href={`${base}/track`} className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">
            {t.common.trackOrder}
          </Link>
        </p>
      </div>
    </main>
  );
}
