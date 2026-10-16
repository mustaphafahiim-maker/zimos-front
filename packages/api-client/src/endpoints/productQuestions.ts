/**
 * Product questions and answers (backend: src/modules/productQuestions).
 *
 * A shopper asks on the product page; nothing they write is shown before the
 * store answers and publishes it. The asker's email is private: it is only
 * used to tell them about the answer, once.
 *
 * Storefront (public), /store/:ws/products/:productId/questions:
 *   GET  ?limit=20&offset=0 → { questions: StorefrontProductQuestion[], total }
 *        published only, newest answers first (cached 2 minutes).
 *   POST ProductQuestionAsk → 201 { received: true, status: "pending" }
 *        429 after 5 questions an hour from one address; 404 for a product not on sale.
 *
 * Dashboard, /workspaces/:ws/product-questions (read products.view, change products.manage):
 *   GET    ?status=&productId=&limit=&offset= → ProductQuestionPage (newest first)
 *   PATCH  /:id { answer?, status? } → ProductQuestion — an answer publishes by default;
 *          publishing without an answer → 422 ANSWER_REQUIRED. The first published
 *          answer emails the asker once, in their language.
 *   DELETE /:id → 204
 * A new question raises the merchant notification `product.question`
 * (link /products/:id?tab=questions).
 */
import type { ApiClient } from "../client";

export type ProductQuestionStatus = "pending" | "published" | "hidden";

/** What the product page shows of a question. */
export interface StorefrontProductQuestion {
  id: string;
  question: string;
  /** The name the shopper gave, if any. */
  askerName: string | null;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
}

export interface ProductQuestion extends StorefrontProductQuestion {
  productId: string;
  /** Missing when the product is gone. */
  productName?: string;
  /** Private: never shown in the store. */
  askerEmail: string | null;
  status: ProductQuestionStatus;
  /** The language the shopper asked in ("ar", "en", "fr"), when known. */
  locale: string | null;
  /** The teammate who answered (a user id). */
  answeredBy: string | null;
}

export interface ProductQuestionPage {
  questions: ProductQuestion[];
  /** How many match the filter. */
  total: number;
  /** How many wait for an answer in the whole store, whatever the filter. */
  pending: number;
}

export interface ProductQuestionListQuery {
  status?: ProductQuestionStatus;
  productId?: string;
  /** 1–200, default 50. */
  limit?: number;
  offset?: number;
}

export interface ProductQuestionUpdate {
  /** Up to 3000 characters; "" or null clears it (a published question then needs another status). */
  answer?: string | null;
  status?: ProductQuestionStatus;
}

/** What the API accepts (productQuestions/index.js). */
export const PRODUCT_QUESTION_LIMITS = { questionMin: 5, question: 1000, name: 120, email: 255, answer: 3000 } as const;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/product-questions`;

export function productQuestionsList(
  client: ApiClient,
  workspaceId: string,
  query: ProductQuestionListQuery = {}
): Promise<ProductQuestionPage> {
  const qs = new URLSearchParams();
  if (query.status) qs.set("status", query.status);
  if (query.productId) qs.set("productId", query.productId);
  if (query.limit) qs.set("limit", String(query.limit));
  if (query.offset) qs.set("offset", String(query.offset));
  const s = qs.toString();
  return client.request<ProductQuestionPage>(`${base(workspaceId)}${s ? `?${s}` : ""}`);
}

export function productQuestionUpdate(
  client: ApiClient,
  workspaceId: string,
  questionId: string,
  body: ProductQuestionUpdate
): Promise<ProductQuestion> {
  return client.request<ProductQuestion>(`${base(workspaceId)}/${questionId}`, { method: "PATCH", body });
}

export async function productQuestionDelete(client: ApiClient, workspaceId: string, questionId: string): Promise<void> {
  await client.request<unknown>(`${base(workspaceId)}/${questionId}`, { method: "DELETE" });
}

// ----------------------------------------------------------- storefront --

export interface StorefrontProductQuestions {
  questions: StorefrontProductQuestion[];
  total: number;
}

export interface ProductQuestionAsk {
  /** 5–1000 characters. */
  question: string;
  name?: string;
  /** Private; only to tell the shopper about the answer. */
  email?: string;
  /** The language the shopper reads the store in. */
  locale?: "ar" | "en" | "fr";
}

const storeBase = (workspaceRef: string, productId: string) => `/store/${workspaceRef}/products/${productId}/questions`;

/** A product's published questions, newest answers first. `workspaceRef` is the store's id or slug; the product by id. */
export function storefrontProductQuestions(
  client: ApiClient,
  workspaceRef: string,
  productId: string,
  page: { limit?: number; offset?: number } = {}
): Promise<StorefrontProductQuestions> {
  const qs = new URLSearchParams();
  if (page.limit) qs.set("limit", String(page.limit));
  if (page.offset) qs.set("offset", String(page.offset));
  const s = qs.toString();
  return client.request<StorefrontProductQuestions>(`${storeBase(workspaceRef, productId)}${s ? `?${s}` : ""}`, { auth: false });
}

/** A shopper's question. It waits for the store: nothing is shown before it is answered. */
export function storefrontAskProductQuestion(
  client: ApiClient,
  workspaceRef: string,
  productId: string,
  body: ProductQuestionAsk
): Promise<{ received: true; status: "pending" }> {
  return client.request(storeBase(workspaceRef, productId), { method: "POST", body, auth: false });
}
