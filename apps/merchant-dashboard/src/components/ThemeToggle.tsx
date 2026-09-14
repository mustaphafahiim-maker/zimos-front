import { ThemeToggle as SharedThemeToggle, type ThemeToggleProps } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";

export { toggleTheme, useTheme, type Theme } from "@store-builder/ui";

const STRINGS = {
  en: { toLight: "Switch to light mode", toDark: "Switch to dark mode" },
  ar: { toLight: "التبديل إلى الوضع الفاتح", toDark: "التبديل إلى الوضع الداكن" },
};

export function ThemeToggle(props: Omit<ThemeToggleProps, "labels">) {
  const t = useT(STRINGS);
  return <SharedThemeToggle labels={t} {...props} />;
}
