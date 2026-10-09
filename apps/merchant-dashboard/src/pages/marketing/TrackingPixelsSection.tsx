import { useState, type ReactNode } from "react";
import { Button } from "@store-builder/ui";
import {
  trackingPixelsDelete,
  trackingPixelsList,
  trackingPixelsSendTest,
  trackingPixelsUpdate,
  type TrackingPixelDto,
  type TrackingPixelList,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconCopy, IconDelete, IconEdit, IconLive, IconPause, IconPlay, IconPlus, IconSend } from "@/components/icons";
import { ListSkeleton } from "@/components/list";
import { useToast } from "@/components/Toast";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { DeskList } from "@/pages/returns/rowkit/DeskList";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { GtmContainerCard } from "./GtmContainerCard";
import { BlockTitle } from "./kit/Facts";
import { PixelFormSheet } from "./PixelFormSheet";
import { PixelPeekSheet } from "./PixelPeekSheet";
import { PIXEL_COLUMNS, PixelRow } from "./PixelRow";
import { AD_PLATFORM_PIXEL_STRINGS } from "./adPlatformPixelStrings";
import { pixelPlatformName } from "./pixelPlatforms";
import { PIXEL_STRINGS } from "./pixelStrings";

const EMPTY_LIST: TrackingPixelList = { pixels: [], platforms: [], limit: 0 };

export interface TrackingPixels {
  /** «ضيف بيكسل»: the page's one creation action, for its header. */
  addAction: ReactNode;
  /** The pixels as a list: cards on a phone, a sheet of rows from a wide screen. */
  list: ReactNode;
  /** The ready-made container card, once the store has a Google Tag Manager pixel (handoff 170); null otherwise. */
  gtm: ReactNode;
  /** The preview, the form and the delete question. Render once, anywhere. */
  sheets: ReactNode;
}

/**
 * Marketing → Tracking tools: the store's pixels and tags, as the parts the
 * page lays out — the add button for its header, the list, the sheets.
 *
 * A row is one pixel; its ONE action pauses it or runs it again, at once, with
 * Undo. A press on the row opens its preview, where the test event, edit and
 * delete are. Nothing about what is saved changed.
 */
