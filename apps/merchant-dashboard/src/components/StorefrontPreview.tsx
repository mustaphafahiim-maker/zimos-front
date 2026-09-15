import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Monitor, RefreshCw, Smartphone, X } from "lucide-react";
import { Button, Spinner, cn } from "@store-builder/ui";
import type { PageTree } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";

export interface PreviewLabels {
  title: string;
  hint: string;
  refresh: string;
  desktop: string;
  mobile: string;
  close: string;
  frameTitle: string;
}

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
 */
export function StorefrontPreview({
  workspaceId,
  tree,
  labels,
  onClose,
  className,
}: {
  workspaceId: string;
  tree: PageTree;
  labels: PreviewLabels;
  onClose: () => void;
  className?: string;
}) {
  const frameName = `storefront-preview-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const formRef = useRef<HTMLFormElement>(null);
  const firstPost = useRef(true);
  const lastSessionCheck = useRef(0);
  const [token] = useState(() => crypto.randomUUID());
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [loading, setLoading] = useState(true);

  const serialized = JSON.stringify(tree);

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
    (form.elements.namedItem("tree") as HTMLInputElement).value = treeJson;
    (form.elements.namedItem("accessToken") as HTMLInputElement).value = apiClient.tokens.accessToken ?? "";
    setLoading(true);
    form.submit();
  }, []);

  useEffect(() => {
    const delay = firstPost.current ? 0 : 700;
    firstPost.current = false;
    const handle = window.setTimeout(() => void post(serialized), delay);
    return () => window.clearTimeout(handle);
  }, [serialized, post]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-paper-raised", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-medium text-ink">{labels.title}</h2>
          <p className="text-xs text-ink-soft">{labels.hint}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant={device === "desktop" ? "secondary" : "ghost"}
            aria-label={labels.desktop}
            aria-pressed={device === "desktop"}
            onClick={() => setDevice("desktop")}
          >
            <Monitor className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={device === "mobile" ? "secondary" : "ghost"}
            aria-label={labels.mobile}
            aria-pressed={device === "mobile"}
            onClick={() => setDevice("mobile")}
          >
            <Smartphone className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={labels.refresh}
            onClick={() => void post(serialized)}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
          </Button>
          <Button type="button" size="icon" variant="ghost" aria-label={labels.close} onClick={onClose}>
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto bg-paper p-3">
        {loading && (
          <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex justify-center">
            <Spinner className="size-5 text-ink-soft" />
          </div>
        )}
        <iframe
          name={frameName}
          title={labels.frameTitle}
          onLoad={() => setLoading(false)}
          className={cn(
            "mx-auto block h-full min-h-[32rem] rounded-[0.5rem] border border-line bg-paper-raised",
            device === "desktop" ? "w-full" : "w-[390px] max-w-full"
          )}
        />
      </div>

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
  );
}
