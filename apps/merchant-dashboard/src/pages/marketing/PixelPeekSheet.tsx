import type { TrackingPixelDto } from "@store-builder/api-client";
import { Button } from "@store-builder/ui";
import { CopyButton } from "@/components/CopyButton";
import { IconDelete, IconEdit, IconPause, IconPlay, IconSend, IconSpinner } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { useT } from "@/i18n/LocaleContext";
import { Fact, Facts } from "./kit/Facts";
import { PixelServerState, PixelStatus, pixelScopeText } from "./PixelRow";
import { pixelPlatformName } from "./pixelPlatforms";
import { PIXEL_STRINGS } from "./pixelStrings";

export interface PixelPeekSheetProps {
  /** The pixel being looked at. It stays here while the sheet closes, so the sheet does not empty on its way out. */
  pixel: TrackingPixelDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A test event is on its way for this pixel. */
  testing: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onTest: () => void;
  onDelete: () => void;
}

/**
 * The preview of a pixel: a bottom sheet on a phone, a panel on the end edge
 * from 640px, the list still in place behind it. Everything the row was too
 * narrow for — the whole ID with a copy button, the note, where it applies,
 * the server side with its last send or error — and every action a pixel has:
 * the test event, pause / run, edit, delete.
 */
export function PixelPeekSheet({ pixel, open, onOpenChange, testing, onEdit, onToggle, onTest, onDelete }: PixelPeekSheetProps) {
  const t = useT(PIXEL_STRINGS);
  if (!pixel) return null;
  const canTest = pixel.capiEnabled && pixel.capiSupported;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side="auto-end"
      title={<bdi>{pixelPlatformName(pixel.platform)}</bdi>}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onToggle}>
            {pixel.isActive ? <IconPause className="size-4" weight="bold" aria-hidden /> : <IconPlay className="size-4" weight="bold" aria-hidden />}
            {pixel.isActive ? t.pause : t.resume}
          </Button>
          <Button type="button" className="rounded-full px-5" onClick={onEdit}>
            <IconEdit className="size-4" weight="bold" aria-hidden />
            {t.edit}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Facts>
          <Fact label={t.status}>
            <PixelStatus pixel={pixel} />
          </Fact>
          <Fact label={t.colId}>
            <span className="inline-flex max-w-full items-center gap-1">
              <bdi dir="ltr" className="min-w-0 font-mono text-[13px] break-all">
                {pixel.pixelId}
              </bdi>
              <CopyButton value={pixel.pixelId} label={t.copyId} iconOnly />
            </span>
          </Fact>
          {pixel.label && (
            <Fact label={t.note}>
              <span dir="auto">{pixel.label}</span>
            </Fact>
          )}
          <Fact label={t.scope}>{pixelScopeText(t, pixel.scope)}</Fact>
          <Fact label={t.colCapi}>
            <div className="flex flex-col items-end">
              <PixelServerState pixel={pixel} wide />
            </div>
          </Fact>
          {pixel.testEventCode && (
            <Fact label={t.testCodeFact}>
              <bdi dir="ltr" className="font-mono text-[13px]">
                {pixel.testEventCode}
              </bdi>
            </Fact>
          )}
        </Facts>

        {canTest && (
          <Button type="button" variant="outline" className="w-full rounded-full" disabled={testing} aria-busy={testing || undefined} onClick={onTest}>
            {testing ? (
              <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" weight="bold" aria-hidden />
            ) : (
              <IconSend className="size-4" weight="bold" aria-hidden />
            )}
            {testing ? t.testing : t.test}
          </Button>
        )}

        {pixel.capiSupported && <p className="text-[13px] leading-5 text-ink-soft">{t.capiWarning}</p>}

        <div className="border-t border-line pt-3">
          <button
            type="button"
            onClick={onDelete}
            className="-mx-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-semibold text-danger transition-[background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-[0.97] motion-reduce:transition-none"
          >
            <IconDelete className="size-4" aria-hidden />
            {t.deletePixel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
