"use client";

import type { MenuOptionsSnapshot } from "@store-builder/api-client";

/** A cart line's menu options under the product name: "Size: Large · Extras: Cheese, Olives". */
export function LineOptions({ options }: { options: MenuOptionsSnapshot | null | undefined }) {
  if (!Array.isArray(options) || options.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
      {options.map((g, i) => (
        <li key={g.groupId ?? i} className="line-clamp-2 break-words">
          <span className="font-medium text-ink">{g.groupName}:</span> <span dir="auto">{g.choices.map((c) => c.name).join("، ")}</span>
        </li>
      ))}
    </ul>
  );
}
