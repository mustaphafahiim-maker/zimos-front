"use client";

import type { StorefrontMeta } from "@store-builder/api-client";
import { useMemo } from "react";
import { useXsTokensSource } from "@/lib/StoreShellContext";
import { readXsTokens, xsTokenCss, xsTokenLooks } from "@/lib/xsTokens";
import { XsLookStyles } from "./XsLookStyles";

/**
 * The store's Template look (lib/xsTokens.ts) over its template's: the faces it
 * chose — with the stylesheet of a look that carries them — its corners, the
 * size of its words and its spacing. In the editor's preview it follows the
 * unsaved choices (the shell override), so a change shows without a reload.
 */
export function XsTokenStyles({ store, look }: { store: StorefrontMeta; look: string }) {
  const source = useXsTokensSource(store);
  const tokens = useMemo(() => readXsTokens(source), [source]);
  const css = useMemo(() => xsTokenCss(tokens, look), [tokens, look]);
  const looks = xsTokenLooks(tokens).filter((other) => other !== look);
  if (!css) return null;
  return (
    <>
      {looks.length > 0 && <XsLookStyles looks={looks} />}
      <style data-xs-tokens="" dangerouslySetInnerHTML={{ __html: css }} />
    </>
  );
}
