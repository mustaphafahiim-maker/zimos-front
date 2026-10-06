import { useState } from "react";
import { ExternalLink, FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@store-builder/ui";
import { blogCategoriesList, blogCategoryDelete, type BlogCategory, type BlogCategoryRef } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { pluralOf } from "@/lib/plural";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
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
    actions: "Actions",
    edit: "Edit",
    editAria: "Edit “{name}”",
    view: "View in store",
    viewAria: "View “{name}” in the store",
    removeAria: "Delete “{name}”",
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
    actions: "إجراءات",
    edit: "عدّل",
    editAria: "عدّل «{name}»",
    view: "شوفه في المتجر",
    viewAria: "شوف «{name}» في المتجر",
    removeAria: "امسح «{name}»",
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

/** Blog → Categories (handoff 190): add, rename, order and delete the blog's categories. */
export function BlogCategoriesPage() {
  const t = useT(STRINGS);
  const words = useT(BLOG_WORDS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const state = useAsync<BlogCategory[]>(() => blogCategoriesList(apiClient, workspaceId), [workspaceId]);
  const [editing, setEditing] = useState<BlogCategoryRef | "new" | null>(null);
  const [removing, setRemoving] = useState<BlogCategory | null>(null);
  const categories = state.data ?? [];
  const nextPosition = categories.reduce((max, c) => Math.max(max, c.position + 1), 0);

  async function remove(category: BlogCategory) {
    await blogCategoryDelete(apiClient, workspaceId, category.id);
    setRemoving(null);
    toast.success(t.deleted);
    state.setData((prev) => (prev ?? []).filter((c) => c.id !== category.id));
  }

  const columns: Column<BlogCategory>[] = [
    {
      key: "name",
      header: t.name,
      cell: (c) => (
        <span className="min-w-0">
          <span className="block font-medium text-ink" dir="auto">
            {c.name}
          </span>
          {c.description && (
            <span className="mt-0.5 line-clamp-1 text-xs text-ink-soft" dir="auto">
              {c.description}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "link",
      header: t.link,
      cell: (c) => (
        <bdi className="text-ink-soft" dir="ltr">
          /blog?category={c.slug}
        </bdi>
      ),
    },
    {
      key: "posts",
      header: t.posts,
      cell: (c) => <span className="text-ink">{pluralOf(words, "posts", c.postsCount)}</span>,
    },
    {
      key: "order",
      header: t.order,
      phoneHidden: true,
      cell: (c) => <span className="tabular-nums text-ink-soft">{fmt("{n}", { n: c.position })}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t.actions}</span>,
      align: "end",
      cell: (c) => (
        <div className="flex items-center justify-end gap-1">
          <Button type="button" size="sm" variant="ghost" className="min-h-11 md:min-h-8" aria-label={fmt(t.editAria, { name: c.name })} onClick={() => setEditing(c)}>
            <Pencil className="size-4" aria-hidden />
            {t.edit}
          </Button>
          <Button asChild size="sm" variant="ghost" className="min-h-11 min-w-11 md:min-h-8 md:min-w-8">
            <a
              href={`${STOREFRONT_URL}/store/${workspaceId}/blog?category=${encodeURIComponent(c.slug)}`}
              target="_blank"
              rel="noreferrer"
              aria-label={fmt(t.viewAria, { name: c.name })}
              title={t.view}
            >
              <ExternalLink className="size-4" aria-hidden />
            </a>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-11 min-w-11 text-ink-soft hover:bg-danger-soft hover:text-danger md:min-h-8 md:min-w-8"
            aria-label={fmt(t.removeAria, { name: c.name })}
            title={t.remove}
            onClick={() => setRemoving(c)}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={words.categories}
        description={t.description}
        back={{ to: "/blog", label: words.blog }}
        actions={
          state.data && categories.length > 0 ? (
            <Button className="min-h-11 md:min-h-10" onClick={() => setEditing("new")}>
              <Plus className="size-4" aria-hidden />
              {t.newCategory}
            </Button>
          ) : undefined
        }
      />

      <DataState loading={state.loading} error={state.error} onRetry={() => void state.refresh()}>
        {categories.length === 0 ? (
          <EmptyState
            icon={<FolderTree aria-hidden />}
            title={t.emptyTitle}
            description={t.emptyBody}
            action={
              <Button className="min-h-11" onClick={() => setEditing("new")}>
                <Plus className="size-4" aria-hidden />
                {t.newCategory}
              </Button>
            }
          />
        ) : (
          <div className="md:overflow-hidden md:rounded-[var(--radius-card)] md:bg-paper-raised md:shadow-[var(--shadow-card)] md:ring-1 md:ring-line">
            <DataTable columns={columns} rows={categories} rowKey={(c) => c.id} minWidth="40rem" />
          </div>
        )}
      </DataState>

      <BlogCategoryDialog
        open={editing !== null}
        category={editing === "new" ? null : editing}
        nextPosition={nextPosition}
        onClose={() => setEditing(null)}
        onSaved={() => {
          const isNew = editing === "new";
          setEditing(null);
          toast.success(isNew ? t.created : t.saved);
          // The order and the count of live posts come from the server.
          void state.refresh({ silent: true });
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        title={fmt(t.deleteTitle, { name: removing?.name ?? "" })}
        description={t.deleteBody}
        confirmLabel={t.deleteConfirm}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={() => (removing ? remove(removing) : undefined)}
      />
    </div>
  );
}
