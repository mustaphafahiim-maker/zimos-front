import { NotConnected } from "@/components/NotConnected";

export function SystemHealthPage() {
  return (
    <NotConnected
      title="System health"
      description="Status of the services the platform depends on."
      summary="There is no per-service status endpoint yet. The API's own liveness probe is served at /health on the backend root."
      endpoints={["GET /admin/system/services", "POST /admin/system/services/check"]}
    />
  );
}
