"use client";

import { useImperativeHandle, useMemo, type Ref } from "react";
import type { ApiClient } from "@store-builder/api-client";
import type { OrderFormValues } from "@/lib/orderForm";
import { useCheckoutAutosave, type AutosaveLine } from "@/lib/useCheckoutAutosave";
import { useDraft, type OrderFormDrafts } from "./formDrafts";

export interface AutosaveHandle {
  /** Before the order is sent: stops saving and gives the session id to send with it. */
  stop: () => Promise<string | undefined>;
  /** After a failed order: saving goes on. */
  resume: () => void;
}

/**
 * The abandoned-checkout autosave (lib/useCheckoutAutosave), run from a
 * component of its own that draws nothing.
 *
 * The autosave has to hear every keystroke of the name, the phone and the
 * email — it saves 800 ms after typing pauses. The checkout page no longer
 * redraws on a keystroke (components/checkout/formDrafts), so the hook lives
 * here, where listening to those three fields costs nothing: what is sent,
 * and when, is exactly what it was. The page reaches `stop()` / `resume()`
 * through the ref.
 */
export function CheckoutAutosave({
  ref,
  client,
  workspaceId,
  values,
  drafts,
  lines,
}: {
  ref: Ref<AutosaveHandle>;
  client: ApiClient;
  workspaceId: string;
  /** The form's values as the page holds them. */
  values: OrderFormValues;
  /** What is being typed, ahead of them. */
  drafts: OrderFormDrafts;
  lines: AutosaveLine[];
}) {
  const typedName = useDraft(drafts, "fullName");
  const typedPhone = useDraft(drafts, "phone");
  const typedEmail = useDraft(drafts, "email");
  const live = useMemo<OrderFormValues>(
    () => ({
      ...values,
      fullName: typedName ?? values.fullName,
      phone: typedPhone ?? values.phone,
      email: typedEmail ?? values.email,
    }),
    [values, typedName, typedPhone, typedEmail]
  );
  const { stop, resume } = useCheckoutAutosave({ client, workspaceId, values: live, lines });
  useImperativeHandle(ref, () => ({ stop, resume }), [stop, resume]);
  return null;
}
