import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button, Input, Label, cn } from "@store-builder/ui";
import { ColorField } from "@/components/ColorField";
import { TextField } from "@/components/Field";
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY, normalizeHex } from "@/lib/brandColors";
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

/**
 * The inspector's "Store look" tab: colours, font, corners and logo for the
 * whole store. Every change goes straight into the live preview (as an
 * unsaved look the frame lays over the saved one) and is written to the
 * workspace only when the editor saves — see storeLook.ts for the keys.
 *
 * `onChange` takes a history key so a burst of typing in a hex box, or a drag
 * across the native colour picker, is one undo step.
 *
 * The announcement bar section at the bottom previews live on the real
 * storefront once saved — `announcementOf` (storeAnnouncement.ts) reads it
 * straight off the workspace on every request. It does NOT preview inside
 * this editor's own live iframe before that save: the preview bridge's
 * `PreviewTheme` only ever carries colours/font/corners/logo (see
 * storeLook.ts's `lookToPreview`), so an unsaved toggle here has nothing to
 * show in the canvas until Save reloads it for real.
 */
export function StoreLookPanel({
  look,
  onChange,
}: {
  look: StoreLook;
  onChange: (next: StoreLook, historyKey?: string) => void;
}) {
  const ui = editorUi(useEditorLocale());

  return (
    <div className="space-y-6 px-4 py-4">
      <p className="text-xs text-ink-soft">{ui.lookHint}</p>

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
        label={ui.primaryColor}
        hint={look.primaryColor ? ui.primaryColorHint : ui.storeDefaultColor}
        value={look.primaryColor}
        fallback={DEFAULT_PRIMARY}
        onChange={(hex) => onChange({ ...look, primaryColor: hex }, "look:primary")}
      />
      <LookColor
        label={ui.accentColor}
        hint={look.secondaryColor ? ui.accentColorHint : ui.storeDefaultColor}
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

      <ImageField
        label={ui.logo}
        hint={ui.logoHint}
        value={look.logoUrl ?? ""}
        onChange={(url) => onChange({ ...look, logoUrl: url || null })}
      />

      <AnnouncementSection
        announcement={look.announcement}
        onChange={(next) => onChange({ ...look, announcement: next })}
      />
    </div>
  );
}

/** All-blank (or empty) messages, the one state a save can't keep "on" — see storeLook.ts's `announcementPatch`. */
function announcementIsBlank(messages: string[]): boolean {
  return messages.every((m) => m.trim() === "");
}

function AnnouncementSection({
  announcement,
  onChange,
}: {
  announcement: StoreAnnouncementLook;
  onChange: (next: StoreAnnouncementLook) => void;
}) {
  const ui = editorUi(useEditorLocale());

  return (
    <section className="space-y-3 border-t border-line pt-4">
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
            onChange={(messages) => onChange({ ...announcement, messages })}
          />
          {announcementIsBlank(announcement.messages) && (
            <p className="text-xs font-medium text-danger">{ui.announcementNeedsMessage}</p>
          )}

          <TextField
            label={ui.announcementLink}
            hint={ui.announcementLinkHint}
            dir="ltr"
            value={announcement.href ?? ""}
            onChange={(e) => onChange({ ...announcement, href: e.target.value.trim() ? e.target.value : null })}
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
  hint,
  value,
  fallback,
  onChange,
}: {
  label: string;
  hint: string;
  value: string | null;
  fallback: string;
  onChange: (hex: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <ColorField
      label={label}
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
