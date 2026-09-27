import { useState } from "react";
import { Button } from "@store-builder/ui";
import type { Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, formatOptions } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Section } from "@/components/Section";
import { DataTable, type Column } from "@/components/DataTable";
import { VariantForm } from "./VariantForm";

interface Props {
  productId: string;
  variants: Variant[];
  onChanged: () => void;
}

export function VariantsSection({ productId, variants, onChanged }: Props) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Variant | null>(null);
  const [deleting, setDeleting] = useState<Variant | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    await apiClient.deleteVariant(workspaceId, deleting.id);
    toast.success("Variant archived.");
    setDeleting(null);
    onChanged();
  }

  const columns: ReadonlyArray<Column<Variant>> = [
    {
      key: "variant",
      header: "Variant",
      className: "text-ink",
      cell: (v) => formatOptions(v.optionValues) || <span className="text-ink-soft">—</span>,
    },
    { key: "sku", header: "SKU", className: "text-ink-soft", cell: (v) => v.sku || "—" },
    {
      key: "price",
      header: "Price",
      className: "text-ink-soft",
      cell: (v) => formatMoney(v.priceAmount, v.currency),
    },
    {
      key: "stock",
      header: "Stock",
      className: "text-ink-soft",
      cell: (v) => `${v.stockOnHand}${v.reservedStock ? ` (−${v.reservedStock})` : ""}`,
    },
    { key: "status", header: "Status", cell: (v) => <StatusBadge value={v.status} /> },
    {
      key: "actions",
      header: "",
      align: "end",
      className: "whitespace-nowrap",
      cell: (v) => (
        <>
          <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger hover:bg-danger-soft"
            onClick={() => setDeleting(v)}
          >
            Delete
          </Button>
        </>
      ),
    },
  ];

  return (
    <>
      <Section
        title="Variants"
        description="Each buyable row — size / colour, its price and stock."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            Add variant
          </Button>
        }
      >
        <DataTable
          columns={columns}
          rows={variants}
          rowKey={(v) => v.id}
          minWidth="35rem"
          empty={
            <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
              No variants yet. Add at least one so the product can be sold.
            </p>
          }
        />
      </Section>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add variant">
        <VariantForm
          productId={productId}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            toast.success("Variant added.");
            onChanged();
          }}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit variant">
        {editing && (
          <VariantForm
            productId={productId}
            variant={editing}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null);
              toast.success("Variant saved.");
              onChanged();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this variant?"
        description="It's archived, not removed, so order lines and inventory history that reference it stay intact."
        confirmLabel="Archive variant"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
