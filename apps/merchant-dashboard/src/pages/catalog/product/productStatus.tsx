import { useCallback, useEffect, useRef, useState } from "react";
import type { Product, ProductStatus } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";
import { useCatalogLabels } from "../catalogLabels";

const STRINGS = {
  en: {
    label: "Product status",
    nowActive: "The product is active: shoppers can see it in the store.",
    nowDraft: "The product is a draft: nobody sees it in the store.",
    nowArchived: "The product is archived.",
  },
  ar: {
    label: "حالة المنتج",
    nowActive: "المنتج بقى شغّال وظاهر في المتجر.",
    nowDraft: "المنتج بقى مسودة: محدش شايفه في المتجر.",
    nowArchived: "المنتج اتأرشف.",
  },
} satisfies Messages;

export interface ProductStatusControl {
  /** What the page shows now: the saved status, or the one just chosen while it is on its way. */
  status: ProductStatus;
  /** Changes it at once, and offers Undo. */
  change: (next: ProductStatus) => void;
}

/**
 * The product's status, changed in place. It is the same PATCH the basics form
 * makes for the status field (`updateProduct` with `status`), sent alone: the
 * chip and the switch answer at once, the toast offers Undo, and a failure
 * puts the old status back and says why.
 *
 * The basics form reads the status from here, so a later "save basics" sends
 * the status the merchant sees, never one the form remembered from before.
 */
export function useProductStatus(product: Product, reload: () => Promise<void>): ProductStatusControl {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [optimistic, setOptimistic] = useState<ProductStatus | null>(null);
  const status = optimistic ?? product.status;

  // Undo is pressed seconds later, from a toast that outlives this render: it reads these, not a stale closure.
  const latest = useRef({ status, reload, t });
  useEffect(() => {
    latest.current = { status, reload, t };
  });
  const busy = useRef(false);
  const productId = product.id;

  const send = useCallback(
    async (next: ProductStatus) => {
      busy.current = true;
      setOptimistic(next);
      try {
        await apiClient.updateProduct(workspaceId, productId, { status: next });
        await latest.current.reload();
      } finally {
        busy.current = false;
        setOptimistic(null);
      }
    },
    [workspaceId, productId]
  );

  const change = useCallback(
    (next: ProductStatus) => {
      const previous = latest.current.status;
      if (busy.current || next === previous) return;
      void send(next).then(
        () => {
          const said = latest.current.t;
          const message = next === "active" ? said.nowActive : next === "draft" ? said.nowDraft : said.nowArchived;
          // A failed undo rejects: the toast then says the change is still in place.
          toast.undo(message, () => send(previous));
        },
        (err: unknown) => toast.error(errorMessage(err))
      );
    },
    [send, toast, errorMessage]
  );

  return { status, change };
}

/**
 * «شغّال / مسودة» as a segmented control, for the head of the basics group.
 * An archived product has neither segment chosen; choosing one brings it back.
 */
export function ProductStatusSwitch({ control, className }: { control: ProductStatusControl; className?: string }) {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  return (
    <Segmented<ProductStatus>
      label={t.label}
      size="sm"
      value={control.status}
      onChange={control.change}
      options={[
        { value: "active", label: labels.status("active") },
        { value: "draft", label: labels.status("draft") },
      ]}
      className={className}
    />
  );
}
