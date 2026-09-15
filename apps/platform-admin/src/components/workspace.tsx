import { Status } from "@/components/StatusBadge";
import { COUNTRIES } from "@/mock/constants";
import type { AdminWorkspace } from "@/mock/types";

export function WorkspaceStatus({ ws }: { ws: AdminWorkspace }) {
  return ws.meta.suspended ? <Status value="suspended" /> : <Status value={ws.meta.subscriptionStatus} />;
}

export function countryName(code: string): string {
  return COUNTRIES[code] ?? code;
}
