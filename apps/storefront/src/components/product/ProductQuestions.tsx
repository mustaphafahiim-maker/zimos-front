import { storefrontProductQuestions, type StorefrontProductQuestions } from "@store-builder/api-client";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { ProductQuestionsList } from "./ProductQuestionsList";

const NONE: StorefrontProductQuestions = { questions: [], total: 0 };
/** The API's own default page; the list asks for the same size when the shopper wants more. */
const FIRST_PAGE = 20;

/**
 * The product page's «أسئلة وأجوبة» block (frontend-handoff 212). The first
 * page of published questions is read here, on the server, so the answers
 * are part of the page as it arrives; asking, and any further page, happen in
 * the browser (ProductQuestionsList). A failed read shows the block empty —
 * the shopper can still ask.
 */
export async function ProductQuestions({ workspaceId, productId }: { workspaceId: string; productId: string }) {
  const client = await createServerStorefrontApiClient();
  const initial = await storefrontProductQuestions(client, workspaceId, productId, { limit: FIRST_PAGE }).catch(() => NONE);
  return <ProductQuestionsList workspaceId={workspaceId} productId={productId} initial={initial} />;
}
