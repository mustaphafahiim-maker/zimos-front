import { useState, type ReactNode } from "react";
import { AlertTriangle, Check, CheckCircle2, Megaphone, Moon, PanelBottom, PanelTop, Plus, Sun, X } from "lucide-react";
import { Button, Input, Label, cn } from "@store-builder/ui";
import { ColorField } from "@/components/ColorField";
import { TextField } from "@/components/Field";
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY, normalizeHex } from "@/lib/brandColors";
import { checkAccent, suggestAccent } from "@/lib/contrast";
import { useThemeFonts } from "@/lib/themeFonts";
import { ImageField } from "./ImageField";
import { editorUi, useEditorLocale, type EditorUi } from "./editorLocale";
import { MoveButtons } from "./MoveButtons";
import {
  FONT_OPTIONS,
  MAX_ANNOUNCEMENT_MESSAGES,
  PALETTES,
  RADIUS_OPTIONS,
  type StoreAnnouncementLook,
  type StoreLook,
} from "./storeLook";
import type { ShellPart } from "./storeShell";
import { ORIGINAL_LOOK, THEME_CHOICES, THEME_SPECS, accentGrounds, type ColorMode } from "./storeThemes";
import { ThemeSketch } from "./ThemeSketch";

/**
 * The inspector's "Store look" tab: the theme, the accent colour for each
 * mode, and the logo, for the whole store. Every change goes straight into
 * the live preview (as an unsaved look the frame lays over the saved one) and
 * is written to the workspace only when the editor saves — see storeLook.ts
 * for the keys.
 *
 * A theme fixes everything but the accent. On the original look the
 * merchant also picks the second colour, font and corners, as before themes.
 *
 * Each accent is checked for contrast in its own mode, against that theme's
 * grounds (storeThemes.ts `accentGrounds`, lib/contrast.ts): a colour that is
 * hard to read gets a warning and a nearest readable suggestion — never a
 * block, the merchant can still save it.
 *
 * `onChange` takes a history key so a burst of typing in a hex box, or a drag
 * across the native colour picker, is one undo step.
 *
 * The announcement bar, header and footer are part of the look too, but each
 * has its own panel (ShellPanels.tsx), opened by clicking it in the preview or
 * in the outline; the foot of this tab points there.
 */
