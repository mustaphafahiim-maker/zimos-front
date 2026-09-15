import { NotConnected } from "@/components/NotConnected";

export function SuppliersPage() {
  return (
    <NotConnected
      title="Suppliers"
      description="Fulfilment partners applying to the network."
      summary="Suppliers are not modelled in the backend yet — there is no table, and no approval queue to read."
      endpoints={["GET /admin/suppliers", "POST /admin/suppliers/:id/approve", "POST /admin/suppliers/:id/reject"]}
    />
  );
}
