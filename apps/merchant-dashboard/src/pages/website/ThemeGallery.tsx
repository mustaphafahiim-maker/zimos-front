import { useMemo, useState } from "react";
import { Check, Monitor, Moon, Smartphone, Sun } from "lucide-react";
import { Alert, Button, cn } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { useThemeFonts } from "@/lib/themeFonts";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { TemplateLivePreview } from "@/components/TemplateLivePreview";
import { useToast } from "@/components/Toast";
import { lookToPreview, readStoreLook } from "./editor/storeLook";
import { ORIGINAL_LOOK, THEME_CHOICES, THEME_SPECS, type ColorMode, type ThemeChoice } from "./editor/storeThemes";
import { ThemeSketch } from "./editor/ThemeSketch";
import { themeShowcaseTree } from "./themeShowcase";

const STRINGS = {
  en: {
    title: "Store theme",
    note: "How your whole store looks — fonts, corners, buttons, cards and the opening section. Your accent colours stay yours.",
    modes: "Show the themes in",
    light: "Light mode",
    dark: "Dark mode",
    current: "Current",
    preview: "Try it →",
    previewOf: "Try the {name} theme",
    livePreview: "Your store in the {name} theme",
    device: "Preview size",
    desktop: "Desktop",
    mobile: "Mobile",
    fixed: "Fonts, corners, buttons, cards, spacing and the opening section come from the theme.",
    yours: "Your accent colour — one for light mode, one for dark — stays yours. Set it in the editor, under Store look.",
    previewNote: "Your store's name and products, in this theme. It goes live as soon as you use it — no publishing needed.",
    use: "Use this theme",
    using: "Applying…",
    inUse: "This is your store's theme",
    applied: "{name} is now your store's theme.",
    cancel: "Cancel",
    noPreview: "No preview yet",
  },
  ar: {
    title: "ثيم المتجر",
    note: "شكل متجرك كله — الخطوط والحواف والأزرار والبطاقات وقسم الواجهة. وتبقى ألوان التمييز من اختيارك.",
    modes: "اعرض الثيمات في",
    light: "الوضع الفاتح",
    dark: "الوضع الداكن",
    current: "الحالي",
    preview: "جرّبه ←",
    previewOf: "جرّب ثيم {name}",
    livePreview: "متجرك بثيم {name}",
    device: "حجم المعاينة",
    desktop: "الكمبيوتر",
    mobile: "الهاتف",
    fixed: "الخطوط والحواف والأزرار والبطاقات والمسافات وقسم الواجهة يحددها الثيم.",
    yours: "لون التمييز — واحد للوضع الفاتح وآخر للداكن — يبقى من اختيارك، وتضبطه من المحرر في «مظهر المتجر».",
    previewNote: "اسم متجرك ومنتجاتك بهذا الثيم. يُطبَّق على متجرك فور استخدامه — دون نشر.",
    use: "استخدم هذا الثيم",
    using: "جارٍ التطبيق…",
    inUse: "هذا ثيم متجرك الحالي",
    applied: "أصبح «{name}» ثيم متجرك.",
    cancel: "إلغاء",
    noPreview: "لا توجد معاينة بعد",
  },
} satisfies Messages;

/**
 * The gallery's first row: the store themes (storeThemes.ts). A theme is the
 * store's whole look, whatever template its pages started from, so it sits
 * above the templates and is saved to the workspace — the same
 * `themeSettings.storeTheme` the editor's Store look panel writes.
 *
 * Each card is a drawing of the theme (no server render, so the gallery stays
 * light); the preview renders the real storefront — the store's own name and
 * products on a page built from the editor's presets — in that theme, in
 * either mode, before anything is saved.
 */
export function ThemeGallery() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const { currentWorkspace } = useWorkspace();
  const [mode, setMode] = useState<ColorMode>("light");
  const [selected, setSelected] = useState<ThemeChoice | null>(null);
  useThemeFonts();

  const look = useMemo(() => readStoreLook(currentWorkspace), [currentWorkspace]);
  const accent = mode === "light" ? look.primaryColor : (look.primaryColorDark ?? look.primaryColor);
  const storeName = currentWorkspace?.name ?? "";

  return (
    <section aria-labelledby="store-theme-title" className="mb-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 id="store-theme-title" className="font-display text-base font-medium text-ink">
            {t.title}
          </h2>
          <p className="mt-1 text-xs text-ink-soft">{t.note}</p>
        </div>
        <ModeSwitch mode={mode} onChange={setMode} label={t.modes} light={t.light} dark={t.dark} />
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {THEME_CHOICES.map((key) => {
          const spec = THEME_SPECS[key];
          const current = look.storeTheme === key;
          return (
            <li
              key={key}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border bg-paper-raised transition-colors hover:border-primary",
                current ? "border-primary" : "border-line"
              )}
            >
              <ThemeSketch theme={key} mode={mode} accent={accent} title={storeName || spec.name[locale]} />
              <div className="flex flex-1 flex-col gap-1 border-t border-line p-4">
                <span className="flex items-center gap-2 font-medium text-ink">
                  {spec.name[locale]}
                  {current && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-dark dark:text-primary">
                      <Check className="size-3" aria-hidden />
                      {t.current}
                    </span>
                  )}
                </span>
                <span className="text-xs text-ink-soft">{spec.description[locale]}</span>
                <button
                  type="button"
                  onClick={() => setSelected(key)}
                  aria-label={fmt(t.previewOf, { name: spec.name[locale] })}
                  className="mt-auto cursor-pointer pt-2 text-start text-sm font-medium text-primary after:absolute after:inset-0 after:rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-primary"
                >
                  {t.preview}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? THEME_SPECS[selected].name[locale] : ""}
        description={selected ? THEME_SPECS[selected].description[locale] : undefined}
        className="max-w-6xl"
      >
        {selected && (
          <ThemePreview key={selected} theme={selected} initialMode={mode} onDone={() => setSelected(null)} />
        )}
      </Modal>
    </section>
  );
}

