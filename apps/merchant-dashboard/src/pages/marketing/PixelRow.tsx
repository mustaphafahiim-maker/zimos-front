import type { ReactNode } from "react";
import type { TrackingPixelDto, TrackingPixelScope } from "@store-builder/api-client";
import { AdPlatformMark } from "@/components/AdPlatformMark";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { IconPause, IconPlay } from "@/components/icons";
import { ListRowCard } from "@/components/list";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useT } from "@/i18n/LocaleContext";
import { pluralOf } from "@/lib/plural";
import { formatRelativeTime } from "@/lib/relativeTime";
import { DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction, rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { ServerModeChip } from "./ServerModeChip";
import { pixelPlatformName } from "./pixelPlatforms";
import { PIXEL_STRINGS, type PixelText } from "./pixelStrings";

/** The columns of the pixels sheet: which platform, which ID, the server side, where it stands, what to do. */
export const PIXEL_COLUMNS = "grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_max-content_max-content_max-content]";

/** «المتجر كله», «٣ مسارات بيع», «منتجين». */
export function pixelScopeText(t: PixelText, scope: TrackingPixelScope): string {
  if (scope.type === "all") return t.scopeAll;
  return pluralOf(t, scope.type === "funnels" ? "scopeFunnels" : "scopeProducts", scope.ids.length);
}

/** A small quiet pill for a fact of the row. */
function FactChip({ children }: { children: ReactNode }) {
  return (
    <span data-slot="sweep-fact" className="inline-flex max-w-full items-center gap-1 rounded-full bg-paper-sunken px-2.5 py-0.5 text-xs font-medium text-ink-soft">
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

/** Running or paused, as the chip every list of the dashboard uses. */
export function PixelStatus({ pixel }: { pixel: TrackingPixelDto }) {
  const t = useT(PIXEL_STRINGS);
  return (
    <StatusBadge value={pixel.isActive ? "active" : "paused"} tone={pixel.isActive ? "success" : "neutral"} text={pixel.isActive ? t.active : t.paused} />
  );
}

/**
 * The server side of a pixel (the Conversions API): on, off, or a platform
 * that only works in the browser — and under it the last send or why it
 * failed, with the sandbox chip while the platform is not live yet.
 */
export function PixelServerState({ pixel, wide = false }: { pixel: TrackingPixelDto; wide?: boolean }) {
  const t = useT(PIXEL_STRINGS);
  if (!pixel.capiSupported) return <span className="text-[13px] leading-5 text-ink-soft">{t.capiNone}</span>;
  const line = "mt-1 text-xs leading-4";
  return (
    <div className="min-w-0">
      <StatusBadge
        value={pixel.capiEnabled ? "on" : "off"}
        tone={pixel.capiEnabled ? (pixel.lastError ? "danger" : "success") : "neutral"}
        text={pixel.capiEnabled ? t.capiOn : t.capiOff}
      />
      {pixel.capiEnabled && pixel.lastError && (
        // The platform's own words, in whatever language it wrote them.
        <p dir="auto" title={pixel.lastError} className={`${line} text-danger ${wide ? "wrap-anywhere" : "max-w-56 truncate"}`}>
          {fmt(t.capiError, { error: pixel.lastError })}
        </p>
      )}
      {pixel.capiEnabled && !pixel.lastError && pixel.lastSentAt && (
        <p className={`${line} text-ink-soft`}>{fmt(t.capiLast, { when: formatRelativeTime(pixel.lastSentAt) })}</p>
      )}
      {pixel.capiEnabled && <ServerModeChip mode={pixel.serverMode} compact={!wide} className="mt-1" />}
    </div>
  );
}

export interface PixelRowProps {
  pixel: TrackingPixelDto;
  /** A card (narrow screens) or a line of the sheet. */
  compact: boolean;
  /** Its preview is open. */
  current: boolean;
  menu: ReadonlyArray<ContextMenuItem>;
  onPeek: () => void;
  onToggle: () => void;
}

/**
 * One pixel of the store: which platform and which ID, whether its server
 * events are on, and the ONE move a pixel has every day — pause it or run it
 * again. A press anywhere else opens its preview (Space too), where the rest
 * lives: the test event, edit, delete. The same actions are in the row's menu
 * (right-click, a long press, Shift+F10).
 */
export function PixelRow({ pixel, compact, current, menu, onPeek, onToggle }: PixelRowProps) {
  const t = useT(PIXEL_STRINGS);
  const name = pixelPlatformName(pixel.platform);
  const peekLabel = fmt(t.peek, { name });
  // Enter opens the preview too: a pixel has no page of its own.
  const keys = rowKeyProps(onPeek, onPeek);
  const scope = pixelScopeText(t, pixel.scope);
  const mark = <AdPlatformMark platform={pixel.platform} decorative className="h-7 w-9" />;
  const action = (
    <RowAction label={pixel.isActive ? t.pause : t.resume} icon={pixel.isActive ? IconPause : IconPlay} tone="quiet" onClick={onToggle} />
  );
  const id = (
    <bdi dir="ltr" className="font-mono text-xs">
      {pixel.pixelId}
    </bdi>
  );

  if (compact) {
    return (
      <li>
        <ContextMenu items={menu} label={t.menuLabel}>
          <ListRowCard
            leading={mark}
            title={<bdi>{name}</bdi>}
            status={<PixelStatus pixel={pixel} />}
            meta={id}
            action={action}
            footer={
              <>
                {pixel.capiSupported ? (
                  pixel.capiEnabled && (
                    <StatusBadge
                      value="on"
                      tone={pixel.lastError ? "danger" : "success"}
                      text={pixel.lastError ? t.chipCapiFailing : t.chipCapiOn}
                    />
                  )
                ) : (
                  <FactChip>{t.capiNone}</FactChip>
                )}
                {pixel.capiSupported && pixel.capiEnabled && <ServerModeChip mode={pixel.serverMode} compact />}
                <FactChip>{scope}</FactChip>
                {pixel.label && <FactChip>{pixel.label}</FactChip>}
              </>
            }
            onOpen={onPeek}
            openLabel={peekLabel}
            aria-haspopup="dialog"
            {...keys}
          />
        </ContextMenu>
      </li>
    );
  }

  return (
    <DeskRow onOpen={onPeek} openLabel={peekLabel} keyProps={keys} current={current} menu={menu} menuLabel={t.menuLabel}>
      <div className="flex min-w-0 items-center gap-3">
        {mark}
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-6 font-medium text-ink">
            <bdi>{name}</bdi>
          </p>
          {pixel.label && (
            <p dir="auto" className="truncate text-xs leading-5 text-ink-soft">
              {pixel.label}
            </p>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm leading-6 text-ink">{id}</p>
        <p className="truncate text-xs leading-5 text-ink-soft">{scope}</p>
      </div>

      <PixelServerState pixel={pixel} />

      <div className="flex items-center">
        <PixelStatus pixel={pixel} />
      </div>

      <div className="flex items-center justify-end">{action}</div>
    </DeskRow>
  );
}
