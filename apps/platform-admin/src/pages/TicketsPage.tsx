import { NotConnected } from "@/components/NotConnected";

export function TicketsPage() {
  return (
    <NotConnected
      title="Support tickets"
      description="Merchant requests waiting on the platform team."
      summary="Support ticketing is not modelled in the backend yet — there is no ticket table, queue or reply thread to read."
      endpoints={[
        "GET /admin/support/tickets",
        "GET /admin/support/tickets/:id",
        "POST /admin/support/tickets/:id/messages",
        "PATCH /admin/support/tickets/:id",
      ]}
    />
  );
}
