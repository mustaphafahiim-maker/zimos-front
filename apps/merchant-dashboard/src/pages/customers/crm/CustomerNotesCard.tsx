import { customerNotesGet } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { CustomerCard } from "../detail/CardFrame";
import { CustomerNotesPanel } from "./CustomerNotesPanel";

const STRINGS = {
  en: { title: "Notes and follow-ups", description: "What the team wrote about this customer, and who gets back to them and when." },
  ar: { title: "الملاحظات والمتابعات", description: "اللي الفريق كتبه عن العميل ده، ومين هيرجعله وإمتى." },
} satisfies Messages;

/**
 * The customer page's notes and follow-ups card (CUSTOMER_NOTES_ENABLED): it
 * loads the customer's notes itself and hands them to the panel.
 */
export function CustomerNotesCard({ customerId }: { customerId: string }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const notes = useAsync(() => customerNotesGet(apiClient, workspaceId, customerId), [workspaceId, customerId]);
  return (
    <CustomerCard title={t.title} description={t.description}>
      <CustomerNotesPanel customerId={customerId} state={notes} />
    </CustomerCard>
  );
}
