import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLink, FolderTree, Newspaper, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button, Input } from "@store-builder/ui";
import {
  blogCategoriesList,
  blogPostDelete,
  blogPostsList,
  type BlogCategory,
  type BlogPostListItem,
  type BlogPostState,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { BLOG_WORDS, STATE_TONE } from "./blogStrings";

const STRINGS = {
  en: {
    description: "Write posts that bring shoppers from Google and answer their questions before they order.",
    openBlog: "Open the blog",
    all: "All",
    tabs: "Show posts",
    search: "Search posts by title",
    category: "Category",
    allCategories: "All categories",
    post: "Post",
    state: "Status",
    date: "Date",
    noCategory: "No category",
    actions: "Actions",
    edit: "Edit",
    editAria: "Edit “{title}”",
    view: "View in store",
    viewAria: "View “{title}” in the store",
    remove: "Delete",
    removeAria: "Delete “{title}”",
    deleteTitle: "Delete “{title}”?",
    deleteBody: "The post leaves your store and can't be brought back.",
    deleteConfirm: "Delete post",
    deleted: "Post deleted",
    firstTitle: "Write your first post",
    firstBody: "Tips, how-tos and news bring shoppers from Google and keep them coming back. Your posts show on your store's blog page.",
    noMatch: "No posts match",
    noMatchHint: "Try another word, another category or another tab.",
    noDrafts: "No drafts",
    noDraftsHint: "A post you save without publishing waits here.",
    noPublished: "Nothing published yet",
    noPublishedHint: "Publish a post and shoppers can read it on your store.",
    noScheduled: "Nothing scheduled",
    noScheduledHint: "Pick a date and time when you publish a post, and it goes live by itself.",
    showAll: "Show all posts",
    untitled: "Untitled post",
  },
  ar: {
    description: "اكتب مقالات تجيب زباين من جوجل وتجاوب على أسئلتهم قبل ما يطلبوا.",
    openBlog: "افتح المدونة",
    all: "الكل",
    tabs: "اعرض المقالات",
    search: "دوّر بعنوان المقال",
    category: "التصنيف",
    allCategories: "كل التصنيفات",
    post: "المقال",
    state: "الحالة",
    date: "التاريخ",
    noCategory: "من غير تصنيف",
    actions: "إجراءات",
    edit: "عدّل",
    editAria: "عدّل «{title}»",
    view: "شوفه في المتجر",
    viewAria: "شوف «{title}» في المتجر",
    remove: "امسح",
    removeAria: "امسح «{title}»",
    deleteTitle: "تمسح «{title}»؟",
    deleteBody: "المقال هيختفي من المتجر ومش هينفع يرجع.",
    deleteConfirm: "امسح المقال",
    deleted: "المقال اتمسح",
    firstTitle: "اكتب أول مقال",
    firstBody: "النصايح وطرق الاستخدام والأخبار بتجيب زباين من جوجل وبترجّعهم تاني. مقالاتك بتظهر في صفحة المدونة في متجرك.",
    noMatch: "مفيش مقالات بالشكل ده",
    noMatchHint: "جرّب كلمة تانية أو تصنيف تاني أو تبويب تاني.",
    noDrafts: "مفيش مسودات",
    noDraftsHint: "المقال اللي تحفظه من غير ما تنشره بيستناك هنا.",
    noPublished: "لسه مفيش مقالات منشورة",
    noPublishedHint: "انشر مقال والعملاء يقدروا يقروه في متجرك.",
    noScheduled: "مفيش مقالات مجدولة",
    noScheduledHint: "اختار يوم وساعة وانت بتنشر المقال، وهينزل لوحده.",
    showAll: "اعرض كل المقالات",
    untitled: "مقال من غير عنوان",
  },
} satisfies Messages;

type Tab = BlogPostState | "all";
const PAGE_SIZE = 20;

/**
 * Store → Blog (handoff item 190, website.edit): the store's posts with
 * Drafts / Published / Scheduled tabs, a title search and a category
 * filter; each post opens its editor. Cards on a phone (DataTable).
 */
export function BlogPostsPage() {
  const t = useT(STRINGS);
  const words = useT(BLOG_WORDS);
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [more, setMore] = useState<BlogPostListItem[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [removing, setRemoving] = useState<BlogPostListItem | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const categories = useAsync<BlogCategory[]>(() => blogCategoriesList(apiClient, workspaceId), [workspaceId]);
  const list = useAsync(async () => {
    const result = await blogPostsList(apiClient, workspaceId, {
      state: tab === "all" ? undefined : tab,
      categoryId: categoryId || undefined,
      q: q || undefined,
      page: 1,
      limit: PAGE_SIZE,
    });
    return result;
  }, [workspaceId, tab, categoryId, q]);
  // A new filter starts again from its first page.
  useEffect(() => {
    setMore([]);
    setPage(1);
  }, [workspaceId, tab, categoryId, q]);

  const rows = [...(list.data?.posts ?? []), ...more];
  const total = list.data?.total ?? 0;
  const filtered = tab !== "all" || Boolean(q) || Boolean(categoryId);
  // A store with no posts yet sees the first-post card alone, without filters for nothing.
  const nothingYet = Boolean(list.data) && !filtered && total === 0 && !query;
  // A failure of the categories list hides the filter; the posts still show.
  const categoryList = categories.data ?? [];

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = await blogPostsList(apiClient, workspaceId, {
        state: tab === "all" ? undefined : tab,
        categoryId: categoryId || undefined,
        q: q || undefined,
        page: page + 1,
        limit: PAGE_SIZE,
      });
      setMore((prev) => [...prev, ...next.posts]);
      setPage(page + 1);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  async function remove(post: BlogPostListItem) {
    await blogPostDelete(apiClient, workspaceId, post.id);
    setRemoving(null);
    toast.success(t.deleted);
    // Out of the list where it is, without reloading the pages already shown.
    setMore((prev) => prev.filter((p) => p.id !== post.id));
    list.setData((prev) => ({ ...prev!, posts: prev!.posts.filter((p) => p.id !== post.id), total: Math.max(0, prev!.total - 1) }));
  }

  const clearFilters = () => {
    setTab("all");
    setQuery("");
    setQ("");
    setCategoryId("");
  };

  const titleOf = (post: BlogPostListItem) => post.title || t.untitled;
  const dateOf = (post: BlogPostListItem) =>
    post.state === "published"
      ? fmt(words.publishedOn, { date: formatDate(post.publishedAt) })
      : post.state === "scheduled"
        ? fmt(words.goesLive, { date: formatDate(post.publishedAt) })
        : fmt(words.editedOn, { date: formatDate(post.updatedAt) });

  const columns: Column<BlogPostListItem>[] = [
    {
      key: "post",
      header: t.post,
      cell: (post) => (
        <Link to={`/blog/${post.id}`} className="flex min-w-0 items-center gap-3" onClick={(e) => e.stopPropagation()}>
          {post.coverUrl ? (
            <img src={post.coverUrl} alt="" loading="lazy" className="size-12 shrink-0 rounded-[var(--radius)] bg-paper-sunken object-cover ring-1 ring-line" />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius)] bg-paper-sunken text-ink-soft" aria-hidden>
              <Newspaper className="size-5" />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink" dir="auto">
              {titleOf(post)}
            </span>
            {post.excerpt && (
              <span className="mt-0.5 line-clamp-1 text-xs text-ink-soft" dir="auto">
                {post.excerpt}
              </span>
            )}
          </span>
        </Link>
      ),
    },
    {
      key: "state",
      header: t.state,
      cell: (post) => <StatusBadge value={post.state} tone={STATE_TONE[post.state]} text={words[post.state]} />,
    },
    {
      key: "category",
      header: t.category,
      cell: (post) => <span className={post.category ? "text-ink" : "text-ink-soft"}>{post.category?.name ?? t.noCategory}</span>,
    },
    {
      key: "date",
      header: t.date,
      cell: (post) => <span className="whitespace-nowrap text-ink-soft">{dateOf(post)}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t.actions}</span>,
      align: "end",
      cell: (post) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button asChild size="sm" variant="ghost" className="min-h-11 md:min-h-8">
            <Link to={`/blog/${post.id}`} aria-label={fmt(t.editAria, { title: titleOf(post) })}>
              <Pencil className="size-4" aria-hidden />
              {t.edit}
            </Link>
          </Button>
          {post.state === "published" && (
            <Button asChild size="sm" variant="ghost" className="min-h-11 md:min-h-8">
              <a
                href={`${STOREFRONT_URL}/store/${workspaceId}/blog/${encodeURIComponent(post.slug)}`}
                target="_blank"
                rel="noreferrer"
                aria-label={fmt(t.viewAria, { title: titleOf(post) })}
                title={t.view}
              >
                <ExternalLink className="size-4" aria-hidden />
              </a>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-11 min-w-11 text-ink-soft hover:bg-danger-soft hover:text-danger md:min-h-8 md:min-w-8"
            aria-label={fmt(t.removeAria, { title: titleOf(post) })}
            title={t.remove}
            onClick={() => setRemoving(post)}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      ),
    },
  ];

  const emptyFiltered = (() => {
    if (q || categoryId) return { title: t.noMatch, hint: t.noMatchHint };
    if (tab === "draft") return { title: t.noDrafts, hint: t.noDraftsHint };
    if (tab === "published") return { title: t.noPublished, hint: t.noPublishedHint };
    return { title: t.noScheduled, hint: t.noScheduledHint };
  })();

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={words.blog}
        description={t.description}
        actions={
          <>
            <Button asChild variant="ghost" className="min-h-11 md:min-h-10">
              <a href={`${STOREFRONT_URL}/store/${workspaceId}/blog`} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" aria-hidden />
                {t.openBlog}
              </a>
            </Button>
            <Button asChild variant="outline" className="min-h-11 md:min-h-10">
              <Link to="/blog/categories">
                <FolderTree className="size-4" aria-hidden />
                {words.categories}
              </Link>
            </Button>
            <Button asChild className="min-h-11 md:min-h-10">
              <Link to="/blog/new">
                <Plus className="size-4" aria-hidden />
                {words.newPost}
              </Link>
            </Button>
          </>
        }
      />

      <div className={nothingYet ? "hidden" : "mb-4 space-y-3"}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <FilterTabs
            label={t.tabs}
            value={tab}
            onChange={setTab}
            className="flex-nowrap"
            buttonClassName="min-h-11 whitespace-nowrap md:min-h-0"
            tabs={[
              { value: "all", label: t.all },
              { value: "draft", label: words.draft },
              { value: "published", label: words.published },
              { value: "scheduled", label: words.scheduled },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} aria-label={t.search} className="ps-9" />
          </div>
          {categoryList.length > 0 && (
            <Select aria-label={t.category} className="w-full sm:w-auto" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{t.allCategories}</option>
              {categoryList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      <DataState loading={list.loading && !list.data} error={list.error} onRetry={() => void list.refresh()}>
        {rows.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={<Search aria-hidden />}
              title={emptyFiltered.title}
              description={emptyFiltered.hint}
              action={
                <Button variant="outline" className="min-h-11" onClick={clearFilters}>
                  {t.showAll}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Newspaper aria-hidden />}
              title={t.firstTitle}
              description={t.firstBody}
              action={
                <Button asChild className="min-h-11">
                  <Link to="/blog/new">
                    <Plus className="size-4" aria-hidden />
                    {words.newPost}
                  </Link>
                </Button>
              }
            />
          )
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft" role="status">
              {pluralOf(words, "posts", total)}
            </p>
            <div className="md:overflow-hidden md:rounded-[var(--radius-card)] md:bg-paper-raised md:shadow-[var(--shadow-card)] md:ring-1 md:ring-line">
              <DataTable columns={columns} rows={rows} rowKey={(post) => post.id} onRowClick={(post) => navigate(`/blog/${post.id}`)} minWidth="44rem" />
            </div>
            <LoadMore hasMore={rows.length < total} loading={loadingMore} onClick={() => void loadMore()} />
          </div>
        )}
      </DataState>

      <ConfirmDialog
        open={removing !== null}
        title={fmt(t.deleteTitle, { title: removing ? titleOf(removing) : "" })}
        description={t.deleteBody}
        confirmLabel={t.deleteConfirm}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={() => (removing ? remove(removing) : undefined)}
      />
    </div>
  );
}
