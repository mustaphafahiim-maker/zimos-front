import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import type { StorefrontOptionGroup } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { MenuOptionPicker, useMenuOptions } from "./MenuOptionPicker";

const STORE: StoreInfo = {
  workspaceId: "ws1",
  id: "ws1",
  slug: "shop",
  name: "Shop",
  currency: "EGP",
  logoUrl: null,
  phone: null,
  checkout: { email: "optional", postal_code: "hidden", notes: "optional" },
  orderBump: null,
};

const GROUPS: StorefrontOptionGroup[] = [
  { id: "size", name: "الحجم", required: true, minSelect: 1, maxSelect: 1, choices: [{ id: "s", name: "صغير", priceDeltaAmount: 0 }, { id: "l", name: "كبير", priceDeltaAmount: 3000 }] },
  {
    id: "extras",
    name: "إضافات",
    required: false,
    minSelect: 0,
    maxSelect: 2,
    choices: [
      { id: "cheese", name: "جبنة", priceDeltaAmount: 1000 },
      { id: "olives", name: "زيتون", priceDeltaAmount: 500 },
      { id: "bacon", name: "بيكون", priceDeltaAmount: 1500 },
    ],
  },
];

afterEach(cleanup);

describe("menu options on the product page", () => {
  it("starts a required single group on its first choice, caps a group at its maximum, and sends ids only", () => {
    const { result } = renderHook(() => useMenuOptions(GROUPS));
    expect(result.current.toInput()).toEqual([{ groupId: "size", choiceIds: ["s"] }]);
    act(() => result.current.toggle(GROUPS[0], "l"));
    act(() => result.current.toggle(GROUPS[1], "cheese"));
    act(() => result.current.toggle(GROUPS[1], "olives"));
    act(() => result.current.toggle(GROUPS[1], "bacon")); // over the maximum: ignored
    expect(result.current.toInput()).toEqual([
      { groupId: "size", choiceIds: ["l"] },
      { groupId: "extras", choiceIds: ["cheese", "olives"] },
    ]);
    expect(result.current.deltaPerUnit).toBe(4500);
    expect(result.current.check()).toBe(true);
  });

  it("says which group still needs a pick", () => {
    const groups: StorefrontOptionGroup[] = [{ ...GROUPS[1], id: "sauce", name: "صوص", required: true, minSelect: 1 }];
    function Harness() {
      const state = useMenuOptions(groups);
      return (
        <>
          <MenuOptionPicker state={state} />
          <button type="button" onClick={() => state.check()}>
            go
          </button>
        </>
      );
    }
    render(
      <StoreContextProvider locale="ar" store={STORE}>
        <Harness />
      </StoreContextProvider>
    );
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByRole("group", { name: /صوص/ }).getAttribute("aria-invalid")).toBe("true");
  });
});

// Unticking: an optional one-choice group clears through its "None" choice, a required one only switches,
// and a ticked extra unticks; what goes to the cart and the price follow.
describe("clearing menu picks", () => {
  const SAUCE: StorefrontOptionGroup = {
    id: "sauce",
    name: "صوص",
    required: false,
    minSelect: 0,
    maxSelect: 1,
    choices: [
      { id: "garlic", name: "ثومية", priceDeltaAmount: 500 },
      { id: "bbq", name: "باربكيو", priceDeltaAmount: 700 },
    ],
  };
  const MENU = [GROUPS[0], SAUCE, GROUPS[1]];

  function Harness() {
    const state = useMenuOptions(MENU);
    return (
      <>
        <MenuOptionPicker state={state} />
        <output data-testid="payload">{JSON.stringify(state.toInput())}</output>
        <output data-testid="delta">{state.deltaPerUnit}</output>
      </>
    );
  }
  const renderMenu = (locale: "ar" | "en" | "fr" = "ar") =>
    render(
      <StoreContextProvider locale={locale} store={STORE}>
        <Harness />
      </StoreContextProvider>
    );
  const group = (name: RegExp) => within(screen.getByRole("group", { name }));
  const payload = () => JSON.parse(screen.getByTestId("payload").textContent ?? "[]");
  const delta = () => Number(screen.getByTestId("delta").textContent);

  it("clears an optional one-choice group with its None choice, dropping it from the line and the price", () => {
    renderMenu();
    const sauce = group(/صوص/);
    expect((sauce.getByRole("radio", { name: /بدون/ }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(sauce.getByRole("radio", { name: /ثومية/ }));
    expect(payload()).toEqual([
      { groupId: "size", choiceIds: ["s"] },
      { groupId: "sauce", choiceIds: ["garlic"] },
    ]);
    expect(delta()).toBe(500);

    fireEvent.click(sauce.getByRole("radio", { name: /بدون/ }));
    expect((sauce.getByRole("radio", { name: /ثومية/ }) as HTMLInputElement).checked).toBe(false);
    expect((sauce.getByRole("radio", { name: /بدون/ }) as HTMLInputElement).checked).toBe(true);
    expect(payload()).toEqual([{ groupId: "size", choiceIds: ["s"] }]);
    expect(delta()).toBe(0);
  });

  it("names the None choice in each language", () => {
    renderMenu("en");
    expect(group(/صوص/).getByRole("radio", { name: "None" })).toBeTruthy();
    cleanup();
    renderMenu("fr");
    expect(group(/صوص/).getByRole("radio", { name: "Aucun" })).toBeTruthy();
  });

  it("keeps a required one-choice group picked: no None, a second click keeps it, another choice switches it", () => {
    renderMenu();
    const size = group(/الحجم/);
    expect(size.queryByRole("radio", { name: /بدون/ })).toBeNull();
    fireEvent.click(size.getByRole("radio", { name: /صغير/ }));
    expect((size.getByRole("radio", { name: /صغير/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(size.getByRole("radio", { name: /كبير/ }));
    fireEvent.click(size.getByRole("radio", { name: /كبير/ }));
    expect((size.getByRole("radio", { name: /كبير/ }) as HTMLInputElement).checked).toBe(true);
    expect(payload()).toEqual([{ groupId: "size", choiceIds: ["l"] }]);
    expect(delta()).toBe(3000);

    // The hook refuses to clear it too.
    const { result } = renderHook(() => useMenuOptions(MENU));
    act(() => result.current.clear(GROUPS[0]));
    expect(result.current.picked.size).toEqual(["s"]);
  });

  it("unticks a ticked extra, freeing a place under the maximum", () => {
    renderMenu();
    const extras = group(/إضافات/);
    fireEvent.click(extras.getByRole("checkbox", { name: /جبنة/ }));
    fireEvent.click(extras.getByRole("checkbox", { name: /زيتون/ }));
    expect((extras.getByRole("checkbox", { name: /بيكون/ }) as HTMLInputElement).disabled).toBe(true);
    expect(delta()).toBe(1500);

    fireEvent.click(extras.getByRole("checkbox", { name: /جبنة/ }));
    expect((extras.getByRole("checkbox", { name: /جبنة/ }) as HTMLInputElement).checked).toBe(false);
    expect((extras.getByRole("checkbox", { name: /بيكون/ }) as HTMLInputElement).disabled).toBe(false);
    expect(payload()).toEqual([
      { groupId: "size", choiceIds: ["s"] },
      { groupId: "extras", choiceIds: ["olives"] },
    ]);
    expect(delta()).toBe(500);

    fireEvent.click(extras.getByRole("checkbox", { name: /زيتون/ }));
    expect(payload()).toEqual([{ groupId: "size", choiceIds: ["s"] }]);
    expect(delta()).toBe(0);
  });
});
