/**
 * The store's blog (backend modules/blog, handoff item 190): categories,
 * posts written as blocks, a posts index, the latest posts for the home page,
 * and posts in the sitemap.
 *
 * Staff (website.edit), /workspaces/:workspaceId/blog:
 *   GET    /categories            → { categories: [{ …, postsCount }] }   (live posts only)
 *   POST   /categories            → 201 { category }
 *   PATCH  /categories/:id        → { category }
 *   DELETE /categories/:id        → { deleted }   (its posts stay, uncategorised)
 *   GET    /posts?state&categoryId&q&page&limit → { posts, total, page, limit }
 *   POST   /posts                 → 201 { post }
 *   GET    /posts/:id             → { post }
 *   PATCH  /posts/:id             → { post }
 *   DELETE /posts/:id             → { deleted }
 *
 * Public (cached 60 s), /store/:workspaceId/blog:
 *   GET /posts?category&tag&page&limit → { posts, total, page, limit, category }  (404 unknown category)
 *   GET /posts/:slug              → { post, related }   (drafts and scheduled posts: 404)
 *   GET /categories               → { categories }
 *   GET /latest?limit             → { posts }
 *
 * Rules: ≤200 blocks; image and cover URLs https only; a button URL is https
 * or a store path starting with "/"; product blocks name this store's
 * products; no HTML anywhere (text is shown as text). `status: "published"`
 * without `publishedAt` publishes now; a future `publishedAt` is a scheduled
 * post. Slugs keep Arabic letters. Codes: SLUG_TAKEN (409), NOT_FOUND (404),
 * VALIDATION_ERROR (422, details [{ field: "blocks.3.url", message }]).
 */
import type { ApiClient } from "../client";

export const BLOG_BLOCKS_MAX = 200;
export const BLOG_TAGS_MAX = 20;

export type BlogPostState = "draft" | "published" | "scheduled";
export type BlogBlockType = "heading" | "paragraph" | "image" | "list" | "quote" | "product" | "button" | "divider";

export const BLOG_BLOCK_TYPES: readonly BlogBlockType[] = ["heading", "paragraph", "image", "list", "quote", "product", "button", "divider"];

export interface BlogCategoryRef {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
}

export interface BlogCategory extends BlogCategoryRef {
  /** Live (published, not scheduled) posts in it. */
  postsCount: number;
}

export interface BlogCategoryInput {
  name: string;
  /** Empty: made from the name. */
  slug?: string;
  description?: string | null;
  position?: number;
}

/** The product as a post shows it now; only on the public post. */
export interface BlogBlockProduct {
  name: string;
  slug: string;
  imageUrl: string | null;
  price: { amount: string; compareAt: string | null; currency: string } | null;
}

export type BlogBlock =
  | { type: "heading"; text: string; level?: 2 | 3 }
  | { type: "paragraph"; text: string }
  | { type: "image"; url: string; alt?: string; caption?: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "quote"; text: string; cite?: string }
  | { type: "product"; productId: string; product?: BlogBlockProduct }
  | { type: "button"; label: string; url: string }
  | { type: "divider" };

export interface BlogSeo {
  title?: string;
  description?: string;
  noindex?: boolean;
}

export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverUrl: string | null;
  authorName: string | null;
  tags: string[];
  category: BlogCategoryRef | null;
  publishedAt: string | null;
  readingMinutes: number;
}

export interface BlogPostListItem extends BlogPostSummary {
  state: BlogPostState;
  updatedAt: string;
}

export interface BlogPost extends BlogPostSummary {
  state: BlogPostState;
  status: "draft" | "published";
  blocks: BlogBlock[];
  seo: BlogSeo | null;
  updatedAt: string;
}

export interface BlogPostInput {
  title?: string;
  /** Empty: made from the title. */
  slug?: string;
  excerpt?: string | null;
  coverUrl?: string | null;
  authorName?: string | null;
  tags?: string[];
  categoryId?: string | null;
  status?: "draft" | "published";
  /** Omit with "published" to publish now; a future date schedules the post. */
  publishedAt?: string | null;
  seo?: BlogSeo;
  blocks?: BlogBlock[];
}