function ModeSwitch({
  mode,
  onChange,
  label,
  light,
  dark,
}: {
  mode: ColorMode;
  onChange: (mode: ColorMode) => void;
  label: string;
  light: string;
  dark: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      {(
        [
          ["light", light, Sun],
          ["dark", dark, Moon],
        ] as const
      ).map(([value, text, Icon]) => (
        <Button
          key={value}
          type="button"
          size="icon"
          variant={mode === value ? "secondary" : "ghost"}
          aria-label={text}
          title={text}
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
        >
          <Icon className="size-4" aria-hidden />
        </Button>
      ))}
    </div>
  );
}

/** The modal body: the real storefront in this theme, and the switch to it. */
function ThemePreview({
  theme,
  initialMode,
  onDone,
}: {
  theme: ThemeChoice;
  initialMode: ColorMode;
  onDone: () => void;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace, refresh } = useWorkspace();
  const toast = useToast();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [mode, setMode] = useState<ColorMode>(initialMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spec = THEME_SPECS[theme];
  const saved = useMemo(() => readStoreLook(currentWorkspace), [currentWorkspace]);
  const current = saved.storeTheme === theme;
  // The store's own look with only the theme swapped: its accents, and on the
  // original look its font, corners and second colour.
  const previewTheme = useMemo(() => lookToPreview({ ...saved, storeTheme: theme }), [saved, theme]);
  const page = useMemo(
    () => themeShowcaseTree({ name: currentWorkspace?.name ?? "", tagline: currentWorkspace?.tagline }, locale),
    // Rebuilt only when the words on it change: a new tree is a new render.
    [currentWorkspace?.name, currentWorkspace?.tagline, locale]
  );

  async function use() {
    setSaving(true);
    setError(null);
    // Merge, never replace: themeSettings is a blob other screens write to too.
    const themeSettings: Record<string, unknown> = { ...(currentWorkspace?.themeSettings ?? {}) };
    if (theme === ORIGINAL_LOOK) delete themeSettings.storeTheme;
    else themeSettings.storeTheme = theme;
    try {
      await apiClient.updateWorkspace(workspaceId, { themeSettings });
      await refresh();
      toast.success(fmt(t.applied, { name: spec.name[locale] }));
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center justify-end gap-1">
          <div role="group" aria-label={t.device} className="flex items-center gap-1">
            {(
              [
                ["desktop", t.desktop, Monitor],
                ["mobile", t.mobile, Smartphone],
              ] as const
            ).map(([value, label, Icon]) => (
              <Button
                key={value}
                type="button"
                size="icon"
                variant={device === value ? "secondary" : "ghost"}
                aria-label={label}
                aria-pressed={device === value}
                onClick={() => setDevice(value)}
              >
                <Icon className="size-4" aria-hidden />
              </Button>
            ))}
          </div>
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          <ModeSwitch mode={mode} onChange={setMode} label={t.modes} light={t.light} dark={t.dark} />
        </div>
        <div className="h-[min(70vh,44rem)] overflow-hidden rounded-[0.5rem] border border-line">
          <TemplateLivePreview
            variant="full"
            device={device}
            workspaceId={workspaceId}
            templateId={`theme:${theme}`}
            page={page}
            theme={previewTheme}
            colorMode={mode}
            title={fmt(t.livePreview, { name: spec.name[locale] })}
            fallback={<ThemeSketch theme={theme} mode={mode} title={currentWorkspace?.name || spec.name[locale]} className="h-full" />}
          />
        </div>
      </div>

      <div className="space-y-4 text-sm">
        {error && <Alert variant="danger">{error}</Alert>}
        <p className="text-ink-soft">{t.previewNote}</p>
        <ul className="space-y-2 text-ink-soft">
          <li className="rounded-[0.5rem] border border-line bg-paper px-3 py-2">{t.fixed}</li>
          <li className="rounded-[0.5rem] border border-line bg-paper px-3 py-2">{t.yours}</li>
        </ul>
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={use} disabled={saving || current}>
            {current ? t.inUse : saving ? t.using : t.use}
          </Button>
        </div>
      </div>
    </div>
  );
}
