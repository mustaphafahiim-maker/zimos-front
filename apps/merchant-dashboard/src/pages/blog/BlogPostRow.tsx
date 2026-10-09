import type { BlogPostListItem } from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { IconBlog } from "@/components/icons";
import { ListRowCard } from "@/components/list";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDate } from "@/lib/format";
import { useViewNavigate } from "@/lib/viewTransition";
import { ItemMenu } from "@/pages/catalog/media/ItemMenu";
import { BLOG_WORDS, STATE_TONE } from "./blogStrings";

const STRINGS = {
  en: {
    open: "Edit “{title}”",
    menuLabel: "Actions for “{title}”",
    untitled: "Untitled post",
    noCategory: "No category",
  },
  ar: {
    open: "عدّل «{title}»",
    menuLabel: "إجراءات «{title}»",
    untitled: "مقال من غير عنوان",
    noCategory: "من غير تصنيف",
  },
} satisfies Messages;

/** The columns of the posts sheet: the post, where it stands, its category, its date, its menu. */
export const POST_COLUMNS = "grid-cols-[minmax(0,2.2fr)_max-content_minmax(0,0.9fr)_max-content_max-content]";

function Cover({ post, className }: { post: BlogPostListItem; className: string }) {
  return post.coverUrl ? (
    <img src={post.coverUrl} alt="" loading="lazy" className={`${className} bg-paper-sunken object-cover`} />
  ) : (
    <span aria-hidden className={`${className} flex items-center justify-center bg-paper-sunken text-ink-soft`}>
      <IconBlog className="size-5" />
    </span>
  );
}

/**
 * One post in the list. The whole row is the way to its editor — a card on
 * narrow screens, a line of the sheet from a wide one (there the title is a
 * real link stretched over the line, so it opens in a new tab like any link).
 * «…» on it — and a right-click or a long press — holds the rest: view in the
 * store, delete.
 */
export function BlogPostRow({ post, compact, menu }: { post: BlogPostListItem; compact: boolean; menu: ContextMenuItem[] }) {
  const t = useT(STRINGS);
  const words = useT(BLOG_WORDS);
  const navigate = useViewNavigate();
  const to = `/blog/${post.id}`;
  const title = post.title || t.untitled;
  const menuLabel = fmt(t.menuLabel, { title });

  const state = <StatusBadge value={post.state} tone={STATE_TONE[post.state]} text={words[post.state]} />;
  const date =
    post.state === "published"
      ? fmt(words.publishedOn, { date: formatDate(post.publishedAt) })
      : post.state === "scheduled"
        ? fmt(words.goesLive, { date: formatDate(post.publishedAt) })
        : fmt(words.editedOn, { date: formatDate(post.updatedAt) });

  if (compact) {
    return (
      <li>
        <ContextMenu items={menu} label={menuLabel}>
          <ListRowCard
            leading={<Cover post={post} className="size-10" />}
            title={<bdi dir="auto">{title}</bdi>}
            status={state}
            meta={date}
            action={<ItemMenu items={menu} label={menuLabel} />}
            footer={
              post.category ? (
                <span className="inline-flex max-w-full items-center rounded-full bg-paper-sunken px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                  <bdi className="truncate">{post.category.name}</bdi>
                </span>
              ) : undefined
            }
            onOpen={() => navigate(to)}
            openLabel={fmt(t.open, { title })}
          />
        </ContextMenu>
      </li>
    );
  }

  return (
    <ContextMenu items={menu} label={menuLabel}>
      <li
        data-slot="queue-row"
        data-pressable=""
        className="relative col-span-full grid min-h-[4.25rem] grid-cols-subgrid items-center border-b border-line px-4 py-2 text-sm text-ink transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] last:border-b-0 hover:bg-paper-sunken/60 has-[[data-row-open]:focus-visible]:bg-paper-sunken/60 motion-reduce:transition-none"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Cover post={post} className="size-12 shrink-0 rounded-[0.75rem] ring-1 ring-line" />
          <div className="min-w-0">
            {/* The link is the row: its ::after covers the whole line, so it must not be positioned itself. */}
            <ViewLink
              to={to}
              data-row-open=""
              className="block truncate text-[15px] leading-6 font-medium text-ink outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-primary"
            >
              <bdi dir="auto">{title}</bdi>
            </ViewLink>
            {post.excerpt && (
              <p dir="auto" className="truncate text-xs leading-5 text-ink-soft">
                {post.excerpt}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center">{state}</div>

        <div className={post.category ? "min-w-0 truncate text-ink" : "min-w-0 truncate text-ink-soft"}>
          {post.category ? <bdi>{post.category.name}</bdi> : t.noCategory}
        </div>

        <div className="text-xs whitespace-nowrap text-ink-soft">{date}</div>

        <div className="relative z-10 flex items-center justify-end">
          <ItemMenu items={menu} label={menuLabel} />
        </div>
      </li>
    </ContextMenu>
  );
}
