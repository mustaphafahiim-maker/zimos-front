import { useState } from "react";
import { IconDownload, IconUserBlocked } from "@/components/icons";
import { Button } from "@store-builder/ui";
import { privacyCustomerErase, privacyCustomerExport, type Customer } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT } from "@/i18n/LocaleContext";
import { CustomerCard, type CustomerCardFrame } from "../detail/CardFrame";
import { useToast } from "@/components/Toast";
import { canManageCustomers } from "./crmAccess";
import { downloadJson } from "./downloadJson";
import { EraseDialog } from "./EraseDialog";
import { PRIVACY_STRINGS } from "./privacyStrings";

/**
 * Whether a customer was erased: erasing replaces the phone with "x" and part
 * of the customer's id (a real phone is digits only).
 */
export function isErasedCustomer(customer: Pick<Customer, "phoneNormalized">): boolean {
  return /^x[0-9a-f]+$/i.test(customer.phoneNormalized ?? "");
}

/**
 * The customer page's «الخصوصية» card (handoff 235): «نزّل بيانات العميل»
 * saves everything the store holds about them as a file; «امسح العميل» removes
 * their personal details for good. Both need customers.manage.
 *
 * `frame` lets the customer page draw the card as one of its folding sections;
 * left out, it is the `Section` it always was.
 */
export function CustomerPrivacyCard({ customer, onErased, frame }: { customer: Customer; onErased: () => void; frame?: CustomerCardFrame }) {
  const t = useT(PRIVACY_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [exporting, setExporting] = useState(false);
  const [erasing, setErasing] = useState(false);

  if (!canManageCustomers(currentWorkspace?.role)) return null;
  if (isErasedCustomer(customer)) {
    return (
      <CustomerCard frame={frame} title={t.cardTitle} summary={t.alreadyErased}>
        <p className="text-sm text-ink-soft">{t.alreadyErased}</p>
      </CustomerCard>
    );
  }

  async function exportData() {
    setExporting(true);
    try {
      const data = await privacyCustomerExport(apiClient, workspaceId, customer.id);
      downloadJson(data, `customer-data-${customer.phoneNormalized || customer.id.slice(0, 8)}.json`);
      toast.success(t.exported);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <CustomerCard frame={frame} title={t.cardTitle} description={t.cardHint}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11 rounded-full px-5 pointer-fine:min-h-9" disabled={exporting} onClick={() => void exportData()}>
          <IconDownload className="size-4" aria-hidden />
          {exporting ? t.exporting : t.exportData}
        </Button>
        <Button type="button" variant="danger" className="min-h-11 rounded-full px-5 pointer-fine:min-h-9" onClick={() => setErasing(true)}>
          <IconUserBlocked className="size-4" aria-hidden />
          {t.erase}
        </Button>
      </div>

      <EraseDialog
        open={erasing}
        title={t.eraseTitle}
        confirmLabel={t.eraseConfirm}
        onCancel={() => setErasing(false)}
        onErase={async (body) => {
          await privacyCustomerErase(apiClient, workspaceId, customer.id, body);
          setErasing(false);
          toast.success(t.erased);
          onErased();
        }}
      />
    </CustomerCard>
  );
}
