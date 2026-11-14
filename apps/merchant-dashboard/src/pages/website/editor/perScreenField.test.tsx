import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import type { PageElementType } from "@store-builder/api-client";
import { ElementField } from "./inspector/ElementFields";
import { EditorScreenProvider } from "./editorScreen";
import { XS_ELEMENT_SPECS } from "./xsBlocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { ScreenDevice } from "@/lib/canvasDrag";

/**
 * A band's own sizes, colours and layout, set apart for each screen: the
 * inspector edits the value of the screen being previewed. The heading at
 * 48 on a computer and 28 on a phone is saved as { base: 48, mobile: 28 };
 * a page that never set a phone's keeps its plain value.
 */
const TYPE = "xs_hero" as PageElementType;
const heading = XS_ELEMENT_SPECS.xs_hero.fields.find((field) => field.key === "headingSize")!;

function renderOn(device: ScreenDevice, value: unknown) {
  const onChange = vi.fn<(key: string, value: unknown) => void>();
  const view = renderWithProviders(
    <EditorScreenProvider value={device}>
      <ElementField elementType={TYPE} spec={heading} props={{ headingSize: value }} onChange={onChange} />
    </EditorScreenProvider>
  );
  return { ...view, onChange, input: screen.getByRole("spinbutton") as HTMLInputElement };
}

describe("a field set apart for each screen", () => {
  it("is every one of a band's own fields, and none of its content", () => {
    const fields = XS_ELEMENT_SPECS.xs_hero.fields;
    expect(fields.filter((field) => field.perScreen).map((field) => field.key)).toEqual(expect.arrayContaining(["headingSize", "paddingTop", "align", "accentColor", "imageWidth"]));
    expect(fields.find((field) => field.key === "heading")?.perScreen).toBeUndefined();
  });

  it("on a computer, edits the computer's value and keeps a plain number", async () => {
    const { input, onChange, user } = renderOn("base", 48);
    expect(input.value).toBe("48");
    await user.clear(input);
    await user.type(input, "52");
    expect(onChange.mock.calls.at(-1)).toEqual(["headingSize", 52]);
  });

  it("on a phone, shows the computer's as the placeholder and saves the phone's apart", async () => {
    const { input, onChange, user } = renderOn("mobile", 48);
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("48");
    expect(screen.getByText(/Same as the computer \(48\)/)).toBeTruthy();
    await user.type(input, "28");
    expect(onChange.mock.calls.at(-1)).toEqual(["headingSize", { base: 48, mobile: 28 }]);
  });

  it("marks a phone's own value and goes back to the computer's", async () => {
    const { input, onChange, user } = renderOn("mobile", { base: 48, mobile: 28 });
    expect(input.value).toBe("28");
    expect(screen.getByText("Set for the phone only")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Use the computer's" }));
    expect(onChange.mock.calls.at(-1)).toEqual(["headingSize", 48]);
  });

  it("on a tablet, a phone's own value is left alone", async () => {
    const { input, onChange, user } = renderOn("tablet", { base: 48, mobile: 28 });
    expect(input.placeholder).toBe("48");
    await user.type(input, "36");
    expect(onChange.mock.calls.at(-1)).toEqual(["headingSize", { base: 48, tablet: 36, mobile: 28 }]);
  });

  it("on a computer, says which smaller screens have their own", () => {
    renderOn("base", { base: 48, mobile: 28 });
    expect(screen.getByText("Phone: set apart")).toBeTruthy();
  });
});
