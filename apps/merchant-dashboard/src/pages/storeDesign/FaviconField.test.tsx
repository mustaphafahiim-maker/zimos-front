import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type { MediaAsset } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { stubCanvas } from "@/test/canvasStub";
import { renderWithProviders } from "@/test/renderWithProviders";
import { FaviconField } from "./FaviconField";

let canvas: ReturnType<typeof stubCanvas>;
beforeEach(() => {
  canvas = stubCanvas();
  canvas.bitmap = { width: 800, height: 600, close: vi.fn() };
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const render = (value = "") => {
  const onChange = vi.fn();
  const view = renderWithProviders(<FaviconField value={value} onChange={onChange} disabled={false} />, {
    route: "/settings",
  });
  return { ...view, onChange };
};

// fireEvent rather than user.upload: the latter drops files the accept list
// excludes, and the refusal of those is what is being tested.
const pick = (file: File) => fireEvent.change(screen.getByLabelText("Upload icon"), { target: { files: [file] } });

describe("FaviconField", () => {
  it("uploads a square 512px PNG and fills the link with the stored URL", async () => {
    api.uploadMedia.mockResolvedValue(fake({ id: "med_1", url: "https://media.example.com/ws_1/fav.png" }));
    const { onChange } = render();

    pick(new File([new Uint8Array(10)], "logo.jpg", { type: "image/jpeg" }));

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith("https://media.example.com/ws_1/fav.png"));
    const [workspaceId, sent] = api.uploadMedia.mock.calls[0];
    expect(workspaceId).toBe("ws_1");
    expect(sent).toMatchObject({ type: "image/png", name: "favicon.png" });
    expect(canvas.drawImage).toHaveBeenCalledWith(canvas.bitmap, 100, 0, 600, 600, 0, 0, 512, 512);
  });

  it("refuses a picture under 32×32 with a message, uploading nothing", async () => {
    canvas.bitmap = { width: 16, height: 16, close: vi.fn() };
    const { onChange } = render();

    pick(new File([new Uint8Array(10)], "tiny.png", { type: "image/png" }));

    expect(await screen.findByText("This image is too small: an icon needs at least 32×32 pixels.")).toBeInTheDocument();
    expect(api.uploadMedia).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("refuses another file type with a message", async () => {
    render();
    pick(new File(["%PDF"], "doc.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("Choose a PNG, ICO, JPG or WebP image.")).toBeInTheDocument();
    expect(api.uploadMedia).not.toHaveBeenCalled();
  });

  it("fills the link with an image picked from the library", async () => {
    api.listMedia.mockResolvedValue({
      media: [
        fake<MediaAsset>({ id: "med_2", url: "https://media.example.com/ws_1/a.png", mimeType: "image/png" }),
        fake<MediaAsset>({ id: "med_3", url: "https://media.example.com/ws_1/m.glb", mimeType: "model/gltf-binary" }),
      ],
      nextCursor: null,
    });
    const { user, onChange } = render();

    await user.click(screen.getByRole("button", { name: "Choose from library" }));
    const choices = await screen.findAllByRole("button", { name: "Use this image" });
    expect(choices).toHaveLength(1); // the 3D model is not offered
    await user.click(choices[0]);

    expect(onChange).toHaveBeenCalledWith("https://media.example.com/ws_1/a.png");
    expect(screen.queryByText("Choose an icon")).not.toBeInTheDocument();
  });

  it("clears the link", async () => {
    const { user, onChange } = render("https://media.example.com/ws_1/fav.png");
    expect(screen.getByRole("img", { name: "Icon preview" })).toHaveAttribute("src", "https://media.example.com/ws_1/fav.png");
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("speaks Arabic", async () => {
    renderWithProviders(<FaviconField value="" onChange={vi.fn()} disabled={false} />, { route: "/settings", locale: "ar" });
    expect(screen.getByRole("button", { name: "رفع أيقونة" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "اختيار من المكتبة" })).toBeInTheDocument();
  });
});
