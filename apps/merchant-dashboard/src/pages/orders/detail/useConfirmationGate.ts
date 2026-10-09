import type { Order } from "@store-builder/api-client";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useNow } from "@/pages/confirmation/confirmationRoles";
import { confirmationGate } from "../components/ConfirmationPanel";

/**
 * The Confirmation card's own answer to "does this order still wait on its
 * call, and may this teammate confirm it now?" (components/ConfirmationPanel.tsx,
 * `confirmationGate`), for the order page: the hero's confirm button and the
 * section that holds the card follow exactly what the card would show. The
 * clock is re-read every 30 seconds, as in the card, for the lock countdown.
 */
export function useConfirmationGate(order: Order) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const now = useNow();
  return confirmationGate(order, { role: currentWorkspace?.role ?? "", userId: user?.id, now });
}

export type ConfirmationGate = ReturnType<typeof useConfirmationGate>;
