import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Each test starts from an empty page and the console's default language.
afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    /* no storage */
  }
  document.documentElement.lang = "";
  document.documentElement.dir = "";
});

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