export function useTrackingPixels({ onEventsChanged }: { onEventsChanged?: () => void } = {}): TrackingPixels {
  const t = useT(PIXEL_STRINGS);
  const more = useT(AD_PLATFORM_PIXEL_STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const compact = useIsCompact();
  const copy = useCopy();
  const { data, error, loading, refresh, setData } = useAsync(() => trackingPixelsList(apiClient, workspaceId), [workspaceId]);
  const [editing, setEditing] = useState<TrackingPixelDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<TrackingPixelDto | null>(null);
  // The pixel being looked at. It stays here while its sheet closes, so the sheet does not empty on its way out.
  const [peek, setPeek] = useState<{ id: string; open: boolean } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const pixels = data?.pixels ?? [];
  const atLimit = Boolean(data && data.pixels.length >= data.limit);
  // A Google Tag Manager pixel gets the ready-made container card (handoff 170).
  const hasGtm = pixels.some((p) => p.platform === "gtm");
  const peeked = peek ? (pixels.find((p) => p.id === peek.id) ?? null) : null;

  const patchPixel = (id: string, patch: Partial<TrackingPixelDto>) =>
    setData((prev) => {
      const current = prev ?? EMPTY_LIST;
      return { ...current, pixels: current.pixels.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
    });

  /** Two sheets are never stacked: the preview steps aside for the form and for the delete question. */
  const closePeek = () => setPeek((current) => (current ? { ...current, open: false } : current));

  function startAdd() {
    // The limit is said in words instead of a button that silently does nothing.
    if (atLimit) toast.error(more.pixelLimit);
    else setEditing("new");
  }

  /** Pauses or runs a pixel: the row answers at once, the request follows, and the toast can take it back. */
  async function setActive(pixel: TrackingPixelDto, isActive: boolean, undoable = true): Promise<void> {
    const name = pixelPlatformName(pixel.platform);
    patchPixel(pixel.id, { isActive });
    try {
      await trackingPixelsUpdate(apiClient, workspaceId, pixel.id, { isActive });
      const message = fmt(isActive ? t.resumedToast : t.pausedToast, { name });
      if (undoable) toast.undo(message, () => setActive(pixel, !isActive, false));
      else toast.success(message);
      void refresh({ silent: true });
    } catch (err) {
      patchPixel(pixel.id, { isActive: !isActive });
      toast.error(errorMessage(err));
    }
  }

  async function sendTest(pixel: TrackingPixelDto) {
    const name = pixelPlatformName(pixel.platform);
    setTesting(pixel.id);
    try {
      const result = await trackingPixelsSendTest(apiClient, workspaceId, pixel.id);
      // X has no test event (handoff 255): nothing was sent, and nothing failed.
      if (result.skipped) toast.success(more.testSkipped);
      else if (result.ok) toast.success(fmt(result.usedTestCode ? t.testOkCode : t.testOk, { name }));
      else toast.error(fmt(t.testFailed, { name, error: result.error ?? "" }));
      await refresh({ silent: true });
      onEventsChanged?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTesting(null);
    }
  }

  function menuFor(pixel: TrackingPixelDto): ContextMenuItem[] {
    const items: ContextMenuItem[] = [{ id: "edit", label: t.edit, icon: IconEdit, onSelect: () => setEditing(pixel) }];
    if (pixel.capiEnabled && pixel.capiSupported) {
      items.push({ id: "test", label: t.test, icon: IconSend, disabled: testing === pixel.id, onSelect: () => void sendTest(pixel) });
    }
    items.push({
      id: "toggle",
      label: pixel.isActive ? t.pause : t.resume,
      icon: pixel.isActive ? IconPause : IconPlay,
      onSelect: () => void setActive(pixel, !pixel.isActive),
    });
    items.push({ id: "copy", label: t.copyId, icon: IconCopy, separatorBefore: true, onSelect: () => copy(pixel.pixelId, t.copiedId) });
    items.push({ id: "delete", label: t.delete, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setDeleting(pixel) });
    return items;
  }

  const addAction = (
    <Button type="button" className="min-h-11 rounded-full px-5" onClick={startAdd} disabled={!data}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.add}
    </Button>
  );

  const rows = pixels.map((pixel) => (
    <PixelRow
      key={pixel.id}
      pixel={pixel}
      compact={compact}
      current={peek?.open === true && peek.id === pixel.id}
      menu={menuFor(pixel)}
      onPeek={() => setPeek({ id: pixel.id, open: true })}
      onToggle={() => void setActive(pixel, !pixel.isActive)}
    />
  ));

  const list = (
    <section aria-label={t.listTitle} className="flex min-w-0 flex-col gap-3">
      {pixels.length > 0 && <BlockTitle count={pixels.length}>{t.listTitle}</BlockTitle>}
      <DataState
        loading={loading}
        // A refresh that failed behind rows already on screen leaves them there.
        error={pixels.length === 0 ? error : null}
        onRetry={() => void refresh()}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={3} />}
      >
        {pixels.length === 0 ? (
          <EmptyState
            icon={<IconLive aria-hidden />}
            title={t.emptyTitle}
            description={t.emptyBody}
            action={
              <Button type="button" className="rounded-full px-5" onClick={startAdd}>
                <IconPlus className="size-4" weight="bold" aria-hidden />
                {t.add}
              </Button>
            }
          />
        ) : compact ? (
          <ul aria-label={t.listTitle} className="flex flex-col gap-2.5">
            {rows}
          </ul>
        ) : (
          <DeskList
            columns={PIXEL_COLUMNS}
            label={t.listTitle}
            head={[{ label: t.colPlatform }, { label: t.colId }, { label: t.colCapi }, { label: t.colStatus }, { label: t.colAction, end: true }]}
          >
            {rows}
          </DeskList>
        )}
      </DataState>
      {/* What the store sends by itself, said once under the list. */}
      {pixels.length > 0 && <p className="px-1 text-[13px] leading-5 text-ink-soft">{t.eventsNote}</p>}
    </section>
  );

  const gtm = data && hasGtm ? <GtmContainerCard pixels={data.pixels} /> : null;

  const sheets = (
    <>
      <PixelPeekSheet
        pixel={peeked}
        open={Boolean(peek?.open) && peeked !== null}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
        testing={peeked !== null && testing === peeked.id}
        onEdit={() => {
          if (!peeked) return;
          closePeek();
          setEditing(peeked);
        }}
        onToggle={() => {
          if (peeked) void setActive(peeked, !peeked.isActive);
        }}
        onTest={() => {
          if (peeked) void sendTest(peeked);
        }}
        onDelete={() => {
          if (!peeked) return;
          closePeek();
          setDeleting(peeked);
        }}
      />

      {editing && data && (
        <PixelFormSheet
          key={editing === "new" ? "new" : editing.id}
          pixel={editing === "new" ? null : editing}
          platforms={data.platforms}
          onClose={() => setEditing(null)}
          onSaved={async (created) => {
            setEditing(null);
            toast.success(created ? t.created : t.updated);
            await refresh({ silent: true });
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t.deleteTitle}
        description={deleting ? fmt(t.deleteBody, { name: pixelPlatformName(deleting.platform), id: deleting.pixelId }) : undefined}
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        busyLabel={t.deleting}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await trackingPixelsDelete(apiClient, workspaceId, deleting.id);
          setDeleting(null);
          toast.success(t.deleted);
          await refresh({ silent: true });
        }}
      />
    </>
  );

  return { addAction, list, gtm, sheets };
}
