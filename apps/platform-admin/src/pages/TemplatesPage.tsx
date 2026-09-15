import { NotConnected } from "@/components/NotConnected";

export function TemplatesPage() {
  return (
    <NotConnected
      title="Templates"
      description="Store, funnel and landing page templates."
      summary="The catalogue is readable by merchants over GET /templates, but there is no admin surface yet for creating, editing, publishing or versioning a template."
      endpoints={[
        "GET /admin/templates",
        "POST /admin/templates",
        "PATCH /admin/templates/:id",
        "POST /admin/templates/:id/publish",
        "POST /admin/templates/:id/versions",
        "DELETE /admin/templates/:id",
      ]}
    />
  );
}
