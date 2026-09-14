"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "cn";

export type Theme = "light" | "dark";

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem("theme");
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function domTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function apply(theme: Theme) {
  const el = document.documentElement;
  el.classList.toggle("dark", theme === "dark");
  el.style.colorScheme = theme;
}

// Subscribers in this tab — `storage` events only fire in *other* tabs.
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onMedia = () => {
    if (storedTheme() !== null) return; // an explicit choice wins over the OS
    apply(mq.matches ? "dark" : "light");
    emit();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== "theme") return;
    apply(storedTheme() ?? (mq.matches ? "dark" : "light"));
    emit();
  };

  mq.addEventListener("change", onMedia);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    mq.removeEventListener("change", onMedia);
    window.removeEventListener("storage", onStorage);
  };
}

/** Flip light/dark, persist the explicit choice and notify every subscriber. */
export function toggleTheme(): void {
  const next: Theme = domTheme() === "dark" ? "light" : "dark";
  apply(next);
  try {
    localStorage.setItem("theme", next);
  } catch {
    /* private mode — the pre-paint script falls back to the system theme */
  }
  emit();
}

export function useTheme(): Theme {
  // A stable "light" server snapshot keeps the first render deterministic.
  return useSyncExternalStore<Theme>(subscribe, domTheme, () => "light");
}

export interface ThemeToggleProps {
  className?: string;
  /** `ghost` (square, tinted hover) or `outline` (round, bordered). */
  variant?: "ghost" | "outline";
  labels?: { toLight?: string; toDark?: string };
}

export function ThemeToggle({ className, variant = "ghost", labels }: ThemeToggleProps) {
  const theme = useTheme();
  const label =
    theme === "dark" ? (labels?.toLight ?? "Switch to light mode") : (labels?.toDark ?? "Switch to dark mode");

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center text-ink-soft transition-colors",
        variant === "ghost"
          ? "rounded-[10px] hover:bg-primary-soft hover:text-primary"
          : "rounded-full border border-line bg-paper-raised hover:border-ink-soft hover:text-ink",
        className
      )}
    >
      {theme === "dark" ? <Sun className="size-[18px]" aria-hidden /> : <Moon className="size-[18px]" aria-hidden />}
    </button>
  );
}
