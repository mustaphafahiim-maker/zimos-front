import { useId, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import type { IconComponent } from "@/components/icons";

/** The colour of an icon tile, like System Settings. "blue" is the store's own colour. */
export type SettingsTone = "blue" | "green" | "orange" | "red" | "purple" | "gray" | "teal" | "pink";

/*
 * The tile's solid colour without the glass layer (with it, glass/settings.css
 * draws the same hue as a two-stop gradient). Fixed hues, not the theme tokens:
 * the glyph on them is always white, so they must not lift in the dark theme.
 * White on each is 3:1 or better (the weakest, orange, is 3.4:1).
 */
const TONE_FILL: Record<SettingsTone, string> = {
  blue: "bg-[var(--brand)]",
  green: "bg-[#1f9d51]",
  orange: "bg-[#e8620e]",
  red: "bg-[#e5443f]",
  purple: "bg-[#8b4ff0]",
  gray: "bg-[#767d8a]",
  teal: "bg-[#0e9597]",
  pink: "bg-[#e6468e]",
};

interface SettingsIconTileProps {
  icon: IconComponent;
  tone?: SettingsTone;
  /** `sm` is 28px with a 16px glyph (list rows); `md` is 36px with a 20px glyph (the pane's header). */
  size?: "sm" | "md";
  className?: string;
}

/** The coloured square behind a section's icon. Decorative: the label beside it says what it is. */
export function SettingsIconTile({ icon: Icon, tone = "blue", size = "sm", className }: SettingsIconTileProps) {
  return (
    <span
      aria-hidden
      data-slot="settings-tile"
      data-tone={tone}
      className={cn(
        "zimos-settings-tile flex shrink-0 items-center justify-center text-white",
        size === "md" ? "size-9 rounded-[10px]" : "size-7 rounded-[8px]",
        TONE_FILL[tone],
        className
      )}
    >
      <Icon className={size === "md" ? "size-5" : "size-4"} weight="fill" aria-hidden />
    </span>
  );
}

export interface SettingsPaneProps {
  title: string;
  description?: string;
  icon?: IconComponent;
  /** The icon tile's colour. Default "blue" (the brand). */
  tone?: SettingsTone;
  /** At the end of the header: a button, a link, a status chip. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * The content column of one settings section: a header (icon tile, title,
 * one line of what the section is for, actions at the end) and then the
 * section's cards in a column with the page gap. It is not a card itself —
 * the cards (`SettingsGroup`, `Section`, an accordion) go inside it.
 *
 * The title is an `h2`: the page's `h1` is the name over the section list
 * (`SettingsLayout`).
 */
export function SettingsPane({ title, description, icon, tone = "blue", actions, children, className }: SettingsPaneProps) {
  const headingId = useId();
  return (
    <section
      data-slot="settings-pane"
      aria-labelledby={headingId}
      className={cn("zimos-settings-pane flex min-w-0 flex-col gap-[var(--bento-gap)]", className)}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 pb-1">
        {icon && <SettingsIconTile icon={icon} tone={tone} size="md" />}
        {/* 12rem is the least the title is worth: below that the actions take their own line. */}
        <div className="min-w-0 flex-[1_1_12rem]">
          <h2 id={headingId} className="font-display text-xl leading-7 font-semibold text-ink">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm leading-5 text-ink-soft">{description}</p>}
        </div>
        {actions && <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}
