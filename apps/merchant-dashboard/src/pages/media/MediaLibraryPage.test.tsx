import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import type { MediaAsset } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MediaLibraryPage } from "./MediaLibraryPage";

const asset = fake<MediaAsset>({
  id: "med_1",
  url: "http://localhost:4000/uploads/ws_1/abc.png",
  mimeType: "image/png",
  size: 204800,
  createdAt: "2026-09-14T08:00:00.000Z",
});

describe("MediaLibraryPage", () => {
  it("shows an empty state with a way to upload", async () => {
    api.listMedia.mockResolvedValue({ media: [], nextCursor: null });

    renderWithProviders(<MediaLibraryPage />, { route: "/media" });

    expect(await screen.findByText("No images yet")).toBeInTheDocument();
    expect(api.listMedia).toHaveBeenCalledWith("ws_1", { limit: 60 });
    expect(screen.getAllByRole("button", { name: "Upload images" }).length).toBeGreaterThan(0);
  });

  it("lists uploads with their size and a same-origin thumbnail", async () => {
    api.listMedia.mockResolvedValue({ media: [asset], nextCursor: null });

    renderWithProviders(<MediaLibraryPage />, { route: "/media" });

    const image = await screen.findByRole("img", { name: "Uploaded image" });
    // The host is trimmed so the dev proxy serves it same-origin.
    expect(image).toHaveAttribute("src", "/uploads/ws_1/abc.png");
    expect(screen.getByText("200 KB")).toBeInTheDocument();
  });

  it("removes an image from the library after confirming", async () => {
    api.listMedia.mockResolvedValue({ media: [asset], nextCursor: null });
    api.deleteMedia.mockResolvedValue({ deleted: true, id: "med_1" });

    const { user } = renderWithProviders(<MediaLibraryPage />, { route: "/media" });

    await user.click(await screen.findByRole("button", { name: /^Remove —/ }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/The file itself stays on the server/)
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    expect(api.deleteMedia).toHaveBeenCalledWith("ws_1", "med_1");
    expect(await screen.findByText("No images yet")).toBeInTheDocument();
  });

  it("uploads a picked file and re-reads the list", async () => {
    api.listMedia.mockResolvedValue({ media: [], nextCursor: null });
    api.uploadMedia.mockResolvedValue(
      fake({ id: "med_2", url: "http://localhost:4000/uploads/ws_1/new.png" })
    );

    const { user } = renderWithProviders(<MediaLibraryPage />, { route: "/media" });

    await screen.findByText("No images yet");
    const file = new File(["png-bytes"], "new.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Upload images"), file);

    expect(api.uploadMedia).toHaveBeenCalledWith("ws_1", file);
    expect(await screen.findByText("1 image uploaded.")).toBeInTheDocument();
    expect(api.listMedia).toHaveBeenCalledTimes(2);
  });
});
