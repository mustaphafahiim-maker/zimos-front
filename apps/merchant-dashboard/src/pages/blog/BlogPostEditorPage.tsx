import { useEffect, useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { IconClose, IconDelete, IconDraft, IconExternal, IconFileUnknown, IconPlus, IconSliders } from "@/components/icons";
import { Button, Input } from "@store-builder/ui";
import {
  ApiError,
  BLOG_TAGS_MAX,
  apiErrorCode,
  apiFieldProblems,
  blogCategoriesList,
  blogPostCreate,
  blogPostDelete,
  blogPostGet,
  blogPostUpdate,
  type BlogCategory,
  type BlogCategoryRef,
  type BlogPost,
  type BlogPostInput,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { storeHost } from "@/lib/storeAddress";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { AccordionGroup, AccordionSection } from "@/components/Accordion";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { PageActionBar, PageHeader } from "@/components/PageHeader";
import { SaveBar } from "@/components/SaveBar";
import { Segmented } from "@/components/Segmented";
import { Sheet } from "@/components/Sheet";
import { UnsavedGuardProvider, useReportDirty } from "@/lib/useUnsavedGuard";
import { ItemMenu } from "@/pages/catalog/media/ItemMenu";
import { LeaveGuard } from "@/pages/catalog/product/LeaveGuard";
import { useIsCompact, useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Section } from "@/components/Section";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { DESIGNER_STRINGS, ImageSource } from "@/pages/settings/EmailBlockDesigner";
import { BlogBlockEditor } from "./BlogBlockEditor";
import { BlogCategoryDialog } from "./BlogCategoryDialog";
import { BLOG_WORDS, STATE_TONE } from "./blogStrings";
import {
  EMPTY_POST,
  blockProblems,
  defaultScheduleInput,
  draftOf,
  fingerprint,
  hasProblems,
  inputOf,
  isoOfLocalInput,
  localInputOf,
  newBlock,
  postProblems,
  savableBlocks,
  type BlockField,
  type BlockProblem,
  type BlockProblems,
  type PostDraft,
  type PostField,
} from "./blogDraft";

const STRINGS = {
  en: {
    titleNew: "New post",
    settings: "Post settings",
    settingsHint: "When it goes live, its cover, category, link and how Google shows it.",
    done: "Done",
    more: "More for this post",
    coverSet: "Chosen",
    coverNone: "No cover yet",
    slugAuto: "Made from the title",
    seoSummary: "Title and description in Google",
    seoHidden: "Hidden from search engines",
    titleEdit: "Edit post",
    notFound: "This post isn't here anymore",
    notFoundHint: "It may have been deleted. Your other posts are in the blog.",
    backToBlog: "Back to the blog",
    post: "The post",
    postTitle: "Title",
    titlePlaceholder: "e.g. 5 tips to care for your skin in winter",
    excerpt: "Short summary",
    excerptHint: "Shown under the title on the blog page and in Google. Up to 500 characters.",
    content: "Content",
    contentHint: "Build the post from blocks: headings, paragraphs, pictures, lists, quotes, products and buttons.",
    publishing: "Publishing",
    when: "When does it go live?",
    now: "Now",
    later: "At a set time",
    dateTime: "Date and time",
    scheduleHint: "It goes live by itself at this time.",
    draftNote: "Only you and your team see a draft.",
    liveSince: "Live since {date}",
    liveAt: "Goes live by itself {date}",
    lastSaved: "Last saved {date}",
    saveChanges: "Save changes",
    unpublish: "Back to draft",
    unpublishTitle: "Take “{title}” off the store?",
    unpublishBody: "It becomes a draft. Shoppers won't see it until you publish it again.",
    unpublishConfirm: "Back to draft",
    viewInStore: "View in store",
    cover: "Cover image",
    coverHint: "Shown on the post's card and at the top of the post. A wide picture works best.",
    organise: "Category and tags",
    category: "Category",
    noCategory: "No category",
    newCategory: "New category",
    manageCategories: "Manage categories",
    tags: "Tags",
    tagPlaceholder: "e.g. skin",
    addTag: "Add",
    removeTag: "Remove the tag “{tag}”",
    tagsHint: "Press Enter after each tag. Up to {n} tags.",
    author: "Author's name",
    authorHint: "Shown under the title. Leave it empty to hide it.",
    link: "Post link",
    slugHint: "Empty: made from the title. Arabic letters are fine.",
    seo: "Search engines",
    seoTitle: "Title in Google",
    seoTitleHint: "Empty: the post's title.",
    seoDescription: "Description in Google",
    seoDescriptionHint: "Empty: the short summary.",
    noindex: "Hide this post from search engines",
    deletePost: "Delete post",
    deleteTitle: "Delete “{title}”?",
    deleteBody: "The post leaves your store and can't be brought back.",
    untitled: "Untitled post",
    saving: "Saving…",
    savedDraft: "Draft saved",
    publishedToast: "Post published",
    scheduledToast: "The post goes live {date}",
    savedToast: "Changes saved",
    unpublishedToast: "The post is a draft again",
    deletedToast: "Post deleted",
    fixTitle: "Write a title for the post.",
    fixFields: "Some fields need fixing — they're marked.",
    fixBlocks: "Some blocks need filling in — they're marked.",
    dateRequired: "Pick a date and time.",
    dateFuture: "Pick a time that hasn't passed yet, or publish now.",
    slugTaken: "Another post already uses this link. Change it or leave it empty.",
    categoryGone: "That category was deleted. Pick another one.",
    productGone: "A product block names a product that isn't in your store anymore. Pick another product.",
    p_required: "Fill this in.",
    p_tooLong: "This is too long.",
    p_imageUrl: "Use an image link starting with https://, or pick one from your library.",
    p_link: "Check this link.",
    p_product: "Pick a product.",
    p_tooMany: "Too many.",
    p_server: "Check this.",
  },
  ar: {
    titleNew: "مقال جديد",
    settings: "إعدادات المقال",
    settingsHint: "ينزل امتى، وصورة الغلاف والتصنيف واللينك وشكله في جوجل.",
    done: "تمام",
    more: "كمان للمقال ده",
    coverSet: "متحددة",
    coverNone: "لسه مفيش غلاف",
    slugAuto: "هيتعمل من العنوان",
    seoSummary: "العنوان والوصف في جوجل",
    seoHidden: "مخفي من محركات البحث",
    titleEdit: "تعديل المقال",
    notFound: "المقال ده مبقاش موجود",
    notFoundHint: "ممكن يكون اتمسح. باقي مقالاتك في المدونة.",
    backToBlog: "ارجع للمدونة",
    post: "المقال",
    postTitle: "العنوان",
    titlePlaceholder: "مثلًا: ٥ نصايح للعناية ببشرتك في الشتا",
    excerpt: "ملخص قصير",
    excerptHint: "بيظهر تحت العنوان في صفحة المدونة وفي جوجل. لحد ٥٠٠ حرف.",
    content: "المحتوى",
    contentHint: "ابني المقال من بلوكات: عناوين وفقرات وصور وقوايم واقتباسات ومنتجات وأزرار.",
    publishing: "النشر",
    when: "ينزل امتى؟",
    now: "دلوقتي",
    later: "في ميعاد",
    dateTime: "اليوم والساعة",
    scheduleHint: "هينزل لوحده في الميعاد ده.",
    draftNote: "المسودة محدش بيشوفها غيرك انت وفريقك.",
    liveSince: "منشور من {date}",
    liveAt: "هينزل لوحده {date}",
    lastSaved: "آخر حفظ {date}",
    saveChanges: "احفظ التعديلات",
    unpublish: "رجّعه مسودة",
    unpublishTitle: "تشيل «{title}» من المتجر؟",
    unpublishBody: "هيرجع مسودة، والعملاء مش هيشوفوه لحد ما تنشره تاني.",
    unpublishConfirm: "رجّعه مسودة",
    viewInStore: "شوفه في المتجر",
    cover: "صورة الغلاف",
    coverHint: "بتظهر على كارت المقال وفي أوله. الصورة العريضة أحسن.",
    organise: "التصنيف والوسوم",
    category: "التصنيف",
    noCategory: "من غير تصنيف",
    newCategory: "تصنيف جديد",
    manageCategories: "إدارة التصنيفات",
    tags: "الوسوم",
    tagPlaceholder: "مثلًا: بشرة",
    addTag: "ضيف",
    removeTag: "شيل الوسم «{tag}»",
    tagsHint: "دوس Enter بعد كل وسم. لحد {n} وسم.",
    author: "اسم الكاتب",
    authorHint: "بيظهر تحت العنوان. سيبه فاضي علشان مايظهرش.",
    link: "لينك المقال",
    slugHint: "سيبه فاضي وهنعمله من العنوان. الحروف العربي تنفع.",
    seo: "محركات البحث",
    seoTitle: "العنوان في جوجل",
    seoTitleHint: "فاضي: عنوان المقال.",
    seoDescription: "الوصف في جوجل",
    seoDescriptionHint: "فاضي: الملخص القصير.",
    noindex: "اخفي المقال ده من محركات البحث",
    deletePost: "امسح المقال",
    deleteTitle: "تمسح «{title}»؟",
    deleteBody: "المقال هيختفي من المتجر ومش هينفع يرجع.",
    untitled: "مقال من غير عنوان",
    saving: "بنحفظ…",
    savedDraft: "المسودة اتحفظت",
    publishedToast: "المقال اتنشر",
    scheduledToast: "المقال هينزل {date}",
    savedToast: "التعديلات اتحفظت",
    unpublishedToast: "المقال رجع مسودة",
    deletedToast: "المقال اتمسح",
    fixTitle: "اكتب عنوان للمقال.",
    fixFields: "في خانات محتاجة تتصلح — معلّم عليها.",
    fixBlocks: "في بلوكات محتاجة تتكمّل — معلّم عليها.",
    dateRequired: "اختار اليوم والساعة.",
    dateFuture: "اختار ميعاد لسه مجاش، أو انشر دلوقتي.",
    slugTaken: "في مقال تاني واخد اللينك ده. غيّره أو سيبه فاضي.",
    categoryGone: "التصنيف ده اتمسح. اختار تصنيف تاني.",
    productGone: "في بلوك منتج بيشاور على منتج مبقاش في متجرك. اختار منتج تاني.",
    p_required: "املا الخانة دي.",
    p_tooLong: "الكلام ده طويل زيادة.",
    p_imageUrl: "استخدم لينك صورة بيبدأ بـ https://، أو اختار صورة من المكتبة.",
    p_link: "راجع اللينك ده.",
    p_product: "اختار منتج.",
    p_tooMany: "كتير زيادة.",
    p_server: "راجع الخانة دي.",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;
type Action = "draft" | "publish" | "schedule" | "save" | "unpublish";
type Loaded = { post: BlogPost | null; categories: BlogCategory[] };

/**
 * Blog → a post (handoff item 190, website.edit): `/blog/new` and
 * `/blog/:postId`. The title, summary and blocks on the wide column; when it
 * goes live, the cover, category, tags, author, link and search-engine
 * fields beside it (below it on a phone). «احفظ مسودة» / «انشر» / «جدوِل»
 * sit at the top end on a desktop and in a bar at the bottom on a phone.
 */
export function BlogPostEditorPage() {
  const t = useT(STRINGS);
  const words = useT(BLOG_WORDS);
  const { postId } = useParams<{ postId: string }>();
  const location = useLocation();
  const workspaceId = useWorkspaceId();
  // A post just created here arrives with the navigation, so the page doesn't load it again.
  const handed = (location.state as { created?: Loaded } | null)?.created ?? null;

  const state = useAsync<Loaded>(async () => {
    if (handed && handed.post && handed.post.id === postId) return handed;
    const [post, categories] = await Promise.all([
      postId ? blogPostGet(apiClient, workspaceId, postId) : Promise.resolve(null),
      blogCategoriesList(apiClient, workspaceId),
    ]);
    return { post, categories };
  }, [workspaceId, postId]);
  // Used once: the browser keeps navigation state across a reload, which must load the saved post, not this copy.
  const navigate = useNavigate();
  useEffect(() => {
    if (handed) navigate(location.pathname, { replace: true, state: null });
  }, [handed, location.pathname, navigate]);

  const missing = state.error instanceof ApiError && state.error.status === 404;

  return (
    <div className="max-w-6xl">
      {missing ? (
        <>
          <PageHeader title={t.titleEdit} back={{ to: "/blog", label: words.blog }} />
          <EmptyState
            icon={<IconFileUnknown aria-hidden />}
            title={t.notFound}
            description={t.notFoundHint}
            action={
              <Button asChild className="min-h-11">
                <Link to="/blog">{t.backToBlog}</Link>
              </Button>
            }
          />
        </>
      ) : (
        <DataState
          loading={state.loading}
          error={state.error}
          onRetry={() => void state.refresh()}
        >
          {state.data && (
            <UnsavedGuardProvider key={postId ?? "new"}>
              <PostForm key={postId ?? "new"} t={t} initial={state.data} />
            </UnsavedGuardProvider>
          )}
        </DataState>
      )}
    </div>
  );
}

function PostForm({ t, initial }: { t: T; initial: Loaded }) {
  const words = useT(BLOG_WORDS);
  const designer = useT(DESIGNER_STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace } = useWorkspace();

  const [post, setPost] = useState<BlogPost | null>(initial.post);
  const [categories, setCategories] = useState<BlogCategoryRef[]>(initial.categories);
  const [draft, setDraft] = useState<PostDraft>(() => (initial.post ? draftOf(initial.post) : { ...EMPTY_POST, blocks: [newBlock("paragraph")] }));
  const [savedPrint, setSavedPrint] = useState(() => fingerprint(draft));
  const state = post?.state ?? "draft";
  const [mode, setMode] = useState<"now" | "later">(state === "scheduled" ? "later" : "now");
  const [when, setWhen] = useState(() => (state === "scheduled" ? localInputOf(post?.publishedAt) : defaultScheduleInput()));
  const [openId, setOpenId] = useState<string | null>(() => (initial.post ? null : draft.blocks[0]?.id ?? null));
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState<Action | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PostField | "when" | "categoryId", string>>>({});
  const [serverBlockProblems, setServerBlockProblems] = useState<Record<string, BlockProblems>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [confirm, setConfirm] = useState<"unpublish" | "delete" | null>(null);

  const dirty = fingerprint(draft) !== savedPrint;
  // Leaving with unsaved changes asks first: the links of the page (LeaveGuard), a reload or a closed tab (the provider).
  useReportDirty(dirty);

  const set = <K extends keyof PostDraft>(key: K, value: PostDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key as PostField]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const primary: Action = state === "published" ? "save" : mode === "later" ? "schedule" : "publish";
  const secondary: Action = state === "draft" ? "draft" : "unpublish";
  const actionLabel: Record<Action, string> = {
    draft: words.saveDraft,
    publish: words.publish,
    schedule: words.schedule,
    save: t.saveChanges,
    unpublish: t.unpublish,
  };

  const problemText = (p: BlockProblem | undefined) => (p ? t[`p_${p}`] : undefined);
  const ownProblems = postProblems(draft);
  const shownField = (key: PostField) => fieldErrors[key] ?? (reveal ? problemText(ownProblems[key]) : undefined);

  const readMinutes = useMemo(() => {
    const count = draft.blocks
      .map((b) => [b.text, b.items].filter(Boolean).join(" "))
      .join(" ")
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(1, Math.round(count / 200));
  }, [draft.blocks]);

  /** The first marked field or block, on screen and focused. */
  function showFirstProblem() {
    // A beat, not a frame: on a narrow screen the mistake may be in the settings sheet, which opens first.
    window.setTimeout(() => {
      const target =
        document.querySelector<HTMLElement>("[data-slot='sheet'] [aria-invalid='true']") ??
        document.querySelector<HTMLElement>("[aria-invalid='true'], .ring-danger");
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      if (target?.matches("input, textarea, select")) target.focus({ preventScroll: true });
    }, 150);
  }

  function bodyFor(action: Action): BlogPostInput & { title: string } {
    const base = inputOf(draft);
    switch (action) {
      case "draft":
        return { ...base, status: "draft" };
      case "unpublish":
        // Its date goes with it: publishing again later makes it new.
        return { ...base, status: "draft", publishedAt: null };
      case "publish": {
        // A scheduled post published now gets today's date; a draft gets the server's "now".
        const future = post?.publishedAt && new Date(post.publishedAt).getTime() > Date.now();
        return { ...base, status: "published", ...(future ? { publishedAt: new Date().toISOString() } : {}) };
      }
      case "schedule":
        return { ...base, status: "published", publishedAt: isoOfLocalInput(when) };
      case "save":
        return { ...base, status: "published" };
    }
  }

  async function run(action: Action) {
    if (busy) return;
    setFormError(null);
    setServerBlockProblems({});
    setFieldErrors({});

    // Checked here first, the way the server checks them, so mistakes show at once.
    const found: Partial<Record<PostField | "when", string>> = {};
    for (const [key, p] of Object.entries(ownProblems) as [PostField, BlockProblem][]) found[key] = problemText(p);
    if (action === "schedule") {
      const iso = isoOfLocalInput(when);
      if (!iso) found.when = t.dateRequired;
      else if (new Date(iso).getTime() <= Date.now() + 30_000) found.when = t.dateFuture;
    }
    const blockIssue = savableBlocks(draft.blocks).find((b) => hasProblems(blockProblems(b)));
    if (Object.keys(found).length > 0 || blockIssue) {
      setReveal(true);
      setFieldErrors(found);
      if (blockIssue && Object.keys(found).length === 0) setOpenId(blockIssue.id);
      toast.error(!draft.title.trim() ? t.fixTitle : blockIssue && Object.keys(found).length === 0 ? t.fixBlocks : t.fixFields);
      showFirstProblem();
      return;
    }

    setBusy(action);
    try {
      const body = bodyFor(action);
      const saved = post ? await blogPostUpdate(apiClient, workspaceId, post.id, body) : await blogPostCreate(apiClient, workspaceId, body);
      const savedDraft = draftOf(saved);
      setReveal(false);
      if (action === "draft") toast.success(t.savedDraft);
      else if (action === "unpublish") toast.success(t.unpublishedToast);
      else if (saved.state === "scheduled") toast.success(fmt(t.scheduledToast, { date: formatDateTime(saved.publishedAt) }));
      else if (action === "save") toast.success(t.savedToast);
      else toast.success(t.publishedToast);

      if (!post) {
        // The new post's own address; it arrives with the navigation instead of loading again.
        navigate(`/blog/${saved.id}`, { replace: true, state: { created: { post: saved, categories } } });
        return;
      }
      setPost(saved);
      // The server's slug (made from the title when left empty) shows in the form.
      setDraft((prev) => ({ ...prev, slug: savedDraft.slug, tags: savedDraft.tags }));
      setSavedPrint(fingerprint({ ...draft, slug: savedDraft.slug, tags: savedDraft.tags }));
      if (saved.state === "scheduled") {
        setMode("later");
        setWhen(localInputOf(saved.publishedAt));
      } else {
        setMode("now");
      }
    } catch (err) {
      handleSaveError(err);
    } finally {
      setBusy(null);
    }
  }

  function handleSaveError(err: unknown) {
    const code = apiErrorCode(err);
    if (code === "SLUG_TAKEN") {
      setFieldErrors({ slug: t.slugTaken });
      toast.error(t.slugTaken);
      showFirstProblem();
      return;
    }
    if (code === "NOT_FOUND" && draft.categoryId) {
      setFieldErrors({ categoryId: t.categoryGone });
      toast.error(t.categoryGone);
      showFirstProblem();
      return;
    }
    const problems = apiFieldProblems(err);
    if (problems.length > 0) {
      const fields: Partial<Record<PostField | "categoryId", string>> = {};
      const blocks: Record<string, BlockProblems> = {};
      // The server counts the blocks that were sent (savableBlocks), not the cards on screen.
      const sent = savableBlocks(draft.blocks);
      let productGone = false;
      for (const p of problems) {
        const [head, index, sub] = p.field.split(".");
        if (head === "blocks" && index !== undefined && /^\d+$/.test(index)) {
          const block = sent[Number(index)];
          if (!block) continue;
          const key = (sub ?? (block.type === "product" ? "productId" : "text")) as BlockField;
          blocks[block.id] = { ...(blocks[block.id] ?? {}), [key]: block.type === "image" && key === "url" ? "imageUrl" : "server" };
        } else if (head === "blocks") {
          productGone = true;
        } else if (head === "seo") {
          fields[index === "description" ? "seoDescription" : "seoTitle"] = t.p_server;
        } else if (head) {
          fields[head as PostField] = head === "coverUrl" ? t.p_imageUrl : t.p_server;
        }
      }
      if (productGone) {
        for (const b of draft.blocks) if (b.type === "product") blocks[b.id] = { productId: "server" };
      }
      setFieldErrors(fields);
      setServerBlockProblems(blocks);
      const firstBlock = draft.blocks.find((b) => blocks[b.id]);
      if (firstBlock && Object.keys(fields).length === 0) setOpenId(firstBlock.id);
      toast.error(productGone ? t.productGone : Object.keys(blocks).length > 0 && Object.keys(fields).length === 0 ? t.fixBlocks : t.fixFields);
      showFirstProblem();
      return;
    }
    const message = errorMessage(err);
    setFormError(message);
    toast.error(message);
  }

  async function remove() {
    if (!post) return;
    await blogPostDelete(apiClient, workspaceId, post.id);
    setConfirm(null);
    toast.success(t.deletedToast);
    // Saved or not, the post is gone: leave without the unsaved-changes question.
    setSavedPrint(fingerprint(draft));
    navigate("/blog");
  }

  const storeLink = post && state === "published" ? `${STOREFRONT_URL}/store/${workspaceId}/blog/${encodeURIComponent(post.slug)}` : null;
  const host = currentWorkspace?.slug ? storeHost(currentWorkspace.slug) : null;
  const titleForDialogs = draft.title.trim() || post?.title || t.untitled;

  const compact = useIsCompact();
  const phone = useIsPhone();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The settings live beside the post on a wide screen and in a sheet on a narrow one: a mistake in one of them opens the sheet.
  const settingsProblem =
    Boolean(fieldErrors.when) ||
    Boolean(fieldErrors.categoryId) ||
    (["coverUrl", "authorName", "slug", "seoTitle", "seoDescription"] as const).some((key) => Boolean(shownField(key)));
  const bodyProblem = Boolean(shownField("title")) || Boolean(shownField("excerpt"));
  useEffect(() => {
    if (compact && settingsProblem && !bodyProblem) setSettingsOpen(true);
    // Only when a new set of marks arrives, not on every keystroke that clears one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldErrors, reveal]);

  // What the save bar saves: the post as it is typed, without changing whether it is live.
  const saveAction: Action = state === "draft" ? "draft" : primary;
  // On a phone the bar above the dock steps aside for the save bar, so a draft can also go live from the save bar.
  const barAction: Action = phone && state === "draft" ? primary : saveAction;
  const publishButton =
    state !== "published" ? (
      <Button type="button" className="min-h-11 rounded-full px-5" disabled={busy !== null} onClick={() => void run(primary)}>
        {busy === primary ? t.saving : actionLabel[primary]}
      </Button>
    ) : null;

  const menu: ContextMenuItem[] = [];
  if (storeLink) menu.push({ id: "view", label: t.viewInStore, icon: IconExternal, onSelect: () => window.open(storeLink, "_blank", "noopener,noreferrer") });
  if (secondary === "unpublish") menu.push({ id: "unpublish", label: t.unpublish, icon: IconDraft, disabled: busy !== null, onSelect: () => setConfirm("unpublish") });
  if (post) menu.push({ id: "delete", label: t.deletePost, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setConfirm("delete") });

  const categoryName = categories.find((c) => c.id === draft.categoryId)?.name;
  const settingsSummary = [words[state], categoryName].filter(Boolean).join(" · ");

  const group = (key: string, title: string, summary: string, openByDefault: boolean, children: ReactNode) =>
    compact ? (
      <section key={key} className="border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0">
        <h3 className="mb-3 text-[13px] leading-5 font-semibold text-ink">{title}</h3>
        {children}
      </section>
    ) : (
      <AccordionSection key={key} title={title} summary={summary} defaultOpen={openByDefault} persistKey={`blog-post:${key}`} keepMounted>
        {children}
      </AccordionSection>
    );

  const settings = (
    <>
      {group(
        "publishing",
        t.publishing,
        words[state],
        true,
        <div className="space-y-3 text-sm">
          {state === "published" && post?.publishedAt && <p className="text-ink">{fmt(t.liveSince, { date: formatDateTime(post.publishedAt) })}</p>}
          {state !== "published" && (
            <>
              <div className="space-y-1.5">
                <p className="font-medium text-ink">{t.when}</p>
                <Segmented
                  label={t.when}
                  size="sm"
                  className="w-full"
                  value={mode}
                  onChange={(v) => {
                    setMode(v);
                    if (fieldErrors.when) setFieldErrors((prev) => ({ ...prev, when: undefined }));
                  }}
                  options={[
                    { value: "now", label: t.now },
                    { value: "later", label: t.later },
                  ]}
                />
              </div>
              {mode === "later" && (
                <Field label={t.dateTime} hint={t.scheduleHint} error={fieldErrors.when}>
                  {({ id, ...aria }) => (
                    <Input
                      id={id}
                      {...aria}
                      type="datetime-local"
                      dir="ltr"
                      value={when}
                      onChange={(e) => {
                        setWhen(e.target.value);
                        if (fieldErrors.when) setFieldErrors((prev) => ({ ...prev, when: undefined }));
                      }}
                    />
                  )}
                </Field>
              )}
              {state === "scheduled" && post?.publishedAt && <p className="text-ink">{fmt(t.liveAt, { date: formatDateTime(post.publishedAt) })}</p>}
              {state === "draft" && <p className="text-xs text-ink-soft">{t.draftNote}</p>}
            </>
          )}
          <p className="text-xs text-ink-soft">
            {fmt(words.readTime, { n: readMinutes, time: countOf("minute", readMinutes) })}
            {post?.updatedAt ? ` · ${fmt(t.lastSaved, { date: formatDateTime(post.updatedAt) })}` : ""}
          </p>
        </div>
      )}

      {group(
        "cover",
        t.cover,
        draft.coverUrl.trim() ? t.coverSet : t.coverNone,
        true,
        <div className="space-y-3">
          <p className="text-xs text-ink-soft">{t.coverHint}</p>
          {draft.coverUrl.trim() && /^https:\/\//i.test(draft.coverUrl.trim()) && (
            <img src={draft.coverUrl.trim()} alt="" className="aspect-[16/9] w-full rounded-[var(--radius)] bg-paper-sunken object-cover ring-1 ring-line" />
          )}
          <ImageSource t={designer} value={draft.coverUrl} error={shownField("coverUrl")} onChange={(url) => set("coverUrl", url)} />
        </div>
      )}

      {group(
        "organise",
        t.organise,
        categoryName ?? t.noCategory,
        true,
        <div className="space-y-4">
          <Field label={t.category} error={fieldErrors.categoryId}>
            {({ id, ...aria }) => (
              <Select
                id={id}
                {...aria}
                value={draft.categoryId}
                onChange={(e) => {
                  set("categoryId", e.target.value);
                  if (fieldErrors.categoryId) setFieldErrors((prev) => ({ ...prev, categoryId: undefined }));
                }}
              >
                <option value="">{t.noCategory}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Button type="button" variant="ghost" size="sm" className="min-h-11 rounded-full sm:min-h-8" onClick={() => setCategoryOpen(true)}>
              <IconPlus className="size-4" aria-hidden />
              {t.newCategory}
            </Button>
            <Link to="/blog/categories" className="inline-flex min-h-11 items-center text-sm font-medium text-primary-dark hover:underline sm:min-h-8">
              {t.manageCategories}
            </Link>
          </div>
          <TagsField t={t} tags={draft.tags} onChange={(tags) => set("tags", tags)} disabled={busy !== null} />
          <Field label={t.author} hint={t.authorHint} error={shownField("authorName")}>
            {({ id, ...aria }) => <Input id={id} {...aria} dir="auto" maxLength={120} value={draft.authorName} onChange={(e) => set("authorName", e.target.value)} />}
          </Field>
        </div>
      )}

      {group(
        "link",
        t.link,
        draft.slug.trim() || t.slugAuto,
        false,
        <Field label={t.link} labelHidden hint={t.slugHint} error={shownField("slug")}>
          {({ id, ...aria }) => (
            <div className="space-y-1.5">
              <Input id={id} {...aria} dir="auto" maxLength={200} value={draft.slug} onChange={(e) => set("slug", e.target.value)} />
              {host && (
                <p className="truncate text-xs text-ink-soft" dir="ltr">
                  {host}/blog/{draft.slug.trim() || "…"}
                </p>
              )}
            </div>
          )}
        </Field>
      )}

      {group(
        "seo",
        t.seo,
        draft.noindex ? t.seoHidden : t.seoSummary,
        false,
        <div className="space-y-4">
          <Field label={t.seoTitle} hint={t.seoTitleHint} error={shownField("seoTitle")}>
            {({ id, ...aria }) => <Input id={id} {...aria} dir="auto" maxLength={200} value={draft.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />}
          </Field>
          <Field label={t.seoDescription} hint={t.seoDescriptionHint} error={shownField("seoDescription")}>
            {({ id, ...aria }) => (
              <Textarea id={id} {...aria} dir="auto" rows={3} maxLength={500} value={draft.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} />
            )}
          </Field>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
            <input type="checkbox" className="size-5 shrink-0 cursor-pointer accent-primary" checked={draft.noindex} onChange={(e) => set("noindex", e.target.checked)} />
            {t.noindex}
          </label>
        </div>
      )}
    </>
  );

  return (
    <LeaveGuard>
      <PageHeader
        title={post ? t.titleEdit : t.titleNew}
        titleBadge={<StatusBadge value={state} tone={STATE_TONE[state]} text={words[state]} />}
        back={{ to: "/blog", label: words.blog }}
        actions={
          <>
            {compact && (
              <Button type="button" variant="outline" className="h-11 min-w-0 gap-2 rounded-full px-4" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}>
                <IconSliders className="size-4 shrink-0" aria-hidden />
                <span className="shrink-0">{t.settings}</span>
                {settingsSummary && <span className="min-w-0 truncate font-normal text-ink-soft max-sm:hidden">{settingsSummary}</span>}
              </Button>
            )}
            <ItemMenu items={menu} label={t.more} />
            {/* From md the one action closes the header; on a phone it is the bar above the dock (below). */}
            {publishButton && <div className="hidden md:contents">{publishButton}</div>}
          </>
        }
      />

      {formError && (
        <p role="alert" className="mb-4 rounded-[var(--radius-card)] bg-danger-soft px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}

      <div className={compact ? "space-y-4" : "grid grid-cols-[minmax(0,1fr)_21rem] items-start gap-4"}>
        <div className="min-w-0 space-y-4">
          <Section title={t.post}>
            <div className="space-y-4">
              <Field label={t.postTitle} required error={shownField("title")}>
                {({ id, ...aria }) => (
                  <Input
                    id={id}
                    {...aria}
                    dir="auto"
                    maxLength={200}
                    placeholder={t.titlePlaceholder}
                    className="h-12 text-base font-medium"
                    value={draft.title}
                    onChange={(e) => set("title", e.target.value)}
                  />
                )}
              </Field>
              <Field label={t.excerpt} hint={t.excerptHint} error={shownField("excerpt")}>
                {({ id, ...aria }) => (
                  <Textarea id={id} {...aria} dir="auto" rows={3} maxLength={500} value={draft.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
                )}
              </Field>
            </div>
          </Section>

          <Section title={t.content} description={phone ? undefined : t.contentHint}>
            <BlogBlockEditor
              blocks={draft.blocks}
              onChange={(blocks) => {
                set("blocks", blocks);
                if (Object.keys(serverBlockProblems).length > 0) setServerBlockProblems({});
              }}
              openId={openId}
              onOpen={setOpenId}
              revealProblems={reveal}
              serverProblems={serverBlockProblems}
              disabled={busy !== null}
            />
          </Section>

          {/* While something is unsaved, the save stays in reach. */}
          <SaveBar
            dirty={dirty}
            saving={busy !== null}
            onSave={() => void run(barAction)}
            saveLabel={actionLabel[barAction]}
            savingLabel={t.saving}
            onDiscard={barAction !== saveAction ? () => void run(saveAction) : undefined}
            discardLabel={actionLabel[saveAction]}
          />
        </div>

        {!compact && <AccordionGroup className="min-w-0">{settings}</AccordionGroup>}
      </div>

      {/* Phone, nothing unsaved: the one action within thumb reach, above the dock. */}
      {publishButton && !dirty && <PageActionBar>{publishButton}</PageActionBar>}

      {compact && (
        <Sheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          title={t.settings}
          description={t.settingsHint}
          size="md"
          footer={
            <Button type="button" className="rounded-full px-5" onClick={() => setSettingsOpen(false)}>
              {t.done}
            </Button>
          }
        >
          {settings}
        </Sheet>
      )}

      <BlogCategoryDialog
        open={categoryOpen}
        category={null}
        nextPosition={categories.length}
        onClose={() => setCategoryOpen(false)}
        onSaved={(category) => {
          setCategories((prev) => [...prev, category]);
          set("categoryId", category.id);
          setCategoryOpen(false);
        }}
      />

      <ConfirmDialog
        open={confirm === "unpublish"}
        title={fmt(t.unpublishTitle, { title: titleForDialogs })}
        description={t.unpublishBody}
        confirmLabel={t.unpublishConfirm}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          setConfirm(null);
          await run("unpublish");
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title={fmt(t.deleteTitle, { title: titleForDialogs })}
        description={t.deleteBody}
        confirmLabel={t.deletePost}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={remove}
      />
    </LeaveGuard>
  );
}

/** Tags as chips: Enter or a comma adds one; lower case, as the store matches them. */
function TagsField({ t, tags, onChange, disabled }: { t: T; tags: string[]; onChange: (tags: string[]) => void; disabled?: boolean }) {
  const inputId = useId();
  const hintId = useId();
  const [text, setText] = useState("");
  const full = tags.length >= BLOG_TAGS_MAX;

  function add(raw: string) {
    const next = [...tags];
    for (const part of raw.split(/[,،]/)) {
      const tag = part.trim().toLowerCase().slice(0, 60);
      if (!tag || next.includes(tag) || next.length >= BLOG_TAGS_MAX) continue;
      next.push(tag);
    }
    setText("");
    if (next.length !== tags.length) onChange(next);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === "،") {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && !text && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {t.tags}
      </label>
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-0.5 ps-2.5 pe-1 text-sm text-primary-dark">
              <bdi>{tag}</bdi>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(tags.filter((x) => x !== tag))}
                aria-label={fmt(t.removeTag, { tag })}
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-paper-raised focus-visible:outline-2 focus-visible:outline-primary"
              >
                <IconClose className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id={inputId}
          dir="auto"
          value={text}
          maxLength={60}
          placeholder={t.tagPlaceholder}
          disabled={disabled || full}
          aria-describedby={hintId}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => text.trim() && add(text)}
          className="min-w-0 flex-1"
        />
        <Button type="button" variant="outline" className="min-h-11 sm:min-h-9" disabled={disabled || full || !text.trim()} onClick={() => add(text)}>
          {t.addTag}
        </Button>
      </div>
      <p id={hintId} className="text-xs text-ink-soft">
        {fmt(t.tagsHint, { n: BLOG_TAGS_MAX })}
      </p>
    </div>
  );
}
