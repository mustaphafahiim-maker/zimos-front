// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { blogHref, oneParam, postHref } from "./blog";

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

describe("the blog's addresses", () => {
  it("encodes a post's slug, Arabic included", () => {
    expect(postHref("winter-skin")).toBe("/blog/winter-skin");
    expect(postHref("نصائح الشتاء")).toBe(`/blog/${encodeURIComponent("نصائح الشتاء")}`);
  });

  it("keeps the list's filters in the address, and page one out of it", () => {
    expect(blogHref()).toBe("/blog");
    expect(blogHref({ page: 1 })).toBe("/blog");
    expect(blogHref({ category: "tips", page: 2 })).toContain("category=tips");
    expect(blogHref({ category: "tips", page: 2 })).toContain("page=2");
    expect(blogHref({ tag: "skin" })).toContain("tag=skin");
  });

  it("reads one value from a repeated query parameter", () => {
    expect(oneParam(["a", "b"])).toBe("a");
    expect(oneParam("a")).toBe("a");
    expect(oneParam(undefined)).toBeUndefined();
  });
});

describe("the blog pages", () => {
  const post = read("../app/store/[workspaceId]/blog/[slug]/page.tsx");
  const list = read("../app/store/[workspaceId]/blog/page.tsx");

  it("are not there while the blog is switched off", () => {
    for (const source of [post, list]) {
      expect(source).toContain('import { BLOG_ENABLED } from "@/lib/features";');
      expect(source).toMatch(/if \(!BLOG_ENABLED\) notFound\(\);/);
      expect(source).toMatch(/if \(!BLOG_ENABLED\) return \{\};/);
    }
  });

  it("escape the post's words before they go into the page's JSON-LD script", () => {
    // The only raw HTML on the page is the structured data, and a "<" in a title must not end the script.
    const raw = post.match(/dangerouslySetInnerHTML/g) ?? [];
    expect(raw).toHaveLength(1);
    expect(post).toContain("dangerouslySetInnerHTML={{ __html: jsonLd }}");
    expect(post).toMatch(/const jsonLd = JSON\.stringify\([\s\S]*?\)\.replace\(\/<\/g, "\\\\u003c"\);/);
    expect(list).not.toContain("dangerouslySetInnerHTML");
  });
});
