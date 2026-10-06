import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ApiError, storefrontBlogCategories, storefrontBlogPosts, type BlogCategory } from "@store-builder/api-client";
import { BlogBreadcrumbs } from "@/components/blog/BlogBreadcrumbs";
import { PostCard } from "@/components/blog/PostCard";
import { ChevronIcon } from "@/components/Icons";
import { StoreLink } from "@/components/StoreRoute";
import { container, focusRing } from "@/components/ui";
import { blogHref, oneParam } from "@/lib/blog";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

export const revalidate = 60;

type Params = Promise<{ workspaceId: string }>;
type Query = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 12;

interface BlogQuery {
  category?: string;
  tag?: string;
  page: number;
}

function readQuery(query: Record<string, string | string[] | undefined>): BlogQuery {
  const page = Number.parseInt(oneParam(query.page) ?? "1", 10);
  return {
    category: oneParam(query.category),
    tag: oneParam(query.tag)?.toLowerCase(),
    page: Number.isFinite(page) && page >= 1 && page <= 1000 ? page : 1,
  };
}

/** One page of posts, deduped between generateMetadata and the page; null for an unknown category. */
const getList = cache(async (workspaceId: string, category: string | undefined, tag: string | undefined, page: number) => {
  const client = await createServerStorefrontApiClient();
  try {
    return await storefrontBlogPosts(client, workspaceId, { category, tag, page, limit: PAGE_SIZE });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
});

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Query }): Promise<Metadata> {
  const [{ workspaceId }, query] = await Promise.all([params, searchParams]);
  const store = await getStoreMeta(workspaceId);
  if (!store) return {};
  const t = getDictionary(await getStoreLocale(store));
  const q = readQuery(query);
  const list = await getList(workspaceId, q.category, q.tag, q.page);
  if (!list) return {};
  if (q.tag) {
    // A tag's list is a filter of the index, not a page of its own to index.
    return { title: t.blog.tagged(q.tag), robots: { index: false, follow: true } };
  }
  const category = list.category;
  const title = category ? category.name : t.blog.title;
  const description = (category?.description ?? "").trim() || t.blog.metaDescription(store.name);
  const url = blogHref({ category: category?.slug, page: q.page });
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: store.name, title, description, url },
    twitter: { card: "summary", title, description },
  };
}

/**
 * The store's blog (handoff 190): every live post newest first, one
 * category's (`?category=<slug>`) or one tag's (`?tag=`), twelve a page.
 * Category chips above the cards; drafts and scheduled posts never show.
 */
export default async function BlogIndexPage({ params, searchParams }: { params: Params; searchParams: Query }) {
  const [{ workspaceId }, query] = await Promise.all([params, searchParams]);
  const store = await getStoreMeta(workspaceId);
  if (!store) notFound();
  const locale = await getStoreLocale(store);
  const t = getDictionary(locale);
  const q = readQuery(query);

  const client = await createServerStorefrontApiClient();
  const [list, categories] = await Promise.all([
    getList(workspaceId, q.category, q.tag, q.page),
    storefrontBlogCategories(client, workspaceId).catch((): BlogCategory[] => []),
  ]);
  // An unknown category is a missing page, not an empty one.
  if (!list) notFound();

  const category = list.category;
  const heading = category ? category.name : q.tag ? t.blog.tagged(q.tag) : t.blog.title;
  const intro = category ? (category.description ?? "").trim() : "";
  // Chips for the categories that have something to read, and the one on screen.
  const chips = categories.filter((c) => c.postsCount > 0 || c.slug === category?.slug);
  const filtered = Boolean(category || q.tag);

  const chip = (active: boolean) =>
    `zt-chip inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors ${focusRing} ${
      active
        ? "border-primary bg-primary text-on-primary"
        : "border-line bg-paper-raised text-ink-soft hover:border-primary hover:text-primary"
    }`;

  return (
    <main className={`${container} flex-1 py-6 sm:py-10`}>
      <BlogBreadcrumbs t={t} trail={filtered ? [{ label: t.blog.title, href: "/blog" }, { label: heading }] : [{ label: t.blog.title }]} />

      <header className="mt-2 max-w-2xl">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{heading}</h1>
        {intro && <p className="mt-3 text-base leading-relaxed text-ink-soft sm:text-lg">{intro}</p>}
      </header>

      {chips.length > 0 && (
        <nav aria-label={t.blog.categories} className="-mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-2 pb-1">
            <li>
              <StoreLink href="/blog" className={chip(!filtered)} aria-current={!filtered ? "page" : undefined}>
                {t.blog.allPosts}
              </StoreLink>
            </li>
            {chips.map((c) => (
              <li key={c.id}>
                <StoreLink
                  href={blogHref({ category: c.slug })}
                  className={chip(category?.slug === c.slug)}
                  aria-current={category?.slug === c.slug ? "page" : undefined}
                >
                  {c.name}
                </StoreLink>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {list.posts.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line bg-paper-raised px-6 py-16 text-center text-sm text-ink-soft">
          {category ? t.blog.emptyCategory : q.tag ? t.blog.emptyTag : t.blog.empty}
          {filtered && (
            <>
              <br />
              <StoreLink href="/blog" className={`mt-3 inline-flex min-h-11 items-center font-medium text-primary hover:underline ${focusRing}`}>
                {t.blog.allPosts}
              </StoreLink>
            </>
          )}
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {list.posts.map((post) => (
            <PostCard key={post.id} post={post} t={t} locale={locale} />
          ))}
        </div>
      )}

      <Pagination t={t} q={q} category={category?.slug} total={list.total} pageSize={list.limit || PAGE_SIZE} />
    </main>
  );
}

/** Previous / numbered / next, the current page and two either side — as the product listing pages. */
function Pagination({ t, q, category, total, pageSize }: { t: Dictionary; q: BlogQuery; category?: string; total: number; pageSize: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const current = Math.min(q.page, pages);
  const href = (page: number) => blogHref({ category, tag: q.tag, page });
  const shown = [...new Set([1, current - 2, current - 1, current, current + 1, current + 2, pages])]
    .filter((p) => p >= 1 && p <= pages)
    .sort((a, b) => a - b);
  const cell = `inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors ${focusRing}`;
  const idle = `${cell} border-line bg-paper-raised text-ink hover:border-primary hover:text-primary`;

  return (
    <nav aria-label={t.catalog.pagination} className="mt-10">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {current > 1 && (
          <li>
            <StoreLink href={href(current - 1)} rel="prev" className={idle}>
              <ChevronIcon size={16} className="rotate-90 rtl:-rotate-90" aria-hidden />
              <span className="sr-only">{t.catalog.previous}</span>
            </StoreLink>
          </li>
        )}
        {shown.map((page, i) => (
          <li key={page} className="flex items-center gap-2">
            {i > 0 && page - shown[i - 1] > 1 && <span aria-hidden className="text-ink-soft">…</span>}
            {page === current ? (
              <span aria-current="page" className={`${cell} border-primary bg-primary text-on-primary`}>
                <span className="sr-only">{t.catalog.page(page)}</span>
                <span aria-hidden>{page}</span>
              </span>
            ) : (
              <StoreLink href={href(page)} aria-label={t.catalog.page(page)} className={idle}>
                {page}
              </StoreLink>
            )}
          </li>
        ))}
        {current < pages && (
          <li>
            <StoreLink href={href(current + 1)} rel="next" className={idle}>
              <span className="sr-only">{t.catalog.next}</span>
              <ChevronIcon size={16} className="-rotate-90 rtl:rotate-90" aria-hidden />
            </StoreLink>
          </li>
        )}
      </ul>
    </nav>
  );
}
