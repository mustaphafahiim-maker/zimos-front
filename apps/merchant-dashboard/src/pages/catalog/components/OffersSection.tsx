import { useState } from "react";
import { Button } from "@store-builder/ui";
import type { Offer, Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, variantLabel } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Section } from "@/components/Section";
import { OfferForm } from "./OfferForm";

interface Props {
  productId: string;
  offers: Offer[];
  variants: Variant[];
  onChanged: () => void;
}

export function OffersSection({ productId, offers, variants, onChanged }: Props) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [deleting, setDeleting] = useState<Offer | null>(null);

  const variantName = (id: string) => {
    const v = variants.find((x) => x.id === id);
    return v ? variantLabel(v) : `Variant ${id.slice(0, 8)}`;
  };

  async function confirmDelete() {
    if (!deleting) return;
    await apiClient.deleteOffer(workspaceId, deleting.id);
    toast.success("Offer archived.");
    setDeleting(null);
    onChanged();
  }

  return (
    <>
      <Section
        title="Offers"
        description="Priced bundles of one or more variants."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            Create offer
          </Button>
        }
      >
        {offers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
            No offers yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {offers.map((offer) => (
              <li
                key={offer.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{offer.name}</span>
                    {offer.isDefault && <StatusBadge value="default" tone="info" />}
                    <StatusBadge value={offer.status} />
                  </div>
                  <div className="mt-1 text-sm text-ink-soft">
                    {offer.pricingMode === "fixed"
                      ? formatMoney(offer.priceAmount, offer.currency)
                      : "Computed price"}
                    {" · "}
                    {offer.lines.map((l) => `${l.quantity}× ${variantName(l.variantId)}`).join(", ")}
                  </div>
                </div>
                <div className="whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(offer)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger-soft"
                    onClick={() => setDeleting(offer)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Modal open={adding} onClose={() => setAdding(false)} title="Create offer">
        <OfferForm
          productId={productId}
          variants={variants}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            toast.success("Offer created.");
            onChanged();
          }}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit offer">
        {editing && (
          <OfferForm
            productId={productId}
            variants={variants}
            offer={editing}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null);
              toast.success("Offer saved.");
              onChanged();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete "${deleting?.name ?? ""}"?`}
        description="It's archived, not removed, so any order placed through this offer keeps its record."
        confirmLabel="Archive offer"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
