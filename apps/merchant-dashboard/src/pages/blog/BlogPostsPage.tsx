import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, cn } from "@store-builder/ui";
import {
  blogCategoriesList,
  blogPostDelete,
  blogPostsList,
  type BlogCategory,
  type BlogPostListItem,
  type BlogPostPage,
  type BlogPostState,
} from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconBlog, IconDelete, IconEdit, IconExternal, IconPlus, IconSearch, IconTree } from "@/components/icons";
import { ChipRow, FilterChoice, FilterGroup, FilterSheet, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { pluralOf } from "@/lib/plural";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { useAsync } from "@/lib/useAsync";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { ItemMenu } from "@/pages/catalog/media/ItemMenu";
import { ActiveFilters } from "@/pages/returns/rowkit/ActiveFilters";
import { DeskList } from "@/pages/returns/rowkit/DeskList";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { BlogPostRow, POST_COLUMNS } from "./BlogPostRow";
import { BLOG_WORDS } from "./blogStrings";

const STRINGS = {
  en: {
    description: "Write posts that bring shoppers from Google and answer their questions before they order.",
    tools: "Tools",
    openBlog: "Open the blog in your store",
    all: "All",
    tabs: "Posts by status",
    search: "Search the posts",
    searchPlaceholder: "Search by title",
    category: "Category",
    chipCategory: "Category: {name}",
    post: "Post",
    state: "Status",
    date: "Date",
    edit: "Edit",
    view: "View in store",
    remove: "Delete",
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
    show_one: "Show 1 post",
    show_other: "Show {n} posts",
  },
  ar: {
    description: "اكتب مقالات تجيب عملاء من جوجل وتجاوب على أسئلتهم قبل ما يطلبوا.",
    tools: "أدوات",
    openBlog: "افتح المدونة في متجرك",
    all: "الكل",
    tabs: "المقالات حسب الحالة",
    search: "دوّر في المقالات",
    searchPlaceholder: "دوّر بعنوان المقال",
    category: "التصنيف",
    chipCategory: "التصنيف: {name}",
    post: "المقال",
    state: "الحالة",
    date: "التاريخ",
    edit: "عدّل",
    view: "شوفه في المتجر",
    remove: "امسح",
    deleteTitle: "تمسح «{title}»؟",
    deleteBody: "المقال هيختفي من المتجر ومش هينفع يرجع.",
    deleteConfirm: "امسح المقال",
    deleted: "المقال اتمسح",
    firstTitle: "اكتب أول مقال",
    firstBody: "النصايح وطرق الاستخدام والأخبار بتجيب عملاء من جوجل وبترجّعهم تاني. مقالاتك بتظهر في صفحة المدونة في متجرك.",
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
    show_zero: "مفيش مقالات بالفلتر ده",
    show_one: "اعرض مقال واحد",
    show_two: "اعرض مقالين",
    show_few: "اعرض {n} مقالات",
    show_other: "اعرض {n} مقال",
  },
} satisfies Messages;

type Tab = BlogPostState | "all";
const PAGE_SIZE = 20;

function tabOf(value: string | null): Tab {
  return value === "draft" || value === "published" || value === "scheduled" ? value : "all";
}

/** A page of posts with the filter it answers, so a page kept from another filter is never taken for this one's. */
type Keyed = BlogPostPage<BlogPostListItem> & { key: string };

/**
 * Store → Blog (handoff item 190, website.edit): the store's posts. Status
 * chips, a title search and — in the Filters sheet — the category; a row opens
 * the post's editor. `?state=` keeps the chosen chip, so coming back from a
 * post lands where the merchant was, and the first page of a filter already
 * seen shows at once.
 */
export function BlogPostsPage() {
  const t = useT(STRINGS);
  const words = useT(BLOG_WORDS);
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const compact = useIsCompact();
  const phone = useIsPhone();

  const [params, setParams] = useSearchParams();
  const tab = tabOf(params.get("state"));
  function selectTab(next: Tab) {
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === "all") out.delete("state");
        else out.set("state", next);
        return out;
      },
      { replace: true }
    );
  }

  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [more, setMore] = useState<BlogPostListItem[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [removing, setRemoving] = useState<{ post: BlogPostListItem; open: boolean } | null>(null);

  // The request waits for the typing to pause; the field itself never does.
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const categories = useAsync<BlogCategory[]>(() => blogCategoriesList(apiClient, workspaceId), [workspaceId]);
  const key = `blog-posts:${workspaceId}:${tab}:${categoryId}:${q}`;
  const list = useCachedAsync<Keyed>(
    key,
    async () => {
      const result = await blogPostsList(apiClient, workspaceId, {
        state: tab === "all" ? undefined : tab,
        categoryId: categoryId || undefined,
        q: q || undefined,
        page: 1,
        limit: PAGE_SIZE,
      });
      return { ...result, key };
    },
    [workspaceId, tab, categoryId, q]
  );
  // A new filter starts again from its first page.
  useEffect(() => {
    setMore([]);
    setPage(1);
  }, [workspaceId, tab, categoryId, q]);

  // This filter's own answer; until it lands, the rows of the filter before stay on screen, dimmed.
  const current = list.data && list.data.key === key ? list.data : null;
  const waiting = current === null && list.data !== null && !list.error;
  const shown = current ?? list.data;
  const rows = [...(shown?.posts ?? []), ...(current ? more : [])];
  const total = current?.total ?? 0;
  const filtered = tab !== "all" || Boolean(q) || Boolean(categoryId);
  // A store with no posts yet sees the first-post card alone, without filters for nothing.
  const nothingYet = current !== null && !filtered && total === 0 && !query;
  // A failure of the categories list hides the filter; the posts still show.
  const categoryList = categories.data ?? [];
  const chosenCategory = categoryList.find((c) => c.id === categoryId);

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
    setRemoving((prev) => (prev ? { ...prev, open: false } : prev));
    toast.success(t.deleted);
    // Out of the list where it is, without reloading the pages already shown.
    setMore((prev) => prev.filter((p) => p.id !== post.id));
    list.setData((prev) => {
      const base = prev ?? { posts: [], total: 0, page: 1, limit: PAGE_SIZE, key };
      return { ...base, posts: base.posts.filter((p) => p.id !== post.id), total: Math.max(0, base.total - 1) };
    });
  }

  const clearFilters = () => {
    selectTab("all");
    setQuery("");
    setQ("");
    setCategoryId("");
  };

  const titleOf = (post: BlogPostListItem) => post.title || t.untitled;

  function menuFor(post: BlogPostListItem): ContextMenuItem[] {
    const items: ContextMenuItem[] = [{ id: "edit", label: t.edit, icon: IconEdit, onSelect: () => navigate(`/blog/${post.id}`) }];
    if (post.state === "published") {
      items.push({
        id: "view",
        label: t.view,
        icon: IconExternal,
        onSelect: () => window.open(`${STOREFRONT_URL}/store/${workspaceId}/blog/${encodeURIComponent(post.slug)}`, "_blank", "noopener,noreferrer"),
      });
    }
    items.push({ id: "delete", label: t.remove, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setRemoving({ post, open: true }) });
    return items;
  }

  const tools: ContextMenuItem[] = [
    { id: "categories", label: words.categories, icon: IconTree, onSelect: () => navigate("/blog/categories") },
    { id: "open", label: t.openBlog, icon: IconExternal, onSelect: () => window.open(`${STOREFRONT_URL}/store/${workspaceId}/blog`, "_blank", "noopener,noreferrer") },
  ];

  const chips: ChipItem<Tab>[] = [
    { value: "all", label: t.all },
    { value: "draft", label: words.draft },
    { value: "published", label: words.published },
    { value: "scheduled", label: words.scheduled },
  ];

  const newPost = (
    <Button asChild className="min-h-11 rounded-full px-5">
      <ViewLink to="/blog/new">
        <IconPlus className="size-4" weight="bold" aria-hidden />
        {words.newPost}
      </ViewLink>
    </Button>
  );

  const emptyFiltered = (() => {
    if (q || categoryId) return { title: t.noMatch, hint: t.noMatchHint };
    if (tab === "draft") return { title: t.noDrafts, hint: t.noDraftsHint };
    if (tab === "published") return { title: t.noPublished, hint: t.noPublishedHint };
    return { title: t.noScheduled, hint: t.noScheduledHint };
  })();

  const lines = rows.map((post) => <BlogPostRow key={post.id} post={post} compact={compact} menu={menuFor(post)} />);

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={words.blog}
        // A phone keeps the first screen for the posts: the sentence is for wider screens.
        description={phone ? undefined : t.description}
        actions={<ItemMenu items={tools} label={t.tools} />}
        primaryAction={newPost}
      />

      <div className="flex flex-col gap-3">
        {/* No filters over nothing: a store without posts yet, or a first load that failed (error / no permission). */}
        {!nothingYet && !(list.error && !list.data) && (
          <>
            <ListToolbar
              search={{ value: query, onChange: setQuery, placeholder: t.searchPlaceholder, label: t.search }}
              filters={categoryList.length > 0 ? { count: categoryId ? 1 : 0, onOpen: () => setFiltersOpen(true) } : undefined}
            />
            <ChipRow items={chips} value={tab} onChange={selectTab} label={t.tabs} />
            <ActiveFilters
              filters={chosenCategory ? [{ id: "category", label: fmt(t.chipCategory, { name: chosenCategory.name }), onRemove: () => setCategoryId("") }] : []}
              onClearAll={() => setCategoryId("")}
            />
          </>
        )}

        <DataState
          loading={list.loading && !list.data}
          error={list.data ? null : list.error}
          onRetry={() => void list.refresh()}
          skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={5} />}
        >
          {rows.length === 0 ? (
            waiting ? (
              <ListSkeleton variant={compact ? "card" : "table"} rows={3} />
            ) : filtered ? (
              <EmptyState
                icon={<IconSearch aria-hidden />}
                title={emptyFiltered.title}
                description={emptyFiltered.hint}
                action={
                  <Button variant="outline" className="rounded-full px-5" onClick={clearFilters}>
                    {t.showAll}
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={<IconBlog aria-hidden />} title={t.firstTitle} description={t.firstBody} action={newPost} />
            )
          ) : (
            <div aria-busy={waiting || undefined} className={cn("transition-opacity duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none", waiting && "opacity-60")}>
              {compact ? (
                <ul aria-label={words.blog} className="flex flex-col gap-2.5">
                  {lines}
                </ul>
              ) : (
                <DeskList columns={POST_COLUMNS} label={words.blog} head={[{ label: t.post }, { label: t.state }, { label: t.category }, { label: t.date }, { label: "" }]}>
                  {lines}
                </DeskList>
              )}
              <LoadMore hasMore={current !== null && rows.length < total} loading={loadingMore} onClick={() => void loadMore()} />
              {current !== null && (
                <p className="pt-3 text-center text-xs text-ink-soft tabular-nums" role="status">
                  {pluralOf(words, "posts", total)}
                </p>
              )}
            </div>
          )}
        </DataState>
      </div>

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        activeCount={categoryId ? 1 : 0}
        onReset={() => setCategoryId("")}
        applyLabel={pluralOf(t, "show", total)}
      >
        <FilterGroup label={t.category}>
          <FilterChoice
            label={t.category}
            allowClear
            value={categoryId || null}
            onChange={(next) => setCategoryId(next ?? "")}
            options={categoryList.map((c) => ({ value: c.id, label: c.name }))}
          />
        </FilterGroup>
      </FilterSheet>

      <ConfirmDialog
        open={Boolean(removing?.open)}
        title={fmt(t.deleteTitle, { title: removing ? titleOf(removing.post) : "" })}
        description={t.deleteBody}
        confirmLabel={t.deleteConfirm}
        destructive
        onCancel={() => setRemoving((prev) => (prev ? { ...prev, open: false } : prev))}
        onConfirm={() => (removing ? remove(removing.post) : undefined)}
      />
    </div>
  );
}
