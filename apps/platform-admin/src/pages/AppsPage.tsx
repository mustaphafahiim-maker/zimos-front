import { NotConnected } from "@/components/NotConnected";

export function AppsPage() {
  return (
    <NotConnected
      title="Marketplace apps"
      description="Integrations merchants can install."
      summary="The app marketplace is not modelled in the backend yet — there is no table behind this screen."
      endpoints={["GET /admin/apps", "POST /admin/apps", "PATCH /admin/apps/:id", "DELETE /admin/apps/:id"]}
    />
  );
}
