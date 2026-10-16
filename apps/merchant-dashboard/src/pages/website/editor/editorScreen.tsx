import { createContext, useContext } from "react";
import type { ScreenDevice } from "@/lib/canvasDrag";
import type { EditorDevice } from "./shell/useEditorLayout";

/**
 * The screen the editor's preview shows — what a per-screen setting
 * (lib/deviceValue.ts) is set for while the merchant edits: a computer's
 * values on the desktop preview, a tablet's on the tablet one, a phone's on
 * the phone. WebsiteEditorPage provides it; outside the editor it is the
 * computer's.
 */
const EditorScreen = createContext<ScreenDevice>("base");

export const EditorScreenProvider = EditorScreen.Provider;

export function useEditorScreen(): ScreenDevice {
  return useContext(EditorScreen);
}

/**
 * The template header's part last clicked on the canvas (xsShellLayout.ts):
 * the header panel brings its row into view. `nonce` makes a second click
 * on the same part count.
 */
const ShellPartFocus = createContext<{ id: string; nonce: number } | null>(null);

export const ShellPartFocusProvider = ShellPartFocus.Provider;

export function useShellPartFocus(): { id: string; nonce: number } | null {
  return useContext(ShellPartFocus);
}

export function screenOf(device: EditorDevice): ScreenDevice {
  return device === "phone" ? "mobile" : device === "tablet" ? "tablet" : "base";
}
