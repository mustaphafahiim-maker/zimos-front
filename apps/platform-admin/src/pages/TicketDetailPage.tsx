import { NotConnected } from "@/components/NotConnected";

export function TicketDetailPage() {
  return (
    <NotConnected
      title="Ticket"
      description="Conversation and status for a single support ticket."
      summary="Support ticketing is not modelled in the backend yet, so there is no ticket to open."
      endpoints={[
        "GET /admin/support/tickets/:id",
        "POST /admin/support/tickets/:id/messages",
        "PATCH /admin/support/tickets/:id",
      ]}
    />
  );
}
