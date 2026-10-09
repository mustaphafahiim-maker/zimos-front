import { useEffect, useRef, useState } from "react";
import type { ProductMedia } from "@store-builder/api-client";
import { IconVideo } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { mediaSrc } from "@/lib/media";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DropZone } from "../media/DropZone";
import { MEDIA_STRINGS } from "../media/mediaStrings";
import { SectionFrame } from "../media/SectionFrame";
import { useFileDrop } from "../media/useFileDrop";
import { FINE_POINTER_QUERY, useMediaQuery } from "../media/useMediaQuery";
import { AddVideoTile, VIDEO_ACCEPT, VideoTile } from "../media/VideoTiles";

const MAX_MB = 30;

/** A media entry that is a video (uploaded through the media library: mimeType video/*). */
export const isVideoMedia = (m: ProductMedia) => typeof (m as { mimeType?: unknown }).mimeType === "string" && String((m as { mimeType?: string }).mimeType).startsWith("video/");

/**
 * The product's video (SPEC §7.1): kept in `product.media` beside the
 * pictures, told apart by its video/* type, so the pictures section leaves it
 * alone and the storefront plays it under the gallery. Saved at once — the
 * same upload and the same PATCH of the whole media array as before; what
 * changed is the look: a tile like a photo's, with play, replace and remove.
 *
 * Its frame follows where it sits (`SectionFrame`): a card on its own, a part
 * of the «الصور والفيديو» group on the product page.
 */
export function ProductVideoSection({
  productId,
  media,
  onChanged,
  embedded = false,
}: {
  productId: string;
  media: ProductMedia[];
  onChanged: () => void;
  /** Without the card and its heading — for a caller that draws both itself. */
  embedded?: boolean;
}) {
  const t = useT(MEDIA_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const finePointer = useMediaQuery(FINE_POINTER_QUERY, false);
  const [busy, setBusy] = useState(false);
  /** The video in the player sheet; it stays set while the sheet closes, so the sheet does not empty on its way out. */
  const [playing, setPlaying] = useState<ProductMedia | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  /** Which video the next chosen file replaces. */
  const replaceIndex = useRef<number | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  const videos = media.filter(isVideoMedia);

  // «تراجع» is pressed seconds later: it writes over the photos as they are then, not as they were.
  const latest = useRef({ media, onChanged, errorMessage });
  useEffect(() => {
    latest.current = { media, onChanged, errorMessage };
  });

  /** The one write this section makes: the whole media array, pictures first. */
  async function write(nextVideos: ProductMedia[]) {
    const pictures = latest.current.media.filter((m) => !isVideoMedia(m));
    await apiClient.updateProduct(workspaceId, productId, { media: [...pictures, ...nextVideos] });
    latest.current.onChanged();
  }

  function check(file: File): boolean {
    if (!VIDEO_ACCEPT.split(",").includes(file.type)) {
      toast.error(t.videoWrongType);
      return false;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(fmt(t.videoTooBig, { mb: MAX_MB }));
      return false;
    }
    return true;
  }

  /** Upload, then save: at the end of the list, or in the place of the video being replaced. */
  async function upload(file: File, replacing: number | null) {
    if (busy || !check(file)) return;
    setBusy(true);
    try {
      const uploaded: ProductMedia = await apiClient.uploadMedia(workspaceId, file);
      if (replacing !== null && replacing < videos.length) {
        await write(videos.map((video, i) => (i === replacing ? uploaded : video)));
        toast.success(t.videoReplaced);
      } else {
        await write([...videos, uploaded]);
        toast.success(t.videoSaved);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(index: number) {
    if (busy) return;
    const before = videos;
    setBusy(true);
    try {
      await write(before.filter((_, i) => i !== index));
      // Only the product's list changed (the file is still in the media library), so it can be put back.
      toast.undo(t.videoRemoved, () => write(before));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const drop = useFileDrop((files) => {
    const file = files[0];
    if (file) void upload(file, null);
  }, busy);

  return (
    <SectionFrame title={t.videoTitle} description={fmt(t.videoHelp, { mb: MAX_MB })} embedded={embedded}>
      <DropZone drop={drop} label={t.videoDropHere} icon={IconVideo} slot="product-video">
        <ul data-slot="video-grid" className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 xl:grid-cols-6">
          {videos.map((video, index) => (
            <VideoTile
              key={video.url}
              video={video}
              index={index}
              busy={busy}
              finePointer={finePointer}
              onPlay={() => {
                setPlaying(video);
                setPlayerOpen(true);
              }}
              onReplace={() => {
                replaceIndex.current = index;
                replaceInput.current?.click();
              }}
              onRemove={() => void remove(index)}
            />
          ))}
          <AddVideoTile busy={busy} onFile={(file) => void upload(file, null)} />
        </ul>

        {/* «بدّل الفيديو» in a tile's menu opens this picker; the chosen file takes that video's place. */}
        <input
          ref={replaceInput}
          type="file"
          accept={VIDEO_ACCEPT}
          tabIndex={-1}
          aria-hidden
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            const index = replaceIndex.current;
            event.target.value = "";
            replaceIndex.current = null;
            if (file) void upload(file, index);
          }}
        />
      </DropZone>

      <Sheet open={playerOpen} onOpenChange={setPlayerOpen} title={t.videoPlayer} size="md">
        {playing && (
          <video
            key={playing.url}
            src={mediaSrc(playing)}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="aspect-video w-full rounded-[1rem] bg-black"
          />
        )}
      </Sheet>
    </SectionFrame>
  );
}
