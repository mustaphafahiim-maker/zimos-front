import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageRenderer } from "@/components/page-renderer";
import { getPreview } from "@/lib/previewStore";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

/**
 * A draft page tree posted by the dashboard (see ../route.ts), rendered with
 * exactly the components a published page uses — the store layout supplies the
 * header, footer, brand colours and language, and the commerce blocks pull the
 * live catalogue. Only reachable through the random token the dashboard
 * minted, and only briefly.
 */
export default async function StorePreviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string; token: string }>;
}) {
  // The same URL shows a new tree after every post, so never prerender or
  // reuse a render.
  await connection();
  const { workspaceId, token } = await params;

  const store = await getStoreMeta(workspaceId);
  if (!store) notFound();

  const entry = getPreview(token, workspaceId);
  if (!entry) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-24 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-ink" dir="rtl">
            انتهت صلاحية المعاينة. حدّثها من لوحة التحكم.
          </p>
          <p className="text-sm text-ink-soft">This preview has expired. Refresh it from the dashboard.</p>
        </div>
      </main>
    );
  }

  const empty = (entry.tree.sections?.length ?? 0) === 0;
  const locale = await getStoreLocale(store);

  return (
    <main className="flex-1">
      {empty ? (
        <p className="px-6 py-16 text-center text-sm text-ink-soft">
          <span dir="rtl">الصفحة دي لسه فاضية.</span> · This page is empty.
        </p>
      ) : (
        <PageRenderer
          tree={entry.tree}
          workspaceId={workspaceId}
          currency={store.currency}
          locale={locale}
        />
      )}
    </main>
  );
}
