import { useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import { ApiError, emailSuppressionsLift, emailSuppressionsList, type EmailSuppression } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { formatDate } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { canManageCustomers } from "../crm/crmAccess";
import { SUPPRESSION_STRINGS } from "./suppressionStrings";

/**
 * Customer page → under the header: when the customer's address
 * is on the store's suppression list, a banner says no email reaches them and
 * why, with «السماح بالإرسال تاني» for a role that may manage customers. No
 * address, a masked one, or nothing on the list: no banner. A failed read is
 * silent — the page is about the customer, not about this check.
 */
export function CustomerSuppressionBanner({ email }: { email: string | null | undefined }) {
  const t = useT(SUPPRESSION_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const manager = canManageCustomers(currentWorkspace?.role);
  const toast = useToast();
  // An address shown masked to this role («m***@example.com») is not one the list can be asked about.
  const address = email && /^[^\s@*]+@[^\s@*]+$/.test(email.trim()) ? email.trim() : null;
  const found = useAsync<{ row: EmailSuppression | null }>(async () => {
    if (!address) return { row: null };
    const page = await emailSuppressionsList(apiClient, workspaceId, { email: address, limit: 1 }).catch(() => null);
    return { row: page?.suppressions[0] ?? null };
  }, [workspaceId, address]);
  const [asking, setAsking] = useState(false);

  const row = found.data?.row;
  if (!row) return null;

  const text = row.reason === "hard_bounce" ? t.bannerBounce : row.reason === "complaint" ? t.bannerComplaint : t.bannerOther;

  return (
    <>
      <Alert variant="danger" className="mt-3" data-suppression-banner={row.reason}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="font-medium">{text}</p>
            <p className="mt-0.5 text-[13px]">
              <bdi dir="ltr">{row.email}</bdi>
              {" · "}
              {fmt(t.since, { date: formatDate(row.createdAt) })}
            </p>
          </div>
          {manager && (
            <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0 md:min-h-9" onClick={() => setAsking(true)}>
              {t.allow}
            </Button>
          )}
        </div>
      </Alert>

      <ConfirmDialog
        open={asking}
        title={fmt(t.confirmTitle, { email: row.email })}
        description={t.confirmBody}
        confirmLabel={t.confirm}
        onCancel={() => setAsking(false)}
        onConfirm={async () => {
          try {
            await emailSuppressionsLift(apiClient, workspaceId, row.id);
            toast.success(fmt(t.lifted, { email: row.email }));
          } catch (err) {
            if (!(err instanceof ApiError && err.status === 404)) throw err;
            toast.success(t.gone);
          }
          setAsking(false);
          found.setData({ row: null });
        }}
      />
    </>
  );
}
