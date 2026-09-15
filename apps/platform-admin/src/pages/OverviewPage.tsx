import { NotConnected } from "@/components/NotConnected";

export function OverviewPage() {
  return (
    <NotConnected
      title="Overview"
      description="Platform health at a glance."
      summary="Platform KPIs, trend series and the needs-attention queue have no endpoint yet. Workspaces, Subscriptions, Plans, Feature flags and Announcements are live in the meantime."
      endpoints={["GET /admin/metrics/overview", "GET /admin/alerts"]}
    />
  );
}
