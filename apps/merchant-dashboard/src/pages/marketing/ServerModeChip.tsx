import type { TrackingPixelServerMode } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";
import { StatusBadge } from "@/components/StatusBadge";
import { AD_PLATFORM_PIXEL_STRINGS } from "./adPlatformPixelStrings";

/**
 * Beside a pixel's «Conversions API» switch: while the platform
 * is in sandbox, its server events are built and logged but not sent — a grey
 * chip says so, with the reason under it. Nothing shows for a live platform or
 * one without a server API.
 *
 * `compact` is the chip alone (the pixels table), with the reason as its title.
 */
export function ServerModeChip({
  mode,
  compact = false,
  className,
}: {
  mode: TrackingPixelServerMode | undefined;
  compact?: boolean;
  className?: string;
}) {
  const t = useT(AD_PLATFORM_PIXEL_STRINGS);
  if (mode !== "sandbox") return null;
  if (compact) {
    return (
      <span title={t.sandboxHelp} className={cn("inline-flex", className)}>
        <StatusBadge value="sandbox" tone="neutral" text={t.sandboxChip} />
      </span>
    );
  }
  return (
    <div className={cn("space-y-1", className)}>
      <StatusBadge value="sandbox" tone="neutral" text={t.sandboxChip} />
      <p className="text-xs text-ink-soft">{t.sandboxHelp}</p>
    </div>
  );
}
