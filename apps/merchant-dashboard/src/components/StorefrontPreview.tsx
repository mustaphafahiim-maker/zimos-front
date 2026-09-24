import { useCallback, useEffect, useId, useRef, useState, type DragEvent } from "react";
import { Monitor, RefreshCw, Smartphone, Tablet, X } from "lucide-react";
import { Button, Spinner, cn } from "@store-builder/ui";
import type { PageTree } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import {
  nearestGapIndex,
  originOf,
  readFrameMessage,
  type DragStateMessage,
  type EditorStateMessage,
  type PreviewTheme,
  type ScrollToSectionMessage,
  type SectionRect,
} from "@/lib/previewBridge";

export interface PreviewLabels {
  title: string;
  hint: string;
  refresh: string;
  desktop: string;
  mobile: string;
  close: string;
  frameTitle: string;
  /** Adds a tablet-width button to the device switch when given. */
  tablet?: string;
}

/**
 * What turns the preview into the website editor's canvas. Without it the
 * preview is exactly the read-only view it always was.
 *
 * With it, the storefront outlines every section, reports clicks and "add a
 * section here" presses back (see lib/previewBridge.ts for the messages), and
 * lays `theme` — the editor's unsaved store look — over the saved one.
 */
export interface PreviewCanvas {
  selectedId: string | null;
  /** Section id → the name shown on its outline. */
  labels: Record<string, string>;
  strings: { addAbove: string; addBelow: string; moveUp: string; moveDown: string };
  theme?: PreviewTheme | null;
  /** Scrolls the frame to a section; a new `nonce` asks again for the same one. */
  scrollRequest?: { sectionId: string; nonce: number } | null;
  onSelect: (sectionId: string) => void;
  onInsert: (index: number) => void;
  /** The outline's own up/down buttons (PreviewBridge.tsx), reordering without the layer list. */
  onMoveSection?: (sectionId: string, direction: "up" | "down") => void;
  /**
   * A block from the library is being dragged over the editor — true from
   * `dragstart` on a BlockLibrary card to whichever of `dragend`/`onDrop`
   * fires first. While it is, a transparent overlay goes up over the iframe
   * (see below) so this drag — native HTML5 DnD, started same-origin in the
   * dashboard — can be tracked over a frame the dashboard can't see into.
   */
  dragActive?: boolean;
  /** Called with the computed insert index once a drag ends in a drop on the canvas. */
  onDrop?: (index: number) => void;
}

type Device = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTH: Record<Device, string> = {
  desktop: "w-full",
  tablet: "w-[768px] max-w-full",
  mobile: "w-[390px] max-w-full",
};

const STOREFRONT_ORIGIN = originOf(STOREFRONT_URL);

/**
 * A page tree rendered by the storefront itself, unsaved edits included.
 *
 * The storefront's commerce blocks are server components that fetch the real
 * catalogue, so the preview can't be drawn here — the tree is posted (as a
 * form, targeted at the iframe) to the storefront's preview route, which
 * checks the merchant's session against the API, keeps the tree briefly and
 * redirects the frame to a page that renders it with the live components.
 *
 * Re-posts shortly after the tree stops changing. The token is minted here, so
 * every refresh reuses one preview slot instead of piling up new ones.
 *
 * Two frames take turns: each new render loads into the hidden one and is
 * swapped in once it has loaded, so an edit never blanks the page in between.
 */
