/**
 * Reviews endpoints (backend: src/modules/reviews). Owned by the reviews/returns/domains/templates wiring task.
 * All exported names in this file are prefixed with `reviews`.
 *
 * Staff routes, mounted at /workspaces/:workspaceId/reviews, permission `products.manage`.
 */
import type { ApiClient } from "../client";

/** Exact enum from db/models/Review.js. */
export type ReviewStatus = "pending" | "approved" | "rejected";
/** Exact values accepted by PATCH /reviews/:id (reviewValidation.moderate). */
export type ReviewModerationAction = "approve" | "reject";

export interface ReviewDTO {
  id: string;
  workspaceId: string;
  productId: string;
  customerId: string;
  orderId: string | null;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  /** Included by listReviews (attributes id, name); absent on the moderate response. */
  product?: { id: string; name: string } | null;
  /** Included by listReviews (attributes id, fullName). */
  customer?: { id: string; fullName: string | null } | null;
}

export interface ReviewsListParams {
  status?: ReviewStatus;
}

export async function reviewsList(client: ApiClient, workspaceId: string, params: ReviewsListParams = {}) {
  const qs = params.status ? `?status=${encodeURIComponent(params.status)}` : "";
  const { reviews } = await client.request<{ reviews: ReviewDTO[] }>(`/workspaces/${workspaceId}/reviews${qs}`);
  return reviews;
}

export async function reviewsModerate(
  client: ApiClient,
  workspaceId: string,
  reviewId: string,
  action: ReviewModerationAction
) {
  const { review } = await client.request<{ review: ReviewDTO }>(`/workspaces/${workspaceId}/reviews/${reviewId}`, {
    method: "PATCH",
    body: { action },
  });
  return review;
}
