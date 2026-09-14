import type { ReactNode } from "react";
import { ToastProvider as SharedToastProvider } from "@store-builder/ui";

export { useToast } from "@store-builder/ui";

/** Admin toasts stack at the top centre. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return <SharedToastProvider position="top-center">{children}</SharedToastProvider>;
}