export function StoreLookPanel({
  look,
  onChange,
  onEditShell,
  storeName = "",
  previewMode = "light",
  onPreviewMode,
}: {
  look: StoreLook;
  onChange: (next: StoreLook, historyKey?: string) => void;
  /** Opens the announcement bar's, header's or footer's own panel. */
  onEditShell?: (part: ShellPart) => void;
  /** The specimen in each theme's thumbnail. */
  storeName?: string;
  /** The mode the preview is showing; the thumbnails follow it. */
  previewMode?: ColorMode;
  /** Switches the preview to the mode whose colour the merchant is changing. */
  onPreviewMode?: (mode: ColorMode) => void;
}) {
  const locale = useEditorLocale();
  const ui = editorUi(locale);
  useThemeFonts();

  const theme = look.storeTheme;
  const spec = THEME_SPECS[theme];
  const original = theme === ORIGINAL_LOOK;
  const accentFor = (mode: ColorMode) =>
    mode === "light" ? look.primaryColor : (look.primaryColorDark ?? look.primaryColor);

  function setAccent(mode: ColorMode, hex: string | null, historyKey?: string) {
    onPreviewMode?.(mode);
    onChange(mode === "light" ? { ...look, primaryColor: hex } : { ...look, primaryColorDark: hex }, historyKey);
  }

  return (
    <div className="space-y-6 px-4 py-4">
      <p className="text-xs text-ink-soft">{ui.lookHint}</p>

      <section className="space-y-2">
        <Label>{ui.theme}</Label>
        <div role="radiogroup" aria-label={ui.theme} className="grid grid-cols-2 gap-2">
          {THEME_CHOICES.map((key) => {
            const active = theme === key;
            const option = THEME_SPECS[key];
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={option.name[locale]}
                title={option.description[locale]}
                onClick={() => onChange({ ...look, storeTheme: key })}
                className={cn(
                  "cursor-pointer overflow-hidden rounded-[0.5rem] border text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  active ? "border-primary ring-1 ring-primary" : "border-line hover:border-primary/50"
                )}
              >
                <ThemeSketch
                  theme={key}
                  mode={previewMode}
                  accent={previewMode === "light" ? look.primaryColor : (look.primaryColorDark ?? look.primaryColor)}
                  title={storeName || option.name[locale]}
                />
                <span className="flex items-center gap-1 border-t border-line px-2 py-1.5 text-xs font-medium text-ink">
                  <span className="min-w-0 flex-1 truncate">{option.name[locale]}</span>
                  {active && <Check className="size-3.5 shrink-0 text-primary" aria-hidden />}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-ink-soft">
          <span className="font-medium text-ink">{spec.name[locale]}</span> — {spec.description[locale]}
        </p>
        <p className="text-xs text-ink-soft">{original ? ui.themeOriginalHint : ui.themeHint}</p>
      </section>

      <section className="space-y-3">
        <div>
          <Label>{ui.accentColors}</Label>
          <p className="mt-1 text-xs text-ink-soft">{ui.accentColorsHint}</p>
        </div>
        {(["light", "dark"] as const).map((mode) => {
          const own = mode === "light" ? look.primaryColor : look.primaryColorDark;
          const effective = accentFor(mode) ?? spec.palette[mode].accent;
          const hint =
            mode === "light"
              ? own
                ? ui.accentLightHint
                : ui.themeDefaultColor
              : own
                ? ui.accentDarkHint
                : look.primaryColor
                  ? ui.accentDarkFollows
                  : ui.themeDefaultColor;
          return (
            <div key={mode} className="space-y-2 rounded-[0.5rem] border border-line p-3">
              <LookColor
                label={mode === "light" ? ui.lightMode : ui.darkMode}
                icon={mode === "light" ? <Sun className="size-3.5" aria-hidden /> : <Moon className="size-3.5" aria-hidden />}
                hint={hint}
                value={mode === "light" ? look.primaryColor : accentFor("dark")}
                fallback={spec.palette[mode].accent}
                onChange={(hex) => setAccent(mode, hex, `look:accent:${mode}`)}
              />
              {mode === "dark" && own && (
                <button
                  type="button"
                  onClick={() => setAccent("dark", null)}
                  className="cursor-pointer text-xs font-medium text-primary hover:underline"
                >
                  {ui.matchLightMode}
                </button>
              )}
              <ContrastNote
                ui={ui}
                mode={mode}
                accent={effective}
                grounds={accentGrounds(theme, mode, effective)}
                onUse={(hex) => setAccent(mode, hex)}
              />
            </div>
          );
        })}
      </section>

      {original && (
        <>
          <section className="space-y-2">
            <Label>{ui.palettes}</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {PALETTES.map((palette) => {
                const name = ui.paletteName(palette.key);
                const active = look.primaryColor === palette.primary && look.secondaryColor === palette.secondary;
                return (
                  <button
                    key={palette.key}
                    type="button"
                    aria-pressed={active}
                    aria-label={ui.usePalette(name)}
                    onClick={() =>
                      onChange({ ...look, primaryColor: palette.primary, secondaryColor: palette.secondary })
                    }
                    className={cn(
                      "cursor-pointer flex items-center gap-2 rounded-[0.5rem] border px-2 py-1.5 text-start text-xs font-medium text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      active ? "border-primary bg-primary-soft" : "border-line hover:border-primary/50"
                    )}
                  >
                    <span className="flex shrink-0 overflow-hidden rounded-full border border-line" aria-hidden>
                      <span className="size-4" style={{ backgroundColor: palette.primary }} />
                      <span className="size-4" style={{ backgroundColor: palette.secondary }} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    {active && <Check className="size-3.5 shrink-0 text-primary" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </section>

          <LookColor
            label={ui.secondColor}
            hint={look.secondaryColor ? ui.secondColorHint : ui.storeDefaultColor}
            value={look.secondaryColor}
            fallback={DEFAULT_SECONDARY}
            onChange={(hex) => onChange({ ...look, secondaryColor: hex }, "look:secondary")}
          />

          <section className="space-y-2">
            <Label>{ui.font}</Label>
            <div role="radiogroup" aria-label={ui.font} className="grid grid-cols-2 gap-1.5">
              {FONT_OPTIONS.map((font) => {
                const active = look.fontFamily === font.value;
                return (
                  <button
                    key={font.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChange({ ...look, fontFamily: font.value })}
                    className={cn(
                      "cursor-pointer rounded-[0.5rem] border px-2.5 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      active ? "border-primary bg-primary-soft" : "border-line hover:border-primary/50"
                    )}
                  >
                    <span className="block text-lg leading-tight text-ink" style={{ fontFamily: font.heading }}>
                      Aa أب
                    </span>
                    <span className="block text-xs text-ink-soft" style={{ fontFamily: font.body }}>
                      {ui.fontName(font.value)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <Label>{ui.corners}</Label>
            <div role="radiogroup" aria-label={ui.corners} className="grid grid-cols-3 gap-1.5">
              {RADIUS_OPTIONS.map((option) => {
                const active = look.cornerRadius === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChange({ ...look, cornerRadius: option.value })}
                    className={cn(
                      "cursor-pointer flex flex-col items-center gap-1.5 rounded-[0.5rem] border px-2 py-2 text-xs text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      active ? "border-primary bg-primary-soft" : "border-line hover:border-primary/50"
                    )}
                  >
                    <span
                      className="block h-7 w-10 border-2 border-ink-soft/60 bg-paper-raised"
                      style={{ borderRadius: option.radius }}
                      aria-hidden
                    />
                    {ui.radiusName(option.value)}
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}

      <ImageField
        label={ui.logo}
        hint={ui.logoHint}
        value={look.logoUrl ?? ""}
        onChange={(url) => onChange({ ...look, logoUrl: url || null })}
      />

      {onEditShell && (
        <section className="space-y-2 border-t border-line pt-4">
          <p className="text-xs text-ink-soft">{ui.shellEditHint}</p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["announcement", ui.announcementBar, Megaphone],
                ["header", ui.shellHeader, PanelTop],
                ["footer", ui.shellFooter, PanelBottom],
              ] as const
            ).map(([part, label, Icon]) => (
              <Button key={part} type="button" size="sm" variant="outline" onClick={() => onEditShell(part)}>
                <Icon className="size-4" aria-hidden />
                {label}
              </Button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const ratio = (value: number) => `${(Math.floor(value * 10) / 10).toFixed(1)} : 1`;

/**
 * Whether the accent reads well in this mode — and, when it doesn't, why and
 * the nearest colour that does. A warning, never a block: the merchant can
 * keep their colour and save.
 */
function ContrastNote({
  ui,
  mode,
  accent,
  grounds,
  onUse,
}: {
  ui: EditorUi;
  mode: ColorMode;
  accent: string;
  grounds: ReturnType<typeof accentGrounds>;
  onUse: (hex: string) => void;
}) {
  const check = checkAccent(accent, grounds);
  if (check.ok) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-success">
        <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden />
        {ui.contrastOk(ratio(check.label), ratio(Math.min(check.onPage, check.onCard)))}
      </p>
    );
  }
  const suggestion = suggestAccent(accent, grounds, mode);
  return (
    <div role="status" className="space-y-1.5 rounded-[0.375rem] border border-accent/50 bg-accent-soft px-2.5 py-2 text-xs text-ink">
      <p className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle className="size-3.5 shrink-0 text-accent-dark" aria-hidden />
        {ui.contrastLow(mode)}
      </p>
      <ul className="space-y-0.5 ps-5 text-ink-soft">
        {check.failing.includes("label") && <li>{ui.contrastLabel(ratio(check.label))}</li>}
        {check.failing.includes("text") && <li>{ui.contrastText(ratio(Math.min(check.onPage, check.onCard)))}</li>}
      </ul>
      <p className="text-ink-soft">{ui.contrastTarget}</p>
      {suggestion ? (
        <button
          type="button"
          onClick={() => onUse(suggestion)}
          aria-label={ui.contrastUseAria(suggestion, mode)}
          className="cursor-pointer inline-flex items-center gap-1.5 rounded-[0.375rem] border border-line bg-paper-raised px-2 py-1 font-medium text-ink hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span className="size-3.5 rounded-full border border-line" style={{ backgroundColor: suggestion }} aria-hidden />
          {ui.contrastUse}
          {/* Isolated: after Arabic words the digits of a hex code would otherwise reorder ("B00 … #826"). */}
          <bdi dir="ltr" className="font-mono">
            {suggestion}
          </bdi>
        </button>
      ) : (
        <p className="text-ink-soft">{ui.contrastNoSuggestion}</p>
      )}
    </div>
  );
}

/** All-blank (or empty) messages, the one state a save can't keep "on" — see storeLook.ts's `announcementPatch`. */
function announcementIsBlank(messages: string[]): boolean {
  return messages.every((m) => m.trim() === "");
}

/**
 * The announcement bar's fields — its own panel in the inspector (see
 * ShellPanels.tsx). `onChange` takes a history key, so typing a message or a
 * link is one undo step rather than one per letter.
 */
export function AnnouncementSection({
  announcement,
  onChange,
  bare = false,
}: {
  announcement: StoreAnnouncementLook;
  onChange: (next: StoreAnnouncementLook, historyKey?: string) => void;
  /** No top rule — the section is a panel of its own rather than the foot of another. */
  bare?: boolean;
}) {
  const ui = editorUi(useEditorLocale());

  return (
    <section className={bare ? "space-y-3" : "space-y-3 border-t border-line pt-4"}>
      <label className="flex items-center gap-2 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={announcement.enabled}
          onChange={(e) => onChange({ ...announcement, enabled: e.target.checked })}
          className="size-4 rounded border-line text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        {ui.announcementBar}
      </label>
      <p className="text-xs text-ink-soft">{ui.announcementBarHint}</p>

      {announcement.enabled && (
        <div className="space-y-3 ps-1">
          <AnnouncementMessages
            messages={announcement.messages}
            ui={ui}
            onChange={(messages) => onChange({ ...announcement, messages }, "look:announcement:messages")}
          />
          {announcementIsBlank(announcement.messages) && (
            <p className="text-xs font-medium text-danger">{ui.announcementNeedsMessage}</p>
          )}

          <TextField
            label={ui.announcementLink}
            hint={ui.announcementLinkHint}
            dir="ltr"
            value={announcement.href ?? ""}
            onChange={(e) =>
              onChange({ ...announcement, href: e.target.value.trim() ? e.target.value : null }, "look:announcement:href")
            }
          />

          <LookColor
            label={ui.announcementBackground}
            hint={announcement.background ? ui.announcementColorSetHint : ui.storeDefaultColor}
            value={announcement.background}
            fallback={DEFAULT_PRIMARY}
            onChange={(hex) => onChange({ ...announcement, background: hex })}
          />
          <LookColor
            label={ui.announcementTextColor}
            hint={announcement.color ? ui.announcementColorSetHint : ui.storeDefaultColor}
            value={announcement.color}
            fallback="#FFFFFF"
            onChange={(hex) => onChange({ ...announcement, color: hex })}
          />
        </div>
      )}
    </section>
  );
}

/**
 * The repeatable message list: add/remove/reorder, at least one row shown
 * always (removing the last one is a no-op — clearing text is how a merchant
 * empties it), capped at `MAX_ANNOUNCEMENT_MESSAGES`. Modelled on
 * SectionInspector.tsx's `StringListEditor` (same shape, not shared code —
 * that one isn't exported, and this list also reorders), with `MoveButtons`
 * reused as-is for the up/down controls.
 */
function AnnouncementMessages({
  messages,
  ui,
  onChange,
}: {
  messages: string[];
  ui: EditorUi;
  onChange: (next: string[]) => void;
}) {
  const list = messages.length > 0 ? messages : [""];

  function set(i: number, value: string) {
    onChange(list.map((m, j) => (j === i ? value : m)));
  }
  function add() {
    if (list.length >= MAX_ANNOUNCEMENT_MESSAGES) return;
    onChange([...list, ""]);
  }
  function remove(i: number) {
    if (list.length <= 1) return;
    onChange(list.filter((_, j) => j !== i));
  }
  function move(i: number, direction: "up" | "down") {
    const to = direction === "up" ? i - 1 : i + 1;
    if (to < 0 || to >= list.length) return;
    const next = list.slice();
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <Label>{ui.announcementMessages}</Label>
      <div className="space-y-2">
        {list.map((message, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              value={message}
              dir="auto"
              placeholder={ui.announcementMessagePlaceholder}
              aria-label={ui.announcementMessageAria(i + 1)}
              onChange={(e) => set(i, e.target.value)}
            />
            <MoveButtons
              canMoveUp={i > 0}
              canMoveDown={i < list.length - 1}
              upLabel={ui.announcementMoveUp(i + 1)}
              downLabel={ui.announcementMoveDown(i + 1)}
              onMoveUp={() => move(i, "up")}
              onMoveDown={() => move(i, "down")}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={ui.announcementRemoveMessage(i + 1)}
              disabled={list.length <= 1}
              onClick={() => remove(i)}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={add}
        disabled={list.length >= MAX_ANNOUNCEMENT_MESSAGES}
      >
        <Plus className="size-4" aria-hidden />
        {ui.announcementAddMessage}
      </Button>
    </div>
  );
}

/**
 * ColorField hands back raw keystrokes; only a complete hex reaches the look
 * (and the preview). The half-typed text is kept here until then.
 */
function LookColor({
  label,
  icon,
  hint,
  value,
  fallback,
  onChange,
}: {
  label: string;
  icon?: ReactNode;
  hint: string;
  value: string | null;
  fallback: string;
  onChange: (hex: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <ColorField
      label={label}
      icon={icon}
      hint={hint}
      value={draft ?? value ?? fallback}
      onChange={(raw) => {
        const hex = normalizeHex(raw);
        if (hex && raw.replace(/^#/, "").length === 6) {
          setDraft(null);
          onChange(hex);
        } else {
          setDraft(raw);
        }
      }}
    />
  );
}
