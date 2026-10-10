import { useSyncExternalStore } from "react";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { IconMoon, IconSun } from "@/components/icons";
import { Segmented } from "@/components/Segmented";
import { useGlassState } from "@/components/GlassToggle";
import { SettingsGroup, SettingsRow, SettingsSwitch } from "@/components/settings";

const STRINGS = {
  en: {
    language: "Language",
    languageHint: "The whole dashboard switches at once.",
    arabic: "عربي",
    english: "English",
    theme: "Light or dark",
    themeHint: "Dark is easier on the eyes at night.",
    light: "Light",
    dark: "Dark",
    glass: "Glass surfaces",
    glassHint: "Tables and cards let the background show through. Turn it off for plain solid surfaces.",
    glassSystem: "Your device asks for solid surfaces, so glass stays off here.",
    deviceNote: "These three are kept on this device.",
  },
  ar: {
    language: "اللغة",
    languageHint: "تتحوّل لوحة التحكم كلها مرة واحدة.",
    arabic: "عربي",
    english: "English",
    theme: "فاتح أو داكن",
    themeHint: "الوضع الداكن أريح للعين ليلًا.",
    light: "فاتح",
    dark: "داكن",
    glass: "الأسطح الزجاجية",
    glassHint: "تُظهر الجداول والبطاقات الخلفية من ورائها. أوقفها إذا أردت أسطحًا مصمتة.",
    glassSystem: "جهازك يطلب أسطحًا مصمتة، لذلك يبقى الزجاج متوقفًا هنا.",
    deviceNote: "هذه الخيارات الثلاثة محفوظة على هذا الجهاز.",
  },
} satisfies Messages;

type Theme = "light" | "dark";

/** The same key and the same two steps as components/ThemeToggle.tsx and the pre-paint script in index.html. */
const THEME_KEY = "theme";
/** components/GlassToggle.tsx keeps its choice here; "off" is the only value it stores. */
const GLASS_KEY = "zimos.glass";

function domTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** The theme is the `dark` class on <html>: whoever changes it (this control, the side menu's toggle, the OS), this follows. */
function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function setTheme(theme: Theme) {
  const el = document.documentElement;
  el.classList.toggle("dark", theme === "dark");
  el.style.colorScheme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode — the pre-paint script falls back to the system theme */
  }
}

/**
 * Turns glass on or off the way GlassToggle does: the choice is its storage
 * key, and the `storage` event is what its own store listens to, so the
 * attribute on <html> and every `useGlassState` reader follow at once.
 */
function setGlass(on: boolean) {
  try {
    if (on) localStorage.removeItem(GLASS_KEY);
    else localStorage.setItem(GLASS_KEY, "off");
    window.dispatchEvent(new StorageEvent("storage", { key: GLASS_KEY }));
  } catch {
    // Storage is blocked: the attribute alone, for this visit.
    if (on) document.documentElement.removeAttribute("data-glass");
    else document.documentElement.setAttribute("data-glass", "off");
  }
}

/**
 * Settings → "Language and look": the language, light or dark, and the glass switch.
 * All three are kept on this device and change at once — nothing to save.
 */
export function AppearanceSection() {
  const t = useT(STRINGS);
  const { locale, setLocale } = useLocale();
  const theme = useSyncExternalStore<Theme>(subscribeTheme, domTheme, () => "light");
  const glass = useGlassState();

  return (
    <SettingsGroup footer={t.deviceNote}>
      <SettingsRow
        label={t.language}
        hint={t.languageHint}
        control={
          <Segmented
            label={t.language}
            value={locale}
            onChange={setLocale}
            options={[
              { value: "ar", label: t.arabic },
              { value: "en", label: t.english },
            ]}
          />
        }
      />
      <SettingsRow
        label={t.theme}
        hint={t.themeHint}
        control={
          <Segmented
            label={t.theme}
            value={theme}
            onChange={setTheme}
            options={[
              { value: "light", label: t.light, icon: IconSun },
              { value: "dark", label: t.dark, icon: IconMoon },
            ]}
          />
        }
      />
      {/* A switch the device holds off says why, in words, not only by looking dimmed. */}
      <SettingsSwitch
        label={t.glass}
        hint={glass === "system" ? t.glassSystem : t.glassHint}
        checked={glass === "on"}
        disabled={glass === "system"}
        onChange={setGlass}
      />
    </SettingsGroup>
  );
}
