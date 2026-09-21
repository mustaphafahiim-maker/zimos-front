import { NextResponse, type NextRequest } from "next/server";
import type { PageTree } from "@store-builder/api-client";
import { readPreviewTheme, type PreviewTheme } from "@/lib/brandTheme";
import { previewOwner, putPreview, type PreviewOptions } from "@/lib/previewStore";

/**
 * Receives a draft page tree from the dashboard's live preview (a form post
 * targeted at an iframe), keeps it briefly and redirects the frame to the page
 * that renders it with the real storefront components.
 *
 * Only staff get to put content on a store's domain this way: the posted
 * access token must be accepted by the API for this workspace, where listing
 * websites needs WEBSITE_EDIT and listing funnels FUNNELS_MANAGE. The token is
 * used for that one check and never stored.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Trees are a few KB; the backend caps them at 10 000 nodes.
const MAX_TREE_CHARS = 1_000_000;
// Same ~5KB ceiling the API puts on a saved themeSettings blob.
const MAX_THEME_CHARS = 5_000;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/** A bare notice shown inside the preview frame. The storefront speaks Arabic, the dashboard may not. */
function notice(status: number, arabic: string, english: string) {
  const body = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Preview</title></head><body style="margin:0;padding:3rem 1.5rem;font-family:system-ui,sans-serif;text-align:center;color:#3c4a46"><p>${escapeHtml(arabic)}</p><p dir="ltr" style="font-size:.875rem">${escapeHtml(english)}</p></body></html>`;
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** An exact `scheme://host[:port]` origin, or null. */
function readOrigin(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin === value ? value : null;
  } catch {
    return null;
  }
}

/**
 * The website editor's extras (see PreviewOptions). All optional — a post
 * without them is a plain preview, exactly as before. A malformed theme is
 * dropped rather than refused: the page still previews, in the saved look.
 */
function readOptions(form: FormData): PreviewOptions | undefined {
  const editable = form.get("edit") === "1";
  const parentOrigin = readOrigin(form.get("parentOrigin"));
  const rawTheme = String(form.get("theme") ?? "");
  let theme: PreviewTheme | null = null;
  if (rawTheme && rawTheme.length <= MAX_THEME_CHARS) {
    try {
      theme = readPreviewTheme(JSON.parse(rawTheme));
    } catch {
      theme = null;
    }
  }
  if (!editable && !parentOrigin && !theme) return undefined;
  return { editable: editable && parentOrigin !== null, parentOrigin, theme };
}

async function canEditWorkspace(workspaceId: string, accessToken: string): Promise<boolean> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  for (const resource of ["websites", "funnels"]) {
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/${resource}`, {
      headers,
      cache: "no-store",
    });
    if (res.ok) return true;
    // An invalid or expired session fails the same way for both.
    if (res.status === 401) return false;
  }
  return false;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const invalid = () => notice(400, "طلب معاينة غير صالح.", "Invalid preview request.");
  if (!UUID_RE.test(workspaceId)) return invalid();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return invalid();
  }
  const token = String(form.get("token") ?? "");
  const accessToken = String(form.get("accessToken") ?? "");
  const rawTree = String(form.get("tree") ?? "");
  if (!UUID_RE.test(token) || !accessToken || !rawTree) return invalid();
  if (rawTree.length > MAX_TREE_CHARS) {
    return notice(413, "الصفحة أكبر من إنها تتعرض في المعاينة.", "This page is too large to preview.");
  }

  let tree: PageTree;
  try {
    const parsed: unknown = JSON.parse(rawTree);
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as PageTree).sections)) {
      return invalid();
    }
    tree = parsed as PageTree;
  } catch {
    return invalid();
  }

  const owner = previewOwner(token);
  if (owner && owner !== workspaceId) return invalid();

  if (!(await canEditWorkspace(workspaceId, accessToken))) {
    return notice(
      403,
      "مقدرناش نتأكد من الجلسة. حدّث المعاينة من لوحة التحكم.",
      "Your session couldn't be verified. Refresh the preview from the dashboard."
    );
  }

  putPreview(token, workspaceId, tree, readOptions(form));
  // 303 so the frame follows with a GET, whatever method brought it here.
  return NextResponse.redirect(new URL(`/store/${workspaceId}/preview/${token}`, request.url), 303);
}
