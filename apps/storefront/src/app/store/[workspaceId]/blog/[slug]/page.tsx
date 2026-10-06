import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ApiError, storefrontBlogPost } from "@store-builder/api-client";
import { BlogBlocks } from "@/components/blog/BlogBlocks";
import { BlogBreadcrumbs } from "@/components/blog/BlogBreadcrumbs";
import { PostCard } from "@/components/blog/PostCard";
import { ArrowIcon } from "@/components/Icons";
import { StoreLink } from "@/components/StoreRoute";
import { btnGhost, container, focusRing } from "@/components/ui";
import { blogHref, postDate, postHref } from "@/lib/blog";
import { canonicalOrigin } from "@/lib/domains";
import { getDictionary } from "@/lib/i18n";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

export const revalidate = 60;

type Params = Promise<{ workspaceId: string; slug: string }>;

/** The address may carry the slug percent-encoded (Arabic slugs); the API wants it as written. */
function slugOf(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Deduped so generateMetadata and the page share one API call; null → 404 (drafts and scheduled posts too). */
const getPost = cache(async (workspaceId: string, slug: string) => {
  const client = await createServerStorefrontApiClient();
  try {
    return await storefrontBlogPost(client, workspaceId, slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
});

const seoText = (value: string | undefined) => (value && value.trim() ? value.trim() : undefined);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId, slug } = await params;
  const [store, found] = await Promise.all([getStoreMeta(workspaceId), getPost(workspaceId, slugOf(slug))]);
  if (!store || !found) return {};
  const { post } = found;
  const t = getDictionary(await getStoreLocale(store));
  const title = seoText(post.seo.title) ?? post.title;
  const description = seoText(post.seo.description) ?? seoText(post.excerpt ?? undefined) ?? t.blog.metaDescription(store.name);
  const url = postHref(post.slug);
  return {
    title,
    description,
    // The merchant's "hide this post from search engines" (post editor → Search engines).
    ...(post.seo.noindex === true ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: store.name,
      title,
      description,
      url,
      ...(post.publishedAt ? { publishedTime: post.publishedAt } : {}),
      ...(post.authorName ? { authors: [post.authorName] } : {}),
      ...(post.tags.length > 0 ? { tags: post.tags } : {}),
      ...(post.coverUrl ? { images: [{ url: post.coverUrl, alt: post.title }] } : {}),
    },
    twitter: { card: post.coverUrl ? "summary_large_image" : "summary", title, description },
  };
}

/**
 * One post of the store's blog (handoff 190): title, author, date and read
 * time, the cover, the merchant's blocks (product blocks as the store's own
 * product cards, with add to cart), its tags and up to three related posts.
 */
export default async function BlogPostPage({ params }: { params: Params }) {
  const { workspaceId, slug } = await params;
  const [store, found] = await Promise.all([getStoreMeta(workspaceId), getPost(workspaceId, slugOf(slug))]);
  if (!store || !found) notFound();
  const { post, related } = found;
  const locale = await getStoreLocale(store);
  const t = getDictionary(locale);

  const trail = [
    { label: t.blog.title, href: "/blog" },
    ...(post.category ? [{ label: post.category.name, href: blogHref({ category: post.category.slug }) }] : []),
    { label: post.title },
  ];

  // schema.org BlogPosting; "<" is escaped so nothing in a title can close the script tag.
  const origin = canonicalOrigin(store);
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    ...(post.excerpt ? { description: post.excerpt } : {}),
    ...(post.coverUrl ? { image: [post.coverUrl] } : {}),
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    ...(post.authorName ? { author: { "@type": "Person", name: post.authorName } } : {}),
    publisher: { "@type": "Organization", name: store.name, ...(store.logoUrl ? { logo: { "@type": "ImageObject", url: store.logoUrl } } : {}) },
    mainEntityOfPage: `${origin}${postHref(post.slug)}`,
    ...(post.tags.length > 0 ? { keywords: post.tags.join(", ") } : {}),
  }).replace(/</g, "\\u003c");

  return (
    <main className="flex-1 py-6 sm:py-10">
      <div className={container}>
        <article className="mx-auto max-w-2xl">
          <BlogBreadcrumbs t={t} trail={trail} />

          <header className="mt-2">
            {post.category && (
              <StoreLink
                href={blogHref({ category: post.category.slug })}
                className={`inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-primary hover:underline ${focusRing}`}
              >
                {post.category.name}
              </StoreLink>
            )}
            <h1 dir="auto" className="font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
              {post.title}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
              {post.authorName && <span>{t.blog.by(post.authorName)}</span>}
              {post.authorName && post.publishedAt && <span aria-hidden>·</span>}
              {post.publishedAt && <time dateTime={post.publishedAt}>{postDate(post.publishedAt, locale)}</time>}
              <span aria-hidden>·</span>
              <span>{t.blog.readTime(post.readingMinutes)}</span>
            </p>
          </header>

          {post.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.coverUrl}
              alt=""
              width={1200}
              height={675}
              className="mt-6 aspect-[16/9] w-full rounded-2xl border border-line bg-paper object-cover"
            />
          )}

          {post.excerpt && (
            <p dir="auto" className="mt-6 text-lg leading-relaxed text-ink-soft">
              {post.excerpt}
            </p>
          )}

          <div className="mt-6">
            <BlogBlocks blocks={post.blocks} workspaceId={workspaceId} currency={store.currency} locale={locale} />
          </div>

          {post.tags.length > 0 && (
            <div className="mt-10 border-t border-line pt-6">
              <h2 className="text-sm font-semibold text-ink">{t.blog.tags}</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <li key={tag}>
                    <StoreLink
                      href={blogHref({ tag })}
                      className={`inline-flex min-h-11 items-center rounded-full border border-line bg-paper-raised px-4 text-sm text-ink-soft transition-colors hover:border-primary hover:text-primary ${focusRing}`}
                    >
                      #{tag}
                    </StoreLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8">
            <StoreLink href="/blog" className={btnGhost}>
              <ArrowIcon size={16} className="rotate-180 rtl:rotate-0" />
              {t.blog.backToBlog}
            </StoreLink>
          </div>
        </article>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-posts-title" className={`${container} mt-12 border-t border-line pt-10`}>
          <h2 id="related-posts-title" className="font-display text-2xl font-bold text-ink">
            {t.blog.relatedPosts}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {related.map((item) => (
              <PostCard key={item.id} post={item} t={t} locale={locale} heading="h3" />
            ))}
          </div>
        </section>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    </main>
  );
}