export interface BlogPostListParams {
  state?: BlogPostState;
  categoryId?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface BlogPostPage<T> {
  posts: T[];
  total: number;
  page: number;
  limit: number;
}

const staffBase = (workspaceId: string) => `/workspaces/${workspaceId}/blog`;

function queryOf(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

// ------------------------------------------------------------- staff --

export async function blogCategoriesList(client: ApiClient, workspaceId: string): Promise<BlogCategory[]> {
  const body = await client.request<{ categories?: BlogCategory[] }>(`${staffBase(workspaceId)}/categories`);
  return body.categories ?? [];
}

export async function blogCategoryCreate(client: ApiClient, workspaceId: string, input: BlogCategoryInput): Promise<BlogCategoryRef> {
  const { category } = await client.request<{ category: BlogCategoryRef }>(`${staffBase(workspaceId)}/categories`, { method: "POST", body: input });
  return category;
}

export async function blogCategoryUpdate(
  client: ApiClient,
  workspaceId: string,
  id: string,
  patch: Partial<BlogCategoryInput>
): Promise<BlogCategoryRef> {
  const { category } = await client.request<{ category: BlogCategoryRef }>(`${staffBase(workspaceId)}/categories/${id}`, { method: "PATCH", body: patch });
  return category;
}

export async function blogCategoryDelete(client: ApiClient, workspaceId: string, id: string): Promise<void> {
  await client.request(`${staffBase(workspaceId)}/categories/${id}`, { method: "DELETE" });
}

export async function blogPostsList(
  client: ApiClient,
  workspaceId: string,
  params: BlogPostListParams = {}
): Promise<BlogPostPage<BlogPostListItem>> {
  const body = await client.request<Partial<BlogPostPage<BlogPostListItem>>>(
    `${staffBase(workspaceId)}/posts${queryOf({ state: params.state, categoryId: params.categoryId, q: params.q?.trim(), page: params.page, limit: params.limit })}`
  );
  return { posts: body.posts ?? [], total: body.total ?? 0, page: body.page ?? 1, limit: body.limit ?? params.limit ?? 20 };
}

export async function blogPostGet(client: ApiClient, workspaceId: string, id: string): Promise<BlogPost> {
  const { post } = await client.request<{ post: BlogPost }>(`${staffBase(workspaceId)}/posts/${id}`);
  return post;
}

export async function blogPostCreate(client: ApiClient, workspaceId: string, input: BlogPostInput & { title: string }): Promise<BlogPost> {
  const { post } = await client.request<{ post: BlogPost }>(`${staffBase(workspaceId)}/posts`, { method: "POST", body: input });
  return post;
}

export async function blogPostUpdate(client: ApiClient, workspaceId: string, id: string, patch: BlogPostInput): Promise<BlogPost> {
  const { post } = await client.request<{ post: BlogPost }>(`${staffBase(workspaceId)}/posts/${id}`, { method: "PATCH", body: patch });
  return post;
}

export async function blogPostDelete(client: ApiClient, workspaceId: string, id: string): Promise<void> {
  await client.request(`${staffBase(workspaceId)}/posts/${id}`, { method: "DELETE" });
}

// ------------------------------------------------------------ public --

const storeBase = (workspaceId: string) => `/store/${encodeURIComponent(workspaceId)}/blog`;

export interface StorefrontBlogList extends BlogPostPage<BlogPostSummary> {
  /** The category asked for, or null for every post. */
  category: BlogCategoryRef | null;
}

/** One page of live posts, newest first; an unknown category answers 404. */
export async function storefrontBlogPosts(
  client: ApiClient,
  workspaceId: string,
  params: { category?: string; tag?: string; page?: number; limit?: number } = {}
): Promise<StorefrontBlogList> {
  const body = await client.request<Partial<StorefrontBlogList>>(
    `${storeBase(workspaceId)}/posts${queryOf({ category: params.category, tag: params.tag, page: params.page, limit: params.limit })}`,
    { auth: false }
  );
  return {
    posts: body.posts ?? [],
    total: body.total ?? 0,
    page: body.page ?? 1,
    limit: body.limit ?? params.limit ?? 12,
    category: body.category ?? null,
  };
}

export interface StorefrontBlogPost extends BlogPostSummary {
  blocks: BlogBlock[];
  seo: BlogSeo;
}

/** A live post by its slug, with up to three related posts; 404 for drafts, scheduled and unknown posts. */
export async function storefrontBlogPost(
  client: ApiClient,
  workspaceId: string,
  slug: string
): Promise<{ post: StorefrontBlogPost; related: BlogPostSummary[] }> {
  const body = await client.request<{ post: StorefrontBlogPost; related?: BlogPostSummary[] }>(
    `${storeBase(workspaceId)}/posts/${encodeURIComponent(slug)}`,
    { auth: false }
  );
  return { post: { ...body.post, blocks: body.post.blocks ?? [], seo: body.post.seo ?? {} }, related: body.related ?? [] };
}

export async function storefrontBlogCategories(client: ApiClient, workspaceId: string): Promise<BlogCategory[]> {
  const body = await client.request<{ categories?: BlogCategory[] }>(`${storeBase(workspaceId)}/categories`, { auth: false });
  return body.categories ?? [];
}

/** The newest live posts, for the home page's "From our blog". */
export async function storefrontBlogLatest(client: ApiClient, workspaceId: string, limit = 3): Promise<BlogPostSummary[]> {
  const body = await client.request<{ posts?: BlogPostSummary[] }>(`${storeBase(workspaceId)}/latest${queryOf({ limit })}`, { auth: false });
  return body.posts ?? [];
}
