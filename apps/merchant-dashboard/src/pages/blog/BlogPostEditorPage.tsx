import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ExternalLink, FileQuestion, Plus, Trash2, X } from "lucide-react";
import { Button, Input, cn } from "@store-builder/ui";
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
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Section } from "@/components/Section";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { FilterTabs } from "@/components/FilterTabs";
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
    unsaved: "You have unsaved changes",
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
    unsaved: "عندك تغييرات لسه ماتحفظتش",
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
            icon={<FileQuestion aria-hidden />}
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
          {state.data && <PostForm key={postId ?? "new"} t={t} initial={state.data} />}
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
  // Leaving with unsaved changes asks first (tab close / reload).
  useEffect(() => {
    if (!dirty || busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);

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
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>("[aria-invalid='true'], .ring-danger");
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      if (target?.matches("input, textarea, select")) target.focus({ preventScroll: true });
    });
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

  const actionButtons = (phone: boolean) => (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn("min-h-11 md:min-h-10", phone && "flex-1")}
        disabled={busy !== null}
        onClick={() => (secondary === "unpublish" ? setConfirm("unpublish") : void run(secondary))}
      >
        {busy === secondary ? t.saving : actionLabel[secondary]}
      </Button>
      <Button type="button" className={cn("min-h-11 md:min-h-10", phone && "flex-1")} disabled={busy !== null} onClick={() => void run(primary)}>
        {busy === primary ? t.saving : actionLabel[primary]}
      </Button>
    </>
  );

  return (
    <>
      <PageHeader
        title={post ? t.titleEdit : t.titleNew}
        titleBadge={<StatusBadge value={state} tone={STATE_TONE[state]} text={words[state]} />}
        back={{ to: "/blog", label: words.blog }}
        actions={
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            {storeLink && (
              <Button asChild variant="ghost" className="min-h-10">
                <a href={storeLink} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" aria-hidden />
                  {t.viewInStore}
                </a>
              </Button>
            )}
            {actionButtons(false)}
          </div>
        }
      />

      {formError && (
        <p role="alert" className="mb-4 rounded-[var(--radius-card)] bg-danger-soft px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
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

          <Section title={t.content} description={t.contentHint}>
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
        </div>

        <div className="min-w-0 space-y-4">
          <Section title={t.publishing}>
            <div className="space-y-3 text-sm">
              {state === "published" && post?.publishedAt && <p className="text-ink">{fmt(t.liveSince, { date: formatDateTime(post.publishedAt) })}</p>}
              {state !== "published" && (
                <>
                  <div className="space-y-1.5">
                    <p className="font-medium text-ink">{t.when}</p>
                    <FilterTabs
                      label={t.when}
                      value={mode}
                      onChange={(v) => {
                        setMode(v);
                        if (fieldErrors.when) setFieldErrors((prev) => ({ ...prev, when: undefined }));
                      }}
                      tabs={[
                        { value: "now", label: t.now },
                        { value: "later", label: t.later },
                      ]}
                      buttonClassName="min-h-10"
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
              {storeLink && (
                <a
                  href={storeLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary-dark hover:underline md:hidden"
                >
                  <ExternalLink className="size-4" aria-hidden />
                  {t.viewInStore}
                </a>
              )}
            </div>
          </Section>

          <Section title={t.cover} description={t.coverHint}>
            <div className="space-y-3">
              {draft.coverUrl.trim() && /^https:\/\//i.test(draft.coverUrl.trim()) && (
                <img src={draft.coverUrl.trim()} alt="" className="aspect-[16/9] w-full rounded-[var(--radius)] bg-paper-sunken object-cover ring-1 ring-line" />
              )}
              <ImageSource
                t={designer}
                value={draft.coverUrl}
                error={shownField("coverUrl")}
                onChange={(url) => set("coverUrl", url)}
              />
            </div>
          </Section>

          <Section title={t.organise}>
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
                <Button type="button" variant="ghost" size="sm" className="min-h-11 sm:min-h-8" onClick={() => setCategoryOpen(true)}>
                  <Plus className="size-4" aria-hidden />
                  {t.newCategory}
                </Button>
                <Link to="/blog/categories" className="inline-flex min-h-11 items-center text-sm font-medium text-primary-dark hover:underline sm:min-h-8">
                  {t.manageCategories}
                </Link>
              </div>
              <TagsField t={t} tags={draft.tags} onChange={(tags) => set("tags", tags)} disabled={busy !== null} />
              <Field label={t.author} hint={t.authorHint} error={shownField("authorName")}>
                {({ id, ...aria }) => (
                  <Input id={id} {...aria} dir="auto" maxLength={120} value={draft.authorName} onChange={(e) => set("authorName", e.target.value)} />
                )}
              </Field>
            </div>
          </Section>

          <Section title={t.link}>
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
          </Section>

          <Section title={t.seo}>
            <div className="space-y-4">
              <Field label={t.seoTitle} hint={t.seoTitleHint} error={shownField("seoTitle")}>
                {({ id, ...aria }) => (
                  <Input id={id} {...aria} dir="auto" maxLength={200} value={draft.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
                )}
              </Field>
              <Field label={t.seoDescription} hint={t.seoDescriptionHint} error={shownField("seoDescription")}>
                {({ id, ...aria }) => (
                  <Textarea id={id} {...aria} dir="auto" rows={3} maxLength={500} value={draft.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} />
                )}
              </Field>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
                <input type="checkbox" className="size-4 accent-primary" checked={draft.noindex} onChange={(e) => set("noindex", e.target.checked)} />
                {t.noindex}
              </label>
            </div>
          </Section>

          {post && (
            <Button type="button" variant="ghost" className="min-h-11 w-full text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setConfirm("delete")}>
              <Trash2 className="size-4" aria-hidden />
              {t.deletePost}
            </Button>
          )}
        </div>
      </div>

      {/* Phone: the two actions within thumb reach, above the tab bar. */}
      <div
        className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mt-4 flex gap-2 rounded-[var(--radius-card)] bg-paper-raised p-3 shadow-[var(--shadow-raised)] ring-1 ring-line md:hidden"
        role="region"
        aria-label={dirty ? t.unsaved : t.publishing}
      >
        {actionButtons(true)}
      </div>

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
    </>
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
                <X className="size-3.5" aria-hidden />
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
