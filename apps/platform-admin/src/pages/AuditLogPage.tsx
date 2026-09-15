import { NotConnected } from "@/components/NotConnected";

export function AuditLogPage() {
  return (
    <NotConnected
      title="Audit log"
      description="Every administrative action, with before and after state."
      summary="The backend records audit entries (the audit_logs table and auditService are in place), but no endpoint exposes them for reading yet."
      endpoints={["GET /admin/audit-log"]}
    />
  );
}
