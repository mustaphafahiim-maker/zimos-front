import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BranchList } from "@/components/branches/BranchList";
import { container } from "@/components/ui";
import { branchCopy } from "@/lib/storeBranches";
import { getStoreBranches } from "@/lib/storeBranchesServer";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";
import type { RedirectQuery } from "@/lib/urlRedirects";
import CustomStorePage, { generateMetadata as customPageMetadata } from "../[...path]/page";

export const revalidate = 60;

type Params = Promise<{ workspaceId: string }>;

/** The website editor's own page at this address, for a store that does not show its branches. */
const asCustomPage = (workspaceId: string) => Promise.resolve({ workspaceId, path: ["branches"] });

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId } = await params;
  const [store, found] = await Promise.all([getStoreMeta(workspaceId), getStoreBranches(workspaceId)]);
  if (!store) return {};
  if (!found) return customPageMetadata({ params: asCustomPage(workspaceId) });
  const c = branchCopy(await getStoreLocale(store));
  return { title: c.title, description: c.intro, alternates: { canonical: "/branches" } };
}

/**
 * «فروعنا» / "Our stores" (frontend-handoff 233): the branches the store
 * chose to show (Store settings → Our branches), each with its address,
 * hours, phone and directions; «أقرب فرع ليا» sorts them by distance.
 *
 * While the store locator is off the API answers 404, and this address goes
 * back to what it was before the page existed: a page the merchant built at
 * /branches in the website editor, an address they moved, or a 404 — exactly
 * the catch-all route's answer, which is rendered in its place.
 */
export default async function BranchesPage({ params, searchParams }: { params: Params; searchParams?: Promise<RedirectQuery> }) {
  const { workspaceId } = await params;
  const [store, found] = await Promise.all([getStoreMeta(workspaceId), getStoreBranches(workspaceId)]);
  if (!store) notFound();
  if (!found) return <CustomStorePage params={asCustomPage(workspaceId)} searchParams={searchParams} />;

  const c = branchCopy(await getStoreLocale(store));
  return (
    <main className="flex-1">
      <div className={`${container} py-8 sm:py-10`}>
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{c.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">{c.intro}</p>
        <BranchList initial={found.branches} />
      </div>
    </main>
  );
}
