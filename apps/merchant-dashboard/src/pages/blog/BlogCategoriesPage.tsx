import { useState } from "react";
import { Button } from "@store-builder/ui";
import { blogCategoriesList, blogCategoryDelete, type BlogCategory, type BlogCategoryRef } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconDelete, IconEdit, IconExternal, IconPlus, IconTree } from "@/components/icons";
import { ListRowCard, ListSkeleton } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { pluralOf } from "@/lib/plural";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { ItemMenu } from "@/pages/catalog/media/ItemMenu";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { BLOG_WORDS } from "./blogStrings";
import { BlogCategoryDialog } from "./BlogCategoryDialog";

const STRINGS = {
  en: {
    description: "Group your posts so shoppers find what interests them. Each category has its own page on the blog.",
    newCategory: "New category",
    name: "Name",
    link: "Link",
    posts: "Published posts",
    order: "Order",
    edit: "Edit",
    editAria: "Edit “{name}”",
    menuLabel: "Actions for “{name}”",
    view: "View in store",
    remove: "Delete",
    deleteTitle: "Delete “{name}”?",
    deleteBody: "Its posts stay on the blog, without a category.",
    deleteConfirm: "Delete category",
    created: "Category added",
    saved: "Category saved",
    deleted: "Category deleted",
    emptyTitle: "No categories yet",
    emptyBody: "Add categories like “Tips” or “News”, and shoppers can browse your blog by them.",
  },
  ar: {
    description: "قسّم مقالاتك علشان العميل يلاقي اللي يهمه. كل تصنيف ليه صفحة في المدونة.",
    newCategory: "تصنيف جديد",
    name: "الاسم",
    link: "اللينك",
    posts: "المقالات المنشورة",
    order: "الترتيب",
    edit: "عدّل",
    editAria: "عدّل «{name}»",
    menuLabel: "إجراءات «{name}»",
    view: "شوفه في المتجر",
    remove: "امسح",
    deleteTitle: "تمسح «{name}»؟",
    deleteBody: "مقالاته هتفضل في المدونة، بس من غير تصنيف.",
    deleteConfirm: "امسح التصنيف",
    created: "التصنيف اتضاف",
    saved: "التصنيف اتحفظ",
    deleted: "التصنيف اتمسح",
    emptyTitle: "لسه مفيش تصنيفات",
    emptyBody: "ضيف تصنيفات زي «نصايح» أو «أخبار»، والعميل يقدر يتصفح مدونتك بيها.",
  },
} satisfies Messages;

const COLUMNS = "grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_max-content_max-content_max-content]";

/**
 * Blog → Categories (handoff 190): add, rename, order and delete the blog's
 * categories. A row opens its edit sheet; «…» holds view in store and delete.
 */
