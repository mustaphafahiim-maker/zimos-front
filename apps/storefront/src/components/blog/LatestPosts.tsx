import { storefrontBlogLatest } from "@store-builder/api-client";
import { ArrowIcon } from "@/components/Icons";
import { StoreLink } from "@/components/StoreRoute";
import { btnGhost, container } from "@/components/ui";
import type { Dictionary, Locale } from "@/lib/i18n";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { PostCard } from "./PostCard";

/**
 * The home page's "From our blog" (handoff 190): the three newest posts and a
 * link to the rest. A store without posts — or a blog that fails to load —
 * shows nothing here, so the home page never carries an empty section.
 */
export async function LatestPosts({ workspaceId, t, locale }: { workspaceId: string; t: Dictionary; locale: Locale }) {
  const client = await createServerStorefrontApiClient();
  const posts = await storefrontBlogLatest(client, workspaceId, 3).catch(() => []);
  if (posts.length === 0) return null;

  return (
    <section aria-labelledby="latest-posts-title" className={`${container} pb-16`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="latest-posts-title" className="font-display text-2xl font-bold text-ink">
          {t.blog.fromOurBlog}
        </h2>
        <StoreLink href="/blog" className={btnGhost}>
          {t.blog.readMore}
          <ArrowIcon size={16} className="rtl:rotate-180" />
        </StoreLink>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} t={t} locale={locale} heading="h3" />
        ))}
      </div>
    </section>
  );
}
