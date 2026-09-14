import type { Metadata } from "next";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { PageTree, StorefrontProductDetail } from "@store-builder/api-client";
import { FunnelDone, FunnelStepActions, FunnelUnavailable } from "@/components/funnel/FunnelStep";
import { PageRenderer } from "@/components/page-renderer";
import { classifyFunnelError, getFunnelStep, type FunnelStepResponse } from "@/lib/publicApi";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta, getStorefrontProduct } from "@/lib/storeMeta";

type Params = Promise<{ workspaceId: string; ref: string; sessionId: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Loaded = { ok: true; data: FunnelStepResponse } | { ok: false; kind: ReturnType<typeof classifyFunnelError> };

/** Deduped so generateMetadata and the page share one step lookup. */
const loadStep = cache(async (workspaceId: string, funnelId: string, sessionId: string): Promise<Loaded> => {
  const client = await createServerStorefrontApiClient();
  try {
    return { ok: true, data: await getFunnelStep(client, workspaceId, funnelId, sessionId) };
  } catch (err) {
    return { ok: false, kind: classifyFunnelError(err) };
  }
});

function seoString(seo: Record<string, unknown> | undefined, key: string) {
  const v = seo?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId, ref, sessionId } = await params;
  const robots = { index: false, follow: false };
  if (!UUID.test(ref) || !UUID.test(sessionId)) return { robots };
  const result = await loadStep(workspaceId, ref, sessionId);
  if (!result.ok || !result.data.step) return { robots };
  const { step } = result.data;
  const title = seoString(step.seo, "title") ?? step.name;
  const description = seoString(step.seo, "description");
  const ogImage = seoString(step.seo, "ogImage");
  return {
    title,
    description,
    robots,
    openGraph: {
      title: seoString(step.seo, "ogTitle") ?? title,
      description: seoString(step.seo, "ogDescription") ?? description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

/** Product ids the merchant placed in the step via `product_card` elements. */
function productIdsIn(tree: PageTree | null): string[] {
  const ids: string[] = [];
  for (const section of tree?.sections ?? []) {
    for (const row of section.rows ?? []) {
      for (const column of row.columns ?? []) {
        for (const el of column.elements ?? []) {
          const id = (el.props as Record<string, unknown> | undefined)?.productId;
          if (el.type === "product_card" && typeof id === "string" && id.trim()) ids.push(id.trim());
        }
      }
    }
  }
  return ids;
}

/**
 * One step of a running funnel session. The session id lives in the URL, so a
 * refresh resumes exactly where the shopper was. `ref` here is always the
 * funnel id (the entry page replaces a subdomain ref with it after starting).
 *
 * The page tree is rendered server-side with the regular PageRenderer (its
 * commerce blocks are async server components); the step-type behaviour
 * (CTA / COD form / offer / confirmation) is a client island underneath.
 */
export default async function FunnelStepPage({ params }: { params: Params }) {
  const { workspaceId, ref, sessionId } = await params;
  if (!UUID.test(ref)) redirect(`/store/${workspaceId}/f/${encodeURIComponent(ref)}`);
  if (!UUID.test(sessionId)) redirect(`/store/${workspaceId}/f/${ref}`);

  const [store, result] = await Promise.all([getStoreMeta(workspaceId), loadStep(workspaceId, ref, sessionId)]);
  if (!store) notFound();

  if (!result.ok) {
    // Unknown/expired session: start (or resume) a fresh one for this visitor.
    if (result.kind === "sessionGone") redirect(`/store/${workspaceId}/f/${ref}`);
    if (result.kind === "notFound") notFound();
    return <FunnelUnavailable kind={result.kind === "paused" ? "paused" : "error"} />;
  }

  const { data } = result;
  if (data.done || !data.step) {
    return <FunnelDone workspaceId={workspaceId} sessionId={sessionId} orderId={data.session.orderId} />;
  }

  const { step } = data;
  const locale = await getStoreLocale(store);

  let product: StorefrontProductDetail | null = null;
  if (step.stepType === "checkout") {
    for (const id of productIdsIn(step.tree)) {
      product = await getStorefrontProduct(workspaceId, id);
      if (product) break;
    }
  }

  return (
    <main className="flex-1">
      <PageRenderer tree={step.tree} workspaceId={workspaceId} currency={store.currency} locale={locale} />
      <FunnelStepActions
        key={step.key}
        workspaceId={workspaceId}
        funnelId={ref}
        sessionId={sessionId}
        stepType={step.stepType}
        offer={data.offer ?? null}
        product={product}
        sessionOrderId={data.session.orderId}
      />
    </main>
  );
}
