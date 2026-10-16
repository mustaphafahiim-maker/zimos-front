import type { ApiClient } from "../client";
import type { FunnelDto } from "./funnels";

/**
 * A copy of one of the store's funnels — its steps, pages and links, as a
 * new draft (funnels/funnelsService.duplicateFunnel). The wizard's "Your
 * funnels" templates.
 */
export async function funnelsDuplicate(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  body: { name?: string; subdomain?: string } = {}
): Promise<FunnelDto> {
  const { funnel } = await client.request<{ funnel: FunnelDto }>(`/workspaces/${workspaceId}/funnels/${funnelId}/duplicate`, {
    method: "POST",
    body,
  });
  return funnel;
}
