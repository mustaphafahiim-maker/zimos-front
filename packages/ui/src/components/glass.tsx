import type { ComponentProps } from "react";
import { cn } from "cn";
import { Button, type ButtonProps } from "./button";
import { DialogContent } from "./dialog";
import { DropdownMenuContent } from "./dropdown-menu";

/** Opt-in material only. Import @store-builder/ui/styles.css at the host.
 * Keep tables, form bodies and analytics on an opaque Card/Section.
 * These wrappers preserve the existing Base UI interaction primitives.
 */
export function GlassPanel({
  purpose = "floating",
  className,
  ...props
}: ComponentProps<"div"> & {
  purpose?: "navigation" | "floating" | "overlay";
}) {
  return (
    <div
      {...props}
      data-glass-purpose={purpose}
      className={cn("zimos-glass zimos-glass-panel", className)}
    />
  );
}

export function GlassButton({
  className,
  ...props
}: Omit<ButtonProps, "variant">) {
  return (
    <Button
      {...props}
      variant="outline"
      className={cn("zimos-glass zimos-glass-button", className)}
    />
  );
}

export function GlassDialogContent({
  className,
  ...props
}: ComponentProps<typeof DialogContent>) {
  return <DialogContent {...props} className={cn("zimos-glass", className)} />;
}

export function GlassDropdownMenuContent({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent {...props} className={cn("zimos-glass", className)} />
  );
}
