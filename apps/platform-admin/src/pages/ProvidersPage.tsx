import { NotConnected } from "@/components/NotConnected";

export type ProviderKind = "carrier" | "payment" | "whatsapp";

const COPY: Record<
  ProviderKind,
  { title: string; description: string; summary: string; endpoints: string[] }
> = {
  carrier: {
    title: "Carriers",
    description: "Shipping companies available to merchants.",
    summary:
      "The platform-wide carrier registry is not modelled in the backend yet. Merchants configure their own shipping zones and rates from the dashboard.",
    endpoints: ["GET /admin/carriers", "PATCH /admin/carriers/:id", "POST /admin/carriers/:id/health-check"],
  },
  payment: {
    title: "Payment gateways",
    description: "Payment providers available to merchants.",
    summary:
      "The platform-wide gateway registry is not modelled in the backend yet, so there is nothing to enable, disable or health-check from here.",
    endpoints: [
      "GET /admin/payment-gateways",
      "PATCH /admin/payment-gateways/:id",
      "POST /admin/payment-gateways/:id/health-check",
    ],
  },
  whatsapp: {
    title: "WhatsApp numbers",
    description: "Sending numbers used for order confirmation.",
    summary:
      "WhatsApp sender numbers and their quality ratings are not modelled in the backend yet.",
    endpoints: [
      "GET /admin/whatsapp-numbers",
      "PATCH /admin/whatsapp-numbers/:id",
      "POST /admin/whatsapp-numbers/:id/health-check",
    ],
  },
};

export function ProvidersPage({ kind }: { kind: ProviderKind }) {
  const copy = COPY[kind];
  return (
    <NotConnected
      title={copy.title}
      description={copy.description}
      summary={copy.summary}
      endpoints={copy.endpoints}
    />
  );
}
