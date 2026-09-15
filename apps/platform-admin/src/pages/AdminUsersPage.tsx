import { NotConnected } from "@/components/NotConnected";

export function AdminUsersPage() {
  return (
    <NotConnected
      title="Admin users"
      description="Who can sign in to this console."
      summary="Access is currently the single users.platform_admin flag, set directly on the user record. There is no endpoint to list admins, invite one, or assign the finer-grained roles this screen was designed around."
      endpoints={[
        "GET /admin/users",
        "POST /admin/users/invitations",
        "PATCH /admin/users/:id",
        "POST /admin/users/:id/resend-invitation",
      ]}
    />
  );
}
