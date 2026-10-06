/** The custom HTML blocks a page or step carries for the live store (backend customCode/htmlBlocks.js). */
export type HtmlBlocksData = Record<string, string>;

/** Reads `htmlBlocks` off a page or step answer that carries it (server or client). */
export function htmlBlocksOf(holder: unknown): HtmlBlocksData {
  const blocks = (holder as { htmlBlocks?: unknown } | null)?.htmlBlocks;
  return blocks && typeof blocks === "object" ? (blocks as HtmlBlocksData) : {};
}
