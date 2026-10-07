import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
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
