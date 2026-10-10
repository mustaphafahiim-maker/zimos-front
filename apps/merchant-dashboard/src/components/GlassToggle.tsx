import { useCallback, useSyncExternalStore } from "react";
import { cn } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { name: "Glass surfaces" },
  ar: { name: "الأسطح الزجاجية" },
};

const KEY = "zimos.glass";

/** "on": glass shows. "off": the merchant turned it off. "system": the device asks for solid surfaces, whatever was chosen. */
export type GlassState = "on" | "off" | "system";

/** The device asked for less transparency or forced colours: the panes stay solid whatever was chosen. */
function systemWantsSolid(): boolean {
  return (
    window.matchMedia("(prefers-reduced-transparency: reduce)").matches ||
    window.matchMedia("(forced-colors: active)").matches
  );
}

// The choice for this visit when the browser refuses storage (site data blocked): the switch still works.
let unsaved: boolean | null = null;

function chosenOff(): boolean {
  if (unsaved !== null) return unsaved;
  try {
    return localStorage.getItem(KEY) === "off";
  } catch {
    return false;
  }
}

/** liquid-glass.css is written under :root:not([data-glass="off"]); the pre-paint script in index.html sets the same attribute. */
function apply() {
  const el = document.documentElement;
  if (chosenOff() || systemWantsSolid()) el.setAttribute("data-glass", "off");
  else el.removeAttribute("data-glass");
}

function snapshot(): GlassState {
  if (systemWantsSolid()) return "system";
  return chosenOff() ? "off" : "on";
}

// Subscribers in this tab — `storage` events only fire in *other* tabs.
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  // Another tab, or the device setting, may have changed since this page set the attribute at load.
  apply();

  const queries = [
    window.matchMedia("(prefers-reduced-transparency: reduce)"),
    window.matchMedia("(forced-colors: active)"),
  ];
  const onMedia = () => {
    apply();
    emit();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    apply();
    emit();
  };

  queries.forEach((mq) => mq.addEventListener("change", onMedia));
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    queries.forEach((mq) => mq.removeEventListener("change", onMedia));
    window.removeEventListener("storage", onStorage);
  };
}

/** Whether glass is on, off by choice, or held off by the device — for the row that explains the switch. */
export function useGlassState(): GlassState {
  return useSyncExternalStore<GlassState>(subscribe, snapshot, () => "on");
}

interface GlassToggleProps {
  /** id of the visible label of the row; the switch takes its name from it. */
  labelledBy?: string;
  /** id of the visible hint of the row. */
  describedBy?: string;
  className?: string;
}

/** Turns the dashboard's glass surfaces on or off on this device. Drawn like the other switches, in a 44px target. */
export function GlassToggle({ labelledBy, describedBy, className }: GlassToggleProps) {
  const t = useT(STRINGS);
  const state = useGlassState();
  const on = state === "on";

  const toggle = useCallback(() => {
    const off = !chosenOff();
    try {
      if (off) localStorage.setItem(KEY, "off");
      else localStorage.removeItem(KEY);
      unsaved = null;
    } catch {
      unsaved = off;
    }
    apply();
    emit();
  }, []);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : t.name}
      aria-describedby={describedBy}
      disabled={state === "system"}
      onClick={toggle}
      className={cn(
        "group flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-11 rounded-full border transition-colors motion-reduce:transition-none",
          "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-primary",
          on ? "border-primary bg-primary" : "border-line-strong bg-paper"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4.5 rounded-full bg-paper-raised shadow-sm transition-[inset-inline-start] motion-reduce:transition-none",
            on ? "start-[1.375rem]" : "start-0.5"
          )}
        />
      </span>
    </button>
  );
}
