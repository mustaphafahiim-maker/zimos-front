import { useState } from "react";
import { IconPlug } from "@/components/icons";
import { cn } from "@store-builder/ui";

/**
 * An outside app's own icon (an https address its developer gave), or the
 * plug tile every app without a picture gets — also when the picture fails to
 * load. Decorative: the app's name is always written beside it.
 */
export function PartnerAppIcon({ url, className }: { url: string | null | undefined; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return <img src={url} alt="" onError={() => setBroken(true)} className={cn("shrink-0 rounded-xl border border-line object-cover", className)} />;
  }
  return (
    <div aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary", className)}>
      <IconPlug className="size-5" />
    </div>
  );
}
