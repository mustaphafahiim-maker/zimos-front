"use client";

import { useState } from "react";
import type { MenuOptionsInput, StorefrontOptionGroup } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";

/**
 * The product's menu options (Size, Extras): what the shopper picks, checked
 * here for the group's minimum and maximum before the line goes out. The
 * server checks again and prices the picks from its own menu; the amounts
 * shown here are for the shopper only.
 */
export function useMenuOptions(groups: StorefrontOptionGroup[]) {
  const [picked, setPicked] = useState<Record<string, string[]>>(() =>
    // A required single-choice group starts on its first choice, like a variant.
    Object.fromEntries(groups.map((g) => [g.id, g.minSelect >= 1 && g.maxSelect === 1 && g.choices[0] ? [g.choices[0].id] : []]))
  );
  const [showErrors, setShowErrors] = useState(false);

  const missing = groups.filter((g) => (picked[g.id] ?? []).length < g.minSelect).map((g) => g.id);
  const deltaPerUnit = groups.reduce(
    (sum, g) => sum + g.choices.filter((c) => (picked[g.id] ?? []).includes(c.id)).reduce((s, c) => s + c.priceDeltaAmount, 0),
    0
  );

  function toggle(group: StorefrontOptionGroup, choiceId: string) {
    setPicked((prev) => {
      const current = prev[group.id] ?? [];
      if (group.maxSelect === 1) return { ...prev, [group.id]: current.includes(choiceId) && group.minSelect === 0 ? [] : [choiceId] };
      if (current.includes(choiceId)) return { ...prev, [group.id]: current.filter((id) => id !== choiceId) };
      if (current.length >= group.maxSelect) return prev;
      return { ...prev, [group.id]: [...current, choiceId] };
    });
  }

  return {
    groups,
    picked,
    toggle,
    missing,
    showErrors,
    deltaPerUnit,
    /** False (and the groups say why) while a group needs more picks. */
    check: () => {
      setShowErrors(true);
      return missing.length === 0;
    },
    toInput: (): MenuOptionsInput =>
      groups.filter((g) => (picked[g.id] ?? []).length > 0).map((g) => ({ groupId: g.id, choiceIds: picked[g.id] ?? [] })),
  };
}

export type MenuOptionsState = ReturnType<typeof useMenuOptions>;

export function MenuOptionPicker({ state }: { state: MenuOptionsState }) {
  const { t, money } = useStore();
  if (state.groups.length === 0) return null;
  return (
    <div className="space-y-4">
      {state.groups.map((g) => {
        const chosen = state.picked[g.id] ?? [];
        const single = g.maxSelect === 1;
        const short = state.showErrors && state.missing.includes(g.id);
        const hint = g.minSelect >= 1 ? (single ? t.menu.pickOne : t.menu.pickAtLeast(g.minSelect)) : t.menu.upTo(g.maxSelect);
        return (
          <fieldset key={g.id} aria-invalid={short || undefined}>
            <legend className="flex flex-wrap items-baseline gap-2 text-sm font-semibold text-ink">
              {g.name}
              <span className="text-xs font-normal text-ink-soft">{g.minSelect >= 1 ? `${t.menu.required} · ${hint}` : `${t.menu.optional} · ${hint}`}</span>
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {g.choices.map((c) => {
                const on = chosen.includes(c.id);
                const full = !single && !on && chosen.length >= g.maxSelect;
                return (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
                      on ? "border-primary text-ink" : "border-line text-ink-soft"
                    } ${full ? "opacity-50" : ""}`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type={single ? "radio" : "checkbox"}
                        name={`menu-${g.id}`}
                        checked={on}
                        disabled={full}
                        onChange={() => state.toggle(g, c.id)}
                      />
                      {c.name}
                    </span>
                    {c.priceDeltaAmount > 0 && <span className="text-xs">+{money(c.priceDeltaAmount)}</span>}
                  </label>
                );
              })}
            </div>
            {short && <p className="mt-1 text-sm font-medium text-danger">{hint}</p>}
          </fieldset>
        );
      })}
    </div>
  );
}
