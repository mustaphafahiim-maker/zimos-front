import type { BlogPostSummary } from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import type { Dictionary, Locale } from "@/lib/i18n";
import { postDate, postHref } from "@/lib/blog";

/**
 * One post on the blog index, a category page, "Related posts" and the home
 * page's "From our blog": cover, category, title, summary, date and read
 * time. The whole card opens the post (a stretched link on the title).
 */
export function PostCard({
  post,
  t,
  locale,
  heading: Heading = "h2",
}: {
  post: BlogPostSummary;
  t: Dictionary;
  locale: Locale;
  heading?: "h2" | "h3";
}) {
  return (
    <article className="zt-card group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper-raised transition-[border-color,box-shadow] hover:border-primary hover:shadow-lg">
      <div className="aspect-[16/9] overflow-hidden bg-paper">
        {post.coverUrl ? (
          // Merchant media are arbitrary remote URLs (no next/image allowlist).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverUrl}
            alt=""
            width={640}
            height={360}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <div aria-hidden className="flex h-full w-full items-center justify-center bg-primary-soft font-display text-5xl font-bold text-primary">
            {post.title.trim().charAt(0)}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {post.category && <p className="text-xs font-semibold text-primary">{post.category.name}</p>}
        <Heading className="mt-1 line-clamp-2 font-display text-base font-bold leading-snug text-ink sm:text-lg">
          <StoreLink href={postHref(post.slug)} className="after:absolute after:inset-0 focus-visible:outline-none">
            {post.title}
          </StoreLink>
        </Heading>
        {post.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">{post.excerpt}</p>}
        <p className="mt-auto flex flex-wrap items-center gap-x-2 pt-4 text-xs text-ink-soft">
          {post.publishedAt && <time dateTime={post.publishedAt}>{postDate(post.publishedAt, locale)}</time>}
          {post.publishedAt && <span aria-hidden>·</span>}
          <span>{t.blog.readTime(post.readingMinutes)}</span>
        </p>
      </div>
    </article>
  );
}