export function BlogCategoriesPage() {
  const t = useT(STRINGS);
  const words = useT(BLOG_WORDS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const compact = useIsCompact();
  const phone = useIsPhone();
  const state = useCachedAsync<BlogCategory[]>(`blog-categories:${workspaceId}`, () => blogCategoriesList(apiClient, workspaceId), [workspaceId]);
  // Each stays here while its sheet closes, so the sheet does not empty on its way out.
  const [editing, setEditing] = useState<{ category: BlogCategoryRef | null; open: boolean } | null>(null);
  const [removing, setRemoving] = useState<{ category: BlogCategory; open: boolean } | null>(null);
  const categories = state.data ?? [];
  const nextPosition = categories.reduce((max, c) => Math.max(max, c.position + 1), 0);

  async function remove(category: BlogCategory) {
    await blogCategoryDelete(apiClient, workspaceId, category.id);
    setRemoving((prev) => (prev ? { ...prev, open: false } : prev));
    toast.success(t.deleted);
    state.setData((prev) => (prev ?? []).filter((c) => c.id !== category.id));
  }

  function menuFor(c: BlogCategory): ContextMenuItem[] {
    return [
      { id: "edit", label: t.edit, icon: IconEdit, onSelect: () => setEditing({ category: c, open: true }) },
      {
        id: "view",
        label: t.view,
        icon: IconExternal,
        onSelect: () => window.open(`${STOREFRONT_URL}/store/${workspaceId}/blog?category=${encodeURIComponent(c.slug)}`, "_blank", "noopener,noreferrer"),
      },
      { id: "delete", label: t.remove, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setRemoving({ category: c, open: true }) },
    ];
  }

  const addButton = (
    <Button className="min-h-11 rounded-full px-5" onClick={() => setEditing({ category: null, open: true })}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.newCategory}
    </Button>
  );

  const rows = categories.map((c) => {
    const menu = menuFor(c);
    const menuLabel = fmt(t.menuLabel, { name: c.name });
    const open = () => setEditing({ category: c, open: true });
    const link = (
      <bdi dir="ltr" className="text-ink-soft">
        /blog?category={c.slug}
      </bdi>
    );
    if (compact) {
      return (
        <li key={c.id}>
          <ContextMenu items={menu} label={menuLabel}>
            <ListRowCard
              title={<bdi dir="auto">{c.name}</bdi>}
              amount={<span className="text-[13px] font-medium text-ink-soft">{pluralOf(words, "posts", c.postsCount)}</span>}
              meta={link}
              action={<ItemMenu items={menu} label={menuLabel} />}
              footer={
                c.description ? (
                  <p dir="auto" className="line-clamp-1 basis-full text-[13px] leading-5 text-ink-soft">
                    {c.description}
                  </p>
                ) : undefined
              }
              onOpen={open}
              openLabel={fmt(t.editAria, { name: c.name })}
              aria-haspopup="dialog"
            />
          </ContextMenu>
        </li>
      );
    }
    return (
      <DeskRow key={c.id} onOpen={open} openLabel={fmt(t.editAria, { name: c.name })} menu={menu} menuLabel={menuLabel}>
        <div className="min-w-0">
          <p dir="auto" className="truncate text-[15px] leading-6 font-medium text-ink">
            {c.name}
          </p>
          {c.description && (
            <p dir="auto" className="truncate text-xs leading-5 text-ink-soft">
              {c.description}
            </p>
          )}
        </div>
        <div className="min-w-0 truncate text-sm">{link}</div>
        <div className="text-sm whitespace-nowrap text-ink tabular-nums">{pluralOf(words, "posts", c.postsCount)}</div>
        <div className="text-end text-sm text-ink-soft tabular-nums">{fmt("{n}", { n: c.position })}</div>
        <div className="flex items-center justify-end">
          <ItemMenu items={menu} label={menuLabel} />
        </div>
      </DeskRow>
    );
  });

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={words.categories}
        description={phone ? undefined : t.description}
        back={{ to: "/blog", label: words.blog }}
        // With nothing yet the empty state carries the one action; it is not said twice.
        primaryAction={state.data && categories.length > 0 ? addButton : undefined}
      />

      <DataState
        loading={state.loading}
        error={categories.length === 0 ? state.error : null}
        onRetry={() => void state.refresh()}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={4} />}
      >
        {categories.length === 0 ? (
          <EmptyState icon={<IconTree aria-hidden />} title={t.emptyTitle} description={t.emptyBody} action={addButton} />
        ) : compact ? (
          <ul aria-label={words.categories} className="flex flex-col gap-2.5">
            {rows}
          </ul>
        ) : (
          <DeskList columns={COLUMNS} label={words.categories} head={[{ label: t.name }, { label: t.link }, { label: t.posts }, { label: t.order, end: true }, { label: "" }]}>
            {rows}
          </DeskList>
        )}
      </DataState>

      <BlogCategoryDialog
        open={Boolean(editing?.open)}
        category={editing?.category ?? null}
        nextPosition={nextPosition}
        onClose={() => setEditing((prev) => (prev ? { ...prev, open: false } : prev))}
        onSaved={() => {
          const isNew = editing?.category == null;
          setEditing((prev) => (prev ? { ...prev, open: false } : prev));
          toast.success(isNew ? t.created : t.saved);
          // The order and the count of live posts come from the server.
          void state.refresh({ silent: true });
        }}
      />

      <ConfirmDialog
        open={Boolean(removing?.open)}
        title={fmt(t.deleteTitle, { name: removing?.category.name ?? "" })}
        description={t.deleteBody}
        confirmLabel={t.deleteConfirm}
        destructive
        onCancel={() => setRemoving((prev) => (prev ? { ...prev, open: false } : prev))}
        onConfirm={() => (removing ? remove(removing.category) : undefined)}
      />
    </div>
  );
}
