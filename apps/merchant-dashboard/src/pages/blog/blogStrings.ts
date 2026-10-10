import type { BlogPostState } from "@store-builder/api-client";
import type { Messages } from "@/i18n/LocaleContext";

/**
 * Words the blog screens share: one name per
 * state, the read time and the post count.
 */
export const BLOG_WORDS = {
  en: {
    blog: "Blog",
    newPost: "New post",
    categories: "Categories",
    draft: "Draft",
    published: "Published",
    scheduled: "Scheduled",
    publish: "Publish",
    schedule: "Schedule",
    saveDraft: "Save draft",
    readTime: "{n} min read",
    posts_one: "1 post",
    posts_other: "{n} posts",
    publishedOn: "Published {date}",
    goesLive: "Goes live {date}",
    editedOn: "Edited {date}",
  },
  ar: {
    blog: "المدونة",
    newPost: "مقال جديد",
    categories: "التصنيفات",
    draft: "مسودة",
    published: "منشور",
    scheduled: "مجدول",
    publish: "نشر",
    schedule: "جدولة",
    saveDraft: "حفظ كمسودة",
    readTime: "قراءة {time}",
    posts_zero: "لا توجد مقالات",
    posts_one: "مقال واحد",
    posts_two: "مقالان",
    posts_few: "{n} مقالات",
    posts_other: "{n} مقالًا",
    publishedOn: "نُشر {date}",
    goesLive: "يُنشر {date}",
    editedOn: "عُدّل {date}",
  },
} satisfies Messages;

export type BlogWords = Record<keyof (typeof BLOG_WORDS)["en"], string>;

/** The state's badge tone: live is good news, a scheduled post is on its way, a draft is quiet. */
export const STATE_TONE: Record<BlogPostState, "success" | "info" | "neutral"> = {
  published: "success",
  scheduled: "info",
  draft: "neutral",
};
