"use client";

import type { StorefrontProduct } from "@store-builder/api-client";
import { useFunnelSession, type FunnelSessionInfo } from "@/lib/funnelSessionContext";
import { orderBumpOf } from "@/lib/commerce";
import { FunnelCheckout, useAdvance } from "./FunnelStep";

/**
 * A `cod_form` element on a funnel page (SPEC §9.2: a sales step can hold its
 * own order form): the funnel checkout's form for this product, placing the
 * order in the funnel and following the step's "order" link. A checkout step
 * already has that form under its page, so there it draws nothing. The
 * step's order bump (set on the sales step) and the product's own bumps show
 * above its order button.
 */
export function FunnelCodForm({ product, title }: { product: StorefrontProduct; title: string }) {
  const session = useFunnelSession();
  if (!session || session.stepType === "checkout") return null;
  return <Form session={session} product={product} title={title} />;
}

function Form({ session, product, title }: { session: FunnelSessionInfo; product: StorefrontProduct; title: string }) {
  const flow = useAdvance(session.workspaceId, session.funnelId, session.sessionId, session.stepKey);
  return (
    <FunnelCheckout
      workspaceId={session.workspaceId}
      funnelId={session.funnelId}
      sessionId={session.sessionId}
      stepKey={session.stepKey}
      sessionOrderId={session.sessionOrderId}
      product={product}
      bumpOffer={orderBumpOf(session.bump, [product.id])}
      flow={flow}
      embedded
      title={title}
    />
  );
}
