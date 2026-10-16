import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ApiError, storefrontPolicy, type LegalPolicyKey } from "@store-builder/api-client";
import { container } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

export const revalidate = 60;

type Params = Promise<{ workspaceId: string; key: string }>;

/** `/policies/refund-policy` in the address, `refund_policy` in the API. */
const keyOf = (segment: string) => segment.replace(/-/g, "_");

/** Deduped so generateMetadata and the page share one API call; null → 404. */
const getPolicy = cache(async (workspaceId: string, key: string) => {
  const client = await createServerStorefrontApiClient();
  try {
    return await storefrontPolicy(client, workspaceId, key);
  } catch (err) {
    if (err instanceof ApiError) return null;
    throw err;
  }
});

async function titleOf(workspaceId: string, key: LegalPolicyKey) {
  const store = await getStoreMeta(workspaceId);
  const t = getDictionary(await getStoreLocale(store));
  return t.policies[key];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId, key } = await params;
  const policy = await getPolicy(workspaceId, keyOf(key));
  if (!policy) return {};
  return { title: await titleOf(workspaceId, policy.key), alternates: { canonical: `/policies/${key}` } };
}

/**
 * One of the store's legal policies (refund, privacy, terms of service) —
 * written once in the dashboard and linked from the footer, every funnel and
 * the checkout. Plain text: each line is a paragraph, nothing is markup.
 */
export default async function PolicyPage({ params }: { params: Params }) {
  const { workspaceId, key } = await params;
  const policy = await getPolicy(workspaceId, keyOf(key));
  if (!policy) notFound();

  const paragraphs = policy.content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <main className={`${container} flex-1 py-10 sm:py-14`}>
      <article className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{await titleOf(workspaceId, policy.key)}</h1>
        <div className="mt-6 space-y-4 text-base leading-relaxed text-ink-soft">
          {paragraphs.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </article>
    </main>
  );
}
