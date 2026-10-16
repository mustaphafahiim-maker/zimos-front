import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MediaLibraryPage } from "./MediaLibraryPage";

// jsdom has no canvas, so the resize step itself is stood in for here; its
// own behaviour is covered in lib/imageResize.test.ts.
const shrunk = new File([new Uint8Array(1024 * 1024)], "photo.jpg", { type: "image/jpeg" });
vi.mock("@/lib/imageResize", () => ({
  shrinkForUpload: vi.fn(async (file: File) =>
    file.name === "photo.jpg" ? { file: shrunk, savedBytes: file.size - shrunk.size } : { file, savedBytes: 0 }
  ),
}));

describe("MediaLibraryPage — resize before upload", () => {
  it("uploads the resized file and says how much it saved", async () => {
    api.listMedia.mockResolvedValue({ media: [], nextCursor: null });
    api.uploadMedia.mockResolvedValue(fake({ id: "med_9", url: "https://media.example.com/ws_1/p.jpg" }));

    const { user } = renderWithProviders(<MediaLibraryPage />, { route: "/media" });
    await screen.findByText("No images yet");

    const original = new File([new Uint8Array(3 * 1024 * 1024)], "photo.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Upload images"), original);

    expect(api.uploadMedia).toHaveBeenCalledWith("ws_1", shrunk);
    expect(await screen.findByText("1 image uploaded. Resizing saved 2.0 MB.")).toBeInTheDocument();
  });

  it("keeps uploading the other files when one fails", async () => {
    api.listMedia.mockResolvedValue({ media: [], nextCursor: null });
    api.uploadMedia
      .mockRejectedValueOnce(new Error("Network down"))
      .mockResolvedValue(fake({ id: "med_10", url: "https://media.example.com/ws_1/b.png" }));

    const { user } = renderWithProviders(<MediaLibraryPage />, { route: "/media" });
    await screen.findByText("No images yet");

    const a = new File(["a"], "a.png", { type: "image/png" });
    const b = new File(["b"], "b.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Upload images"), [a, b]);

    expect(await screen.findByText("1 image uploaded.")).toBeInTheDocument();
    expect(api.uploadMedia).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Network down/)).toBeInTheDocument();
  });
});
