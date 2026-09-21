import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from "react";
import type { PageTree } from "@store-builder/api-client";
import { Spinner, cn } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import {
  ensureFreshSession,
  loadTemplateHome,
  previewQueue,
  previewTokenFor,
} from "@/lib/templatePreview";

/** Widths the storefront is laid out at before being scaled into the box. */
const DESKTOP_WIDTH = 1280;
const MOBILE_WIDTH = 390;
/** A render that hasn't loaded by then gives its slot up and shows the placeholder. */
const LOAD_TIMEOUT_MS = 25_000;

function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

type Outcome = "ready" | "failed";

/**
 * A template's home page as the storefront really renders it — same route and
 * same components as the editor's StorefrontPreview (the tree is posted as a
 * form into a named iframe; see that component for why), but read-only and
 * scaled down to fit the box.
 *
 * `variant="card"` is the gallery thumbnail: nothing is fetched or posted until
 * the card scrolls near the viewport, renders wait their turn in
 * `previewQueue` so only a couple load at once, and the frame takes no
 * pointer or keyboard input. `variant="full"` is the large preview in the
 * modal: it loads straight away, can be scrolled, and switches between a
 * desktop and a phone-width layout without re-posting.
 *
 * `fallback` (the gallery's placeholder) shows while the render loads and
 * stays if it can't be had: the template has no home tree, the fetch failed,
 * or the frame never loaded.
 *
 * Commerce blocks pull the merchant's own catalogue, so a store without
 * products shows the template's other sections only — the storefront drops
 * product blocks that have nothing to list.
 */
export function TemplateLivePreview({
  workspaceId,
  templateId,
  title,
  fallback,
  variant = "card",
  device = "desktop",
  className,
}: {
  workspaceId: string;
  templateId: string;
  /** Names the frame for screen readers (full variant only; the card's frame is decorative). */
  title: string;
  fallback: ReactNode;
  variant?: "card" | "full";
  device?: "desktop" | "mobile";
  className?: string;
}) {
  const card = variant === "card";
  const frameName = `template-preview-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const posted = useRef(false);
  const token = previewTokenFor(workspaceId, templateId);
  const { width, height } = useElementSize(rootRef);

  const [inView, setInView] = useState(!card);
  const [tree, setTree] = useState<PageTree | null>(null);
  const [granted, setGranted] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // The large preview skips the queue; a card waits for its turn.
  const slot = card ? granted : tree !== null;
  const phase = outcome ?? (slot ? "loading" : "idle");

  // Cards wake up a little before they scroll into view.
  useEffect(() => {
    if (!card) return;
    const el = rootRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => setInView(entries.some((e) => e.isIntersecting)),
      { rootMargin: "200px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [card]);

  useEffect(() => {
    if (!inView || tree || outcome === "failed") return;
    let cancelled = false;
    loadTemplateHome(templateId).then(
      (home) => {
        if (cancelled) return;
        if (home) setTree(home);
        else setOutcome("failed");
      },
      () => {
        if (!cancelled) setOutcome("failed");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [inView, tree, outcome, templateId]);

  // Wait for a render slot. A card that scrolls away before its turn leaves
  // the queue, so the ones on screen go first; once started, it finishes.
  useEffect(() => {
    if (!card || !tree || granted || !inView) return;
    const cancel = previewQueue.request((release) => {
      releaseRef.current = release;
      setGranted(true);
    });
    return () => {
      if (!releaseRef.current) cancel();
    };
  }, [tree, granted, inView, card]);

  // Never hold a slot past unmount.
  useEffect(() => () => releaseRef.current?.(), []);

  // The frame and form mount with the slot; post into them.
  useEffect(() => {
    if (!slot || !tree) return;
    let cancelled = false;
    void ensureFreshSession().then(() => {
      const form = formRef.current;
      if (cancelled || !form) return;
      (form.elements.namedItem("tree") as HTMLInputElement).value = JSON.stringify(tree);
      (form.elements.namedItem("accessToken") as HTMLInputElement).value =
        apiClient.tokens.accessToken ?? "";
      posted.current = true;
      form.submit();
    });
    const timer = window.setTimeout(() => {
      setOutcome((o) => o ?? "failed");
      releaseRef.current?.();
    }, LOAD_TIMEOUT_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slot, tree]);

  function onFrameLoad(e: SyntheticEvent<HTMLIFrameElement>) {
    // An empty iframe fires a load for its initial blank document too — some
    // browsers only after the post has gone out. The storefront's page is
    // cross-origin (reading its address throws) or at least not about:blank.
    if (!posted.current) return;
    try {
      if (e.currentTarget.contentWindow?.location.href === "about:blank") return;
    } catch {
      // Cross-origin: the storefront has answered.
    }
    setOutcome((o) => o ?? "ready");
    releaseRef.current?.();
  }

  // Lay the page out at a real viewport width, then scale it into the box.
  const layoutWidth = !card && device === "mobile" ? MOBILE_WIDTH : DESKTOP_WIDTH;
  const scale = width > 0 ? Math.min(1, width / layoutWidth) : 0.25;
  const layoutHeight = card ? (DESKTOP_WIDTH * 3) / 4 : height > 0 ? height / scale : 800;
  const showFrame = slot && phase !== "failed";

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative w-full overflow-hidden bg-paper",
        card ? "aspect-[4/3]" : "h-full",
        className
      )}
    >
      {phase !== "ready" && (
        <div className={cn("absolute inset-0", phase !== "failed" && "motion-safe:animate-pulse")}>
          {fallback}
        </div>
      )}
      {!card && phase === "loading" && (
        <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex justify-center">
          <Spinner className="size-5 text-ink-soft" />
        </div>
      )}

      {showFrame && (
        <div
          className="relative mx-auto h-full overflow-hidden"
          style={{ width: card ? "100%" : layoutWidth * scale }}
        >
          <iframe
            name={frameName}
            title={title}
            onLoad={onFrameLoad}
            tabIndex={card ? -1 : undefined}
            aria-hidden={card || undefined}
            className={cn(
              "absolute top-0 start-0 origin-top-left border-0 bg-paper-raised transition-opacity duration-200 rtl:origin-top-right",
              card && "pointer-events-none",
              phase === "ready" ? "opacity-100" : "opacity-0"
            )}
            style={{ width: layoutWidth, height: layoutHeight, transform: `scale(${scale})` }}
          />
          <form
            ref={formRef}
            method="post"
            action={`${STOREFRONT_URL}/store/${workspaceId}/preview`}
            target={frameName}
            className="hidden"
          >
            <input type="hidden" name="tree" />
            <input type="hidden" name="accessToken" />
            <input type="hidden" name="token" value={token} />
          </form>
        </div>
      )}

      {card && phase === "ready" && (
        // Ends the cropped page softly instead of mid-section.
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-paper-raised to-transparent" />
      )}
    </div>
  );
}
