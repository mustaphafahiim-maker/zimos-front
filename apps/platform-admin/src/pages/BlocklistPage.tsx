import { NotConnected } from "@/components/NotConnected";

export function BlocklistPage() {
  return (
    <NotConnected
      title="Blocklist"
      description="Identifiers blocked from checking out across the platform."
      summary="The platform-wide blocklist is not modelled in the backend yet. Blocking a customer is available per workspace from the merchant dashboard."
      endpoints={[
        "GET /admin/risk/blocklist",
        "POST /admin/risk/blocklist",
        "PATCH /admin/risk/blocklist/:id",
        "DELETE /admin/risk/blocklist/:id",
      ]}
    />
  );
}
