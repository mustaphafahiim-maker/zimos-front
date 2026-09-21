import type { Metadata } from "next";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import {
  ApiError,
  funnelsGetSessionStep,
  funnelsRuntimeErrorKind,
  type FunnelRuntimeErrorKind,
  type FunnelStepResponse,
  type PageTree,
  type StorefrontProduct,
} from "@store-builder/api-client";
import { FunnelDone, FunnelStepActions } from "@/components/funnel/FunnelStep";
import { FunnelUnavailable } from "@/components/funnel/FunnelUnavailable";
import { PageRenderer } from "@/components/page-renderer";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { storeHref } from "@/lib/storeHref";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta, getStorefrontProduct } from "@/lib/storeMeta";
import { getStoreBasePath } from "@/lib/storeRoute";

type Params = Promise<{ workspaceId: string; ref: string; sessionId: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Loaded = { ok: true; data: FunnelStepResponse } | { ok: false; kind: FunnelRuntimeErrorKind };

/** Deduped so generateMetadata and the page share one step lookup. */
const loadStep = cache(async (workspaceId: string, funnelId: string, sessionId: string): Promise<Loaded> => {
  const client = await createServerStorefrontApiClient();
  try {
    return { ok: true, data: await funnelsGetSessionStep(client, workspaceId, funnelId, sessionId) };
  } catch (err) {
    const kind = funnelsRuntimeErrorKind(err);
    // Anything unexpected from the API (5xx) is still shown as "try again";
    // only a failure that isn't the API's at all is rethrown.
    if (kind === "other" && !(err instanceof ApiError)) throw err;
    return { ok: false, kind };
  }
});

function seoString(seo: Record<string, unknown> | undefined, key: string) {
  const v = seo?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** The step's own SEO from the published snapshot; the funnel layout keeps it noindex. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId, ref, sessionId } = await params;
  if (!UUID.test(ref) || !UUID.test(sessionId)) return {};
  const result = await loadStep(workspaceId, ref, sessionId);
  if (!result.ok || !result.data.step) return {};
  const { step } = result.data;
  const title = seoString(step.seo, "title") ?? step.name;
  const description = seoString(step.seo, "description");
  const ogImage = seoString(step.seo, "ogImage");
  return {
    title,
    description,
    openGraph: {
      title: seoString(step.seo, "ogTitle") ?? title,
      description: seoString(step.seo, "ogDescription") ?? description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

/**
 * The product a checkout step sells: the first `product_card` the merchant
 * placed in the step's page, found the same way ProductCardElement finds it —
 * `productId` is an id or a slug, and an empty one means the first product the
 * catalogue returns. Null when the step has no product card.
 */
async function checkoutProduct(workspaceId: string, tree: PageTree | null): Promise<StorefrontProduct | null> {
  for (const section of tree?.sections ?? []) {
    for (const row of section.rows ?? []) {
      for (const column of row.columns ?? []) {
        for (const el of column.elements ?? []) {
          if (el.type !== "product_card") continue;
          const raw = (el.props as Record<string, unknown> | undefined)?.productId;
          const ref = typeof raw === "string" ? raw.trim() : "";
          if (ref) {
            const product = await getStorefrontProduct(workspaceId, ref);
            if (product) return product;
            continue;
          }
          try {
            const client = await createServerStorefrontApiClient();
            const { products } = await client.listStorefrontProducts(workspaceId, { limit: 1 });
            if (products[0]) return products[0];
          } catch {
            /* no catalogue — try the next card */
          }
        }
      }
    }
  }
  return null;
}

/**
 * One step of a running funnel session: /f/<funnelId>/<sessionId>. The URL is
 * the session's, not the step's — the server reads which step the session is
 * on, so a reload resumes exactly there and an advance just refreshes in place.
 *
 * The step's page is the merchant's page tree, rendered with the store's own
 * PageRenderer (its commerce blocks are async server components); what the
 * shopper does on the step — continue, order, accept/decline — is the client
 * island underneath (components/funnel/FunnelStep).
 */
export default async function FunnelStepPage({ params }: { params: Params }) {
  const { workspaceId, ref, sessionId } = await params;
  const basePath = await getStoreBasePath(workspaceId);
  // Only the entry resolves a subdomain; a malformed session starts over.
  if (!UUID.test(ref)) redirect(storeHref(basePath, `/f/${encodeURIComponent(ref)}`));
  if (!UUID.test(sessionId)) redirect(storeHref(basePath, `/f/${ref}`));

  const [store, result] = await Promise.all([getStoreMeta(workspaceId), loadStep(workspaceId, ref, sessionId)]);
  if (!store) notFound();

  if (!result.ok) {
    // An unknown session (or one from another funnel): start or resume one.
    if (result.kind === "sessionGone") redirect(storeHref(basePath, `/f/${ref}`));
    return <FunnelUnavailable kind={result.kind === "paused" || result.kind === "unavailable" ? "unavailable" : "error"} />;
  }

  const { data } = result;
  if (data.done || !data.step) {
    return <FunnelDone workspaceId={workspaceId} sessionId={sessionId} orderId={data.session.orderId} />;
  }

  const { step, session } = data;
  const locale = await getStoreLocale(store);
  const tree = (step.tree ?? null) as PageTree | null;
  const product = step.stepType === "checkout" ? await checkoutProduct(workspaceId, tree) : null;

  return (
    <main className="flex-1">
      <PageRenderer tree={tree} workspaceId={workspaceId} currency={store.currency} locale={locale} />
      <FunnelStepActions
        // A new step (or the same step reached again) starts with fresh state.
        key={`${step.key}:${session.path.length}`}
        workspaceId={workspaceId}
        funnelId={ref}
        sessionId={sessionId}
        step={{ key: step.key, name: step.name, stepType: step.stepType }}
        offer={data.offer ?? null}
        product={product}
        sessionOrderId={session.orderId}
      />
    </main>
  );
}