export function StorefrontPreview({
  workspaceId,
  tree,
  labels,
  onClose,
  className,
  canvas,
}: {
  workspaceId: string;
  tree: PageTree;
  labels: PreviewLabels;
  /** Shows a close button when given. */
  onClose?: () => void;
  className?: string;
  canvas?: PreviewCanvas;
}) {
  const baseName = `storefront-preview-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const frameNames = [`${baseName}-a`, `${baseName}-b`] as const;
  const formRef = useRef<HTMLFormElement>(null);
  const frameA = useRef<HTMLIFrameElement>(null);
  const frameB = useRef<HTMLIFrameElement>(null);
  const firstPost = useRef(true);
  const lastSessionCheck = useRef(0);
  const [token] = useState(() => crypto.randomUUID());
  const [device, setDevice] = useState<Device>("desktop");
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState<0 | 1>(0);
  const visibleRef = useRef<0 | 1>(0);
  /** The frame a render is loading into, until it has loaded. */
  const pendingRef = useRef<0 | 1 | null>(null);

  const serialized = JSON.stringify(tree);
  const editing = canvas !== undefined;
  const themeJson = JSON.stringify(canvas?.theme ?? null);

  // The latest canvas, for the message listener and the form post, which must
  // not re-subscribe or re-post on every render.
  const canvasRef = useRef(canvas);
  const themeRef = useRef(themeJson);
  useEffect(() => {
    canvasRef.current = canvas;
    themeRef.current = themeJson;
  });

  const frames = useCallback(
    () => [frameA.current?.contentWindow ?? null, frameB.current?.contentWindow ?? null],
    []
  );

  const post = useCallback(async (treeJson: string) => {
    const form = formRef.current;
    if (!form) return;
    // The storefront verifies the session with the access token; a cheap
    // authenticated call first lets the client refresh an expired one.
    if (Date.now() - lastSessionCheck.current > 60_000) {
      try {
        await apiClient.me();
        lastSessionCheck.current = Date.now();
      } catch {
        // The preview page explains a rejected session itself.
      }
    }
    // Into the hidden frame — or the one already loading, which a newer tree
    // simply redirects.
    const target = pendingRef.current ?? (visibleRef.current === 0 ? 1 : 0);
    pendingRef.current = target;
    form.target = `${baseName}-${target === 0 ? "a" : "b"}`;
    (form.elements.namedItem("tree") as HTMLInputElement).value = treeJson;
    (form.elements.namedItem("accessToken") as HTMLInputElement).value = apiClient.tokens.accessToken ?? "";
    const theme = form.elements.namedItem("theme") as HTMLInputElement | null;
    if (theme) theme.value = themeRef.current;
    setLoading(true);
    form.submit();
  }, [baseName]);

  useEffect(() => {
    const delay = firstPost.current ? 0 : 700;
    firstPost.current = false;
    const handle = window.setTimeout(() => void post(serialized), delay);
    return () => window.clearTimeout(handle);
  }, [serialized, post]);

  function onFrameLoad(index: 0 | 1) {
    const frame = index === 0 ? frameA.current : frameB.current;
    try {
      // A frame's initial about:blank fires load too; a storefront page is
      // cross-origin, so reading its location throws instead.
      if (frame?.contentWindow?.location.href === "about:blank") return;
    } catch {
      // Cross-origin: the render arrived.
    }
    if (pendingRef.current !== index) return;
    pendingRef.current = null;
    visibleRef.current = index;
    setVisible(index);
    setLoading(false);
  }

  // Editor → frame: the selection, section names and unsaved look, re-sent
  // whenever they change (and to each render as it reports ready, below).
  const stateJson = canvas
    ? JSON.stringify({
        type: "zimos:editor-state",
        selectedId: canvas.selectedId,
        labels: canvas.labels,
        strings: canvas.strings,
        theme: canvas.theme ?? null,
      } satisfies EditorStateMessage)
    : "";
  const stateRef = useRef(stateJson);
  useEffect(() => {
    stateRef.current = stateJson;
    if (!stateJson || !STOREFRONT_ORIGIN) return;
    const message = JSON.parse(stateJson) as EditorStateMessage;
    for (const win of frames()) {
      win?.postMessage(message, STOREFRONT_ORIGIN);
    }
  }, [stateJson, frames]);

  // Editor → frame: "scroll to this section". A section that was only just
  // added isn't in the showing render yet, so the request waits for the first
  // render that reports it (see preview-ready below).
  const frameSections = useRef<[string[], string[]]>([[], []]);
  const pendingScroll = useRef<string | null>(null);

  // Frame → editor, while a drag is on: each frame's own section boxes, so a
  // pointer position over the drop overlay below can be turned into an insert
  // index. Keyed the same way frameSections is — by frame index, not by
  // "visible" — since a render that just swapped in may report its rects
  // before onFrameLoad flips `visible`.
  const sectionRectsRef = useRef<[SectionRect[], SectionRect[]]>([[], []]);

  // A block from the library is being dragged over the canvas, and which gap
  // between sections the pointer is nearest to right now — computed here from
  // the rects above, then handed back to the frame (zimos:drag-state) so its
  // own "+" indicators and drop-line agree with what a drop would actually do.
  const dragActive = canvas?.dragActive ?? false;
  const [hoverGapIndex, setHoverGapIndex] = useState<number | null>(null);
  useEffect(() => {
    if (!dragActive) setHoverGapIndex(null);
  }, [dragActive]);
  useEffect(() => {
    if (!STOREFRONT_ORIGIN) return;
    const message: DragStateMessage = { type: "zimos:drag-state", active: dragActive, hoverIndex: hoverGapIndex };
    for (const win of frames()) win?.postMessage(message, STOREFRONT_ORIGIN);
  }, [dragActive, hoverGapIndex, frames]);

  /**
   * Cross-origin drag tracking: the drag starts same-origin in the dashboard
   * (a BlockLibrary card), so the browser fires dragover/drop on this overlay
   * — a transparent div positioned exactly over the iframe, rendered only
   * while `dragActive` — rather than inside the frame's own (cross-origin,
   * unreadable) document. `clientY` minus the overlay's own top, in the same
   * units as the rects the frame measured with `getBoundingClientRect()`,
   * lands in the iframe's own viewport space with no further scaling needed:
   * this iframe is never CSS-scaled the way a template thumbnail is.
   */
  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    const y = event.clientY - event.currentTarget.getBoundingClientRect().top;
    setHoverGapIndex(nearestGapIndex(sectionRectsRef.current[visibleRef.current], y));
  }, []);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const y = event.clientY - event.currentTarget.getBoundingClientRect().top;
    const index = nearestGapIndex(sectionRectsRef.current[visibleRef.current], y);
    canvasRef.current?.onDrop?.(index);
    setHoverGapIndex(null);
  }, []);
  const scrollNonce = canvas?.scrollRequest?.nonce;
  useEffect(() => {
    const request = canvasRef.current?.scrollRequest;
    if (scrollNonce === undefined || !request || !STOREFRONT_ORIGIN) return;
    const shown = visibleRef.current;
    if (frameSections.current[shown].includes(request.sectionId)) {
      const message: ScrollToSectionMessage = { type: "zimos:scroll-to-section", sectionId: request.sectionId };
      (shown === 0 ? frameA : frameB).current?.contentWindow?.postMessage(message, STOREFRONT_ORIGIN);
      pendingScroll.current = null;
    } else {
      pendingScroll.current = request.sectionId;
    }
  }, [scrollNonce]);

  // Frame → editor. Only the storefront origin, and only our own two frames.
  useEffect(() => {
    if (!editing) return;
    function onMessage(event: MessageEvent) {
      const message = readFrameMessage(event, STOREFRONT_ORIGIN, frames());
      if (!message) return;
      const current = canvasRef.current;
      switch (message.type) {
        case "zimos:preview-ready": {
          const source = event.source as Window | null;
          if (!source || !STOREFRONT_ORIGIN) break;
          frameSections.current[source === frameA.current?.contentWindow ? 0 : 1] = message.sectionIds;
          if (stateRef.current) source.postMessage(JSON.parse(stateRef.current), STOREFRONT_ORIGIN);
          const waiting = pendingScroll.current;
          if (waiting && message.sectionIds.includes(waiting)) {
            const scroll: ScrollToSectionMessage = { type: "zimos:scroll-to-section", sectionId: waiting };
            source.postMessage(scroll, STOREFRONT_ORIGIN);
            pendingScroll.current = null;
          }
          break;
        }
        case "zimos:select-section":
          current?.onSelect(message.sectionId);
          break;
        case "zimos:insert-section":
          current?.onInsert(message.index);
          break;
        case "zimos:move-section":
          current?.onMoveSection?.(message.sectionId, message.direction);
          break;
        case "zimos:section-rects": {
          const source = event.source as Window | null;
          if (!source) break;
          sectionRectsRef.current[source === frameA.current?.contentWindow ? 0 : 1] = message.sections;
          break;
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [editing, frames]);

  const deviceButton = (value: Device, label: string, Icon: typeof Monitor) => (
    <Button
      type="button"
      size="icon"
      variant={device === value ? "secondary" : "ghost"}
      aria-label={label}
      title={label}
      aria-pressed={device === value}
      onClick={() => setDevice(value)}
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  );

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-paper-raised", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-medium text-ink">{labels.title}</h2>
          <p className="text-xs text-ink-soft">{labels.hint}</p>
        </div>
        <div className="flex items-center gap-1">
          {deviceButton("desktop", labels.desktop, Monitor)}
          {labels.tablet && deviceButton("tablet", labels.tablet, Tablet)}
          {deviceButton("mobile", labels.mobile, Smartphone)}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={labels.refresh}
            title={labels.refresh}
            onClick={() => void post(serialized)}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
          </Button>
          {onClose && (
            <Button type="button" size="icon" variant="ghost" aria-label={labels.close} onClick={onClose}>
              <X className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto bg-paper p-3">
        {loading && (
          <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex justify-center">
            <Spinner className="size-5 text-ink-soft" />
          </div>
        )}
        <div className={cn("relative mx-auto h-full min-h-[32rem] transition-[width]", DEVICE_WIDTH[device])}>
          {([0, 1] as const).map((index) => (
            <iframe
              key={index}
              ref={index === 0 ? frameA : frameB}
              name={frameNames[index]}
              title={labels.frameTitle}
              aria-hidden={visible !== index}
              tabIndex={visible === index ? undefined : -1}
              onLoad={() => onFrameLoad(index)}
              className={cn(
                "absolute inset-0 block size-full rounded-[0.5rem] border border-line bg-paper-raised",
                visible !== index && "pointer-events-none invisible"
              )}
            />
          ))}
          {/* Sits exactly over the iframe, only while a block is being dragged
              in: native drag events reach it (and never the cross-origin
              frame underneath), so it's what turns a pointer position into a
              drop. See the handlers above for why no scaling is needed. */}
          {editing && dragActive && (
            <div
              className="absolute inset-0 z-20 cursor-copy rounded-[0.5rem]"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragLeave={() => setHoverGapIndex(null)}
            />
          )}
        </div>
      </div>

      <form
        ref={formRef}
        method="post"
        action={`${STOREFRONT_URL}/store/${workspaceId}/preview`}
        target={frameNames[0]}
        className="hidden"
      >
        <input type="hidden" name="tree" />
        <input type="hidden" name="accessToken" />
        <input type="hidden" name="token" value={token} />
        {editing && (
          <>
            <input type="hidden" name="edit" value="1" />
            <input type="hidden" name="parentOrigin" value={window.location.origin} />
            <input type="hidden" name="theme" />
          </>
        )}
      </form>
    </div>
  );
}
