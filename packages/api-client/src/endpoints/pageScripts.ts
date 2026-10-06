import type { ApiClient } from "../client";

/** A website page's or a funnel step's own code (customCode/pageScripts.js). Needs website.publish. */
export type PageScriptKind = "page" | "step";

export interface PageScripts {
  /** Into <head>. */
  head: string;
  /** Before </body>. */
  body: string;
  isActive: boolean;
  updatedAt: string | null;
}

export async function pageScriptsGet(client: ApiClient, workspaceId: string, kind: PageScriptKind, id: string): Promise<PageScripts> {
  const { scripts } = await client.request<{ scripts: PageScripts }>(`/workspaces/${workspaceId}/custom-code/page-scripts/${kind}/${id}`);
  return scripts;
}

/** Live at once on the store's own domain (not in previews, never on payment pages). */
export async function pageScriptsSave(
  client: ApiClient,
  workspaceId: string,
  kind: PageScriptKind,
  id: string,
  body: { head: string; body: string; isActive: boolean }
): Promise<PageScripts> {
  const { scripts } = await client.request<{ scripts: PageScripts }>(`/workspaces/${workspaceId}/custom-code/page-scripts/${kind}/${id}`, {
    method: "PUT",
    body,
  });
  return scripts;
}
