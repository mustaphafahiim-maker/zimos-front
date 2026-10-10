import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { BlogCategory, BlogPostListItem, Workspace } from "@store-builder/api-client";
import { fake } from "@/test/mocks";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { BlogPostsPage } from "./BlogPostsPage";
import { BlogCategoriesPage } from "./BlogCategoriesPage";

const store = { currentWorkspace: fake<Workspace>({ id: "ws_1", name: "Nile Store", slug: "nile", role: "owner" }) };

const post = fake<BlogPostListItem>({
  id: "post_1",
  title: "Five tips for winter skin",
  slug: "winter-skin",
  excerpt: "What to change when it gets cold.",
  coverImageUrl: null,
  category: null,
  tags: [],
  authorName: null,
  publishedAt: "2026-10-01T10:00:00.000Z",
  readingMinutes: 3,
  state: "published",
  updatedAt: "2026-10-02T10:00:00.000Z",
});

const tips = fake<BlogCategory>({ id: "cat_1", name: "Tips", slug: "tips", description: null, position: 0, postsCount: 4 });

describe("BlogPostsPage", () => {
  it("lists the store's posts", async () => {
    const calls = fakeBackend({
      "GET /blog/posts": { posts: [post], total: 1, page: 1, limit: 20 },
      "GET /blog/categories": { categories: [tips] },
    });
    renderWithProviders(<BlogPostsPage />, { workspace: store });
    expect((await screen.findAllByText("Five tips for winter skin")).length).toBeGreaterThan(0);
    expect(callsTo(calls, "GET", "/workspaces/ws_1/blog/posts").length).toBeGreaterThan(0);
  });

  it("invites a first post when the blog is empty", async () => {
    fakeBackend({ "GET /blog/posts": { posts: [], total: 0, page: 1, limit: 20 }, "GET /blog/categories": { categories: [] } });
    renderWithProviders(<BlogPostsPage />, { workspace: store });
    expect(await screen.findByText("Write your first post")).toBeInTheDocument();
  });

  it("reads in formal Arabic", async () => {
    fakeBackend({ "GET /blog/posts": { posts: [], total: 0, page: 1, limit: 20 }, "GET /blog/categories": { categories: [] } });
    renderWithProviders(<BlogPostsPage />, { workspace: store, locale: "ar" });
    expect(await screen.findByText("اكتب مقالات تجلب عملاء من جوجل وتجيب عن أسئلتهم قبل أن يطلبوا.")).toBeInTheDocument();
  });
});

describe("BlogCategoriesPage", () => {
  it("lists the categories with how many posts each has", async () => {
    fakeBackend({ "GET /blog/categories": { categories: [tips] } });
    renderWithProviders(<BlogCategoriesPage />, { workspace: store });
    expect((await screen.findAllByText("Tips")).length).toBeGreaterThan(0);
  });

  it("adds a category by its name", async () => {
    const calls = fakeBackend({
      "GET /blog/categories": { categories: [] },
      "POST /blog/categories": { category: { id: "cat_2", name: "News", slug: "news", description: null, position: 0 } },
    });
    const { user } = renderWithProviders(<BlogCategoriesPage />, { workspace: store });
    expect(await screen.findByText("No categories yet")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "New category" })[0]);
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Name/), "News");
    await user.click(within(dialog).getByRole("button", { name: /Add category/ }));

    await waitFor(() => expect(callsTo(calls, "POST", "/workspaces/ws_1/blog/categories")).toHaveLength(1));
    expect(callsTo(calls, "POST", "/blog/categories")[0].body).toMatchObject({ name: "News" });
    expect(await screen.findByText("Category added")).toBeInTheDocument();
  });
});
