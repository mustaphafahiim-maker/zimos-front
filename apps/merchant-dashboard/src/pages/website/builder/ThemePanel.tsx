import { useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@store-builder/ui";
import {
  ARABIC_FONTS,
  BASE_SIZES,
  LATIN_FONTS,
  NICHES,
  type NicheId,
  THEME_LIST,
  contrastRatio,
  normalizeHex,
  readableOn,
  type RendererLocale,
  type ThemeId,
  type ThemeSettings,
} from "@store-builder/store-renderer";
import { fmt } from "@/i18n/LocaleContext";
import { ColorInput, Field, LinkListEditor, Segmented, SelectInput, Switch, TextArea, TextInput } from "./fields";
import { useBuilderT } from "./strings";

function Group({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-b border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-4 text-ink-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-3 px-3 pb-4">{children}</div>
    </details>
  );
}

function contrastWarning(fg: string, bg: string, min: number, template: string): string | null {
  const a = normalizeHex(fg);
  const b = normalizeHex(bg);
  if (!a || !b) return null;
  const ratio = contrastRatio(a, b);
  return ratio < min ? fmt(template, { ratio: ratio.toFixed(1) }) : null;
}

export function ThemePanel({
  theme,
  uiLocale,
  onChange,
  onPickTheme,
  sizeError,
}: {
  theme: ThemeSettings;
  uiLocale: RendererLocale;
  onChange: (next: ThemeSettings, group: string) => void;
  onPickTheme: (id: ThemeId) => void;
  sizeError: string | null;
}) {
  const t = useBuilderT();
  const set = <K extends keyof ThemeSettings>(key: K, patch: Partial<ThemeSettings[K]>, group: string) =>
    onChange({ ...theme, [key]: { ...(theme[key] as object), ...patch } } as ThemeSettings, group);
  const colors = theme.colors;
  const color = (key: keyof ThemeSettings["colors"]) => (v: string) => set("colors", { [key]: v } as Partial<ThemeSettings["colors"]>, `color:${key}`);
  const onPrimary = colors.buttonText === "auto" ? readableOn(colors.primary) : colors.buttonText;
  const ann = theme.header.announcement;
  const [niche, setNiche] = useState<NicheId | "all">("all");
  const shown = THEME_LIST.filter((p) => niche === "all" || p.niche === niche);

  return (
    <div>
      {sizeError && <p className="m-3 rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{sizeError}</p>}

      <Group title={t.themesTitle} defaultOpen>
        <div role="radiogroup" aria-label={t.themesTitle} className="flex flex-wrap gap-1">
          {[{ id: "all" as const, label: { ar: t.allNiches, en: t.allNiches } }, ...NICHES.filter((n) => THEME_LIST.some((p) => p.niche === n.id))].map((n) => (
            <button key={n.id} type="button" role="radio" aria-checked={niche === n.id} onClick={() => setNiche(n.id)} className={cn("cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", niche === n.id ? "border-primary bg-primary text-white" : "border-line text-ink-soft hover:border-primary hover:text-primary")}>
              {n.label[uiLocale]}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink-muted">{fmt(t.themesCount, { n: shown.length })}</p>
        <ul className="grid gap-2">
          {shown.map((preset) => {
            const current = theme.preset === preset.id;
            const c = preset.settings.colors;
            return (
              <li key={preset.id} className={cn("flex items-center gap-3 rounded-lg border p-2", current ? "border-primary bg-primary-soft/40" : "border-line")}>
                <span className="grid size-10 shrink-0 grid-cols-2 overflow-hidden rounded-md border border-line" aria-hidden>
                  <span style={{ background: c.primary }} />
                  <span style={{ background: c.secondary }} />
                  <span style={{ background: c.background }} />
                  <span style={{ background: c.text }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{preset.name[uiLocale]}</span>
                  <span className="block truncate text-[11px] text-ink-soft" title={preset.description[uiLocale]}>
                    {preset.description[uiLocale]}
                  </span>
                </span>
                {current ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    <Check className="size-3.5" aria-hidden />
                    {t.currentTheme}
                  </span>
                ) : null}
                <button type="button" onClick={() => onPickTheme(preset.id)} className="shrink-0 cursor-pointer rounded-md border border-line px-2 py-1 text-xs font-semibold text-ink hover:border-primary hover:text-primary">
                  {t.applyTheme}
                </button>
              </li>
            );
          })}
        </ul>
      </Group>

      <Group title={t.colorsTitle}>
        <ColorInput label={t.colorPrimary} value={colors.primary} onChange={color("primary")} warning={contrastWarning(onPrimary, colors.primary, 3, t.contrastLow)} />
        <ColorInput label={t.colorSecondary} value={colors.secondary} onChange={color("secondary")} />
        <ColorInput label={t.colorBackground} value={colors.background} onChange={color("background")} />
        <ColorInput label={t.colorText} value={colors.text} onChange={color("text")} warning={contrastWarning(colors.text, colors.background, 4.5, t.contrastLow)} />
        <ColorInput label={t.colorMuted} value={colors.muted} onChange={color("muted")} warning={contrastWarning(colors.muted, colors.background, 3, t.contrastLow)} />
        <ColorInput label={t.colorSurface} value={colors.surface} onChange={color("surface")} warning={contrastWarning(colors.text, colors.surface, 4.5, t.contrastLow)} />
        <ColorInput label={t.colorBorder} value={colors.border} onChange={color("border")} />
        <Switch label={t.buttonTextAuto} checked={colors.buttonText === "auto"} onChange={(auto) => set("colors", { buttonText: auto ? "auto" : readableOn(colors.primary) }, "color:buttonText")} />
        {colors.buttonText !== "auto" && <ColorInput label={t.colorButtonText} value={colors.buttonText} onChange={color("buttonText")} />}
      </Group>

      <Group title={t.fontsTitle}>
        <Field label={t.fontArabic}>
          <SelectInput value={theme.typography.arabicFont} options={ARABIC_FONTS.map((f) => ({ value: f, label: f }))} onChange={(v) => set("typography", { arabicFont: v as ThemeSettings["typography"]["arabicFont"] }, "font")} />
        </Field>
        <Field label={t.fontLatin}>
          <SelectInput value={theme.typography.latinFont} options={LATIN_FONTS.map((f) => ({ value: f, label: f }))} onChange={(v) => set("typography", { latinFont: v as ThemeSettings["typography"]["latinFont"] }, "font")} />
        </Field>
        <Field label={t.baseSize}>
          <Segmented
            label={t.baseSize}
            value={String(theme.typography.baseSize)}
            options={BASE_SIZES.map((s) => ({ value: String(s), label: String(s) }))}
            onChange={(v) => set("typography", { baseSize: Number(v) as ThemeSettings["typography"]["baseSize"] }, "font")}
          />
        </Field>
      </Group>

      <Group title={t.shapeTitle}>
        <Field label={t.radius}>
          <Segmented
            label={t.radius}
            value={theme.shape.radius}
            options={[
              { value: "sharp", label: t.optSharp },
              { value: "soft", label: t.optSoft },
              { value: "rounded", label: t.optRounded },
              { value: "pill", label: t.optPill },
            ]}
            onChange={(v) => set("shape", { radius: v }, "shape")}
          />
        </Field>
        <Field label={t.buttonStyle}>
          <Segmented
            label={t.buttonStyle}
            value={theme.shape.buttonStyle}
            options={[
              { value: "solid", label: t.optSolid },
              { value: "outline", label: t.optOutline },
              { value: "soft", label: t.optSoftBtn },
            ]}
            onChange={(v) => set("shape", { buttonStyle: v }, "shape")}
          />
        </Field>
        <Field label={t.buttonShape}>
          <Segmented
            label={t.buttonShape}
            value={theme.shape.buttonShape}
            options={[
              { value: "square", label: t.optSquare },
              { value: "rounded", label: t.optRoundedBtn },
              { value: "pill", label: t.optPillBtn },
            ]}
            onChange={(v) => set("shape", { buttonShape: v }, "shape")}
          />
        </Field>
        <Field label={t.density}>
          <Segmented
            label={t.density}
            value={theme.layout.density}
            options={[
              { value: "compact", label: t.optCompact },
              { value: "comfortable", label: t.optComfortable },
              { value: "airy", label: t.optAiry },
            ]}
            onChange={(v) => set("layout", { density: v }, "layout")}
          />
        </Field>
      </Group>

      <Group title={t.headerTitle}>
        <Field label={t.headerLayout}>
          <Segmented
            label={t.headerLayout}
            value={theme.header.layout}
            options={[
              { value: "logo-start", label: t.optLogoStart },
              { value: "logo-center", label: t.optLogoCenter },
            ]}
            onChange={(v) => set("header", { layout: v }, "header")}
          />
        </Field>
        <Switch label={t.sticky} checked={theme.header.sticky} onChange={(v) => set("header", { sticky: v }, "header")} />
        <Switch label={t.showSearch} checked={theme.header.showSearch} onChange={(v) => set("header", { showSearch: v }, "header")} />
        <Switch label={t.announcement} checked={ann.enabled} onChange={(v) => set("header", { announcement: { ...ann, enabled: v } }, "announcement")} />
        {ann.enabled && (
          <>
            <Field label={t.announcementText}>
              <TextInput value={ann.text} onChange={(v) => set("header", { announcement: { ...ann, text: v.slice(0, 160) } }, "announcement:text")} />
            </Field>
            <Field label={t.announcementLink}>
              <TextInput dir="ltr" value={ann.href} placeholder="/?search=1#products" onChange={(v) => set("header", { announcement: { ...ann, href: v } }, "announcement:href")} />
            </Field>
            <ColorInput label={t.announcementBg} value={ann.background} onChange={(v) => set("header", { announcement: { ...ann, background: v } }, "announcement:bg")} warning={contrastWarning(ann.color, ann.background, 4.5, t.contrastLow)} />
            <ColorInput label={t.announcementFg} value={ann.color} onChange={(v) => set("header", { announcement: { ...ann, color: v } }, "announcement:fg")} />
          </>
        )}
      </Group>

      <Group title={t.footerTitle}>
        <Field label={t.footerColumns}>
          <Segmented
            label={t.footerColumns}
            value={String(theme.footer.columns)}
            options={["2", "3", "4"].map((v) => ({ value: v, label: v }))}
            onChange={(v) => set("footer", { columns: Number(v) as 2 | 3 | 4 }, "footer")}
          />
        </Field>
        <Field label={t.footerAbout}>
          <TextArea value={theme.footer.about} onChange={(v) => set("footer", { about: v.slice(0, 400) }, "footer:about")} />
        </Field>
        <Switch label={t.showSocial} checked={theme.footer.showSocial} onChange={(v) => set("footer", { showSocial: v }, "footer")} />
        {theme.footer.showSocial && (
          <Field label={t.socialLinks}>
            <LinkListEditor value={theme.footer.social} onChange={(v) => set("footer", { social: v.slice(0, 8) }, "footer:social")} />
          </Field>
        )}
        <Field label={t.paymentBadges}>
          <TextInput value={theme.footer.paymentBadges} onChange={(v) => set("footer", { paymentBadges: v.slice(0, 200) }, "footer:badges")} />
        </Field>
        <Field label={t.copyright}>
          <TextInput value={theme.footer.copyright} onChange={(v) => set("footer", { copyright: v.slice(0, 160) }, "footer:copyright")} />
        </Field>
      </Group>

      <Group title={t.productCardTitle}>
        <Field label={t.imageRatio}>
          <Segmented
            label={t.imageRatio}
            value={theme.productCard.imageRatio}
            options={[
              { value: "square", label: t.optRatioSquare },
              { value: "portrait", label: t.optRatioPortrait },
            ]}
            onChange={(v) => set("productCard", { imageRatio: v }, "card")}
          />
        </Field>
        <Switch label={t.showCompare} checked={theme.productCard.showComparePrice} onChange={(v) => set("productCard", { showComparePrice: v }, "card")} />
        <Switch label={t.quickOrder} checked={theme.productCard.quickOrder} onChange={(v) => set("productCard", { quickOrder: v }, "card")} />
      </Group>
    </div>
  );
}
