import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input, cn } from "@store-builder/ui";
import { BLOCK_GROUPS, BLOCK_PRESETS, ELEMENT_SPECS, type BlockPreset } from "./blocks";
import { BlockThumbnail } from "./BlockThumbnail";
import { editorUi, elementLabel, groupLabel, presetText, useEditorLocale } from "./editorLocale";

/**
 * The block library, as a gallery: every preset is a card with a schematic of
 * the section it creates (BlockThumbnail), filtered by group tab and a search
 * box that matches either language.
 *
 * Every entry maps onto element types the backend actually allows
 * (pageTree.ALLOWED_ELEMENT_TYPES) — adding one that isn't on that allowlist
 * would make the page unsaveable, so the list is derived from BLOCK_PRESETS
 * rather than hand-written here.
 */

type GroupFilter = "all" | BlockPreset["group"];

/** Everything a search can match for one preset, both languages, lower-cased. */
function searchText(preset: BlockPreset): string {
  const ar = presetText(preset.key, preset, "ar");
  const elements = preset.elements.flatMap((type) => [
    ELEMENT_SPECS[type].label,
    elementLabel(type, ELEMENT_SPECS[type].label, "ar"),
  ]);
  return [preset.label, preset.description, ar.label, ar.description, preset.group, ...elements]
    .join(" ")
    .toLowerCase();
}

const SEARCH_INDEX = new Map(BLOCK_PRESETS.map((preset) => [preset.key, searchText(preset)]));

export function BlockLibrary({
  onAdd,
  showHeader = true,
  insertPosition = null,
  onCancelInsert,
}: {
  onAdd: (preset: BlockPreset) => void;
  /** Off when a surrounding dialog already titles the list. */
  showHeader?: boolean;
  /**
   * 1-based place the next block will land, when the merchant picked one with
   * "add a section here"; null appends to the bottom as before.
   */
  insertPosition?: number | null;
  onCancelInsert?: () => void;
}) {
  const locale = useEditorLocale();
  const ui = editorUi(locale);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupFilter>("all");

  const presets = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return BLOCK_PRESETS.filter((preset) => {
      if (group !== "all" && preset.group !== group) return false;
      const text = SEARCH_INDEX.get(preset.key) ?? "";
      return words.every((word) => text.includes(word));
    });
  }, [query, group]);

  const tabs: Array<{ value: GroupFilter; label: string }> = [
    { value: "all", label: ui.allGroups },
    ...BLOCK_GROUPS.map((g) => ({ value: g, label: groupLabel(g, locale) })),
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showHeader && (
        <div className="border-b border-line px-4 py-3">
          <h2 className="font-display text-sm font-medium text-ink">{ui.addBlock}</h2>
          {insertPosition === null ? (
            <p className="text-xs text-ink-soft">{ui.addBlockHint}</p>
          ) : (
            <p className="mt-1 flex items-center justify-between gap-2 rounded-[0.375rem] bg-primary-soft px-2 py-1 text-xs font-medium text-primary-dark dark:text-primary">
              <span>{ui.insertingAt(insertPosition)}</span>
              {onCancelInsert && (
                <button
                  type="button"
                  onClick={onCancelInsert}
                  className="cursor-pointer flex items-center gap-0.5 rounded px-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <X className="size-3" aria-hidden />
                  {ui.cancelInsert}
                </button>
              )}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2 border-b border-line px-3 py-2.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-soft"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ui.searchBlocks}
            aria-label={ui.searchBlocks}
            className="h-8 ps-8 text-sm"
          />
        </div>
        <div role="group" aria-label={ui.addBlock} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={group === tab.value}
              onClick={() => setGroup(tab.value)}
              className={cn(
                "cursor-pointer shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                group === tab.value
                  ? "bg-primary-soft text-primary-dark dark:text-primary"
                  : "text-ink-soft hover:bg-paper hover:text-ink"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {presets.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-ink-soft">{ui.noBlocksFound}</p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2">
            {presets.map((preset) => {
              const text = presetText(preset.key, preset, locale);
              return (
                <li key={preset.key}>
                  <button
                    type="button"
                    onClick={() => onAdd(preset)}
                    title={text.description}
                    className="cursor-pointer group flex h-full w-full flex-col gap-1.5 rounded-[0.5rem] border border-line bg-paper p-1.5 text-start transition-colors hover:border-primary hover:bg-primary-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <BlockThumbnail elements={preset.elements} />
                    <span className="px-0.5 text-xs font-medium leading-snug text-ink group-hover:text-primary-dark dark:group-hover:text-primary">
                      {text.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
