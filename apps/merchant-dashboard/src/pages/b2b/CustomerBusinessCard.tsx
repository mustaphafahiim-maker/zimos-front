import { useId, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { BUSINESS_LIMITS, customerBusinessGet, customerBusinessSave, type CustomerBusiness } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { getFieldErrors, isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { useCommon, useT } from "@/i18n/LocaleContext";
import { CustomerCard, type CustomerCardFrame } from "@/pages/customers/detail/CardFrame";
import { SkeletonBar } from "@/components/DataState";
import { Field, TextField } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { canManageCustomers } from "./b2bAccess";
import { B2B_STRINGS } from "./b2bStrings";

/**
 * The customer page's «بيانات الشركة» card (handoff 228): the company name
 * and tax ID that print on this customer's invoices, and «معفى من الضريبة»
 * with the team's note on what was checked. GET customers.view, PUT
 * customers.manage; a role without customers.view gets no card.
 *
 * `frame` (optional) lets the customer page draw this card as one of its folding
 * sections instead of a pane of its own; left out, the card is the `Section` it
 * always was.
 */
export function CustomerBusinessCard({ customerId, frame }: { customerId: string; frame?: CustomerCardFrame }) {
  const t = useT(B2B_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const business = useAsync(() => customerBusinessGet(apiClient, workspaceId, customerId), [workspaceId, customerId]);

  const data = business.data;
  // No role for it: the page's other cards still stand, this one stays out.
  if (isPermissionError(business.error)) return null;

  return (
    // The folded line of the customer page: the company's name, once one is saved.
    <CustomerCard frame={frame} title={t.businessTitle} description={t.businessHint} summary={data?.companyName?.trim() || undefined}>
      {data ? (
        <BusinessForm
          // What is saved is the form's starting point: a save starts it again from the answer.
          key={JSON.stringify(data)}
          data={data}
          canEdit={canManageCustomers(currentWorkspace?.role)}
          onSave={async (body) => {
            business.setData(await customerBusinessSave(apiClient, workspaceId, customerId, body));
            toast.success(t.businessSaved);
          }}
        />
      ) : business.error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-danger">{errorMessage(business.error)}</p>
          <Button variant="outline" size="sm" className="min-h-11" onClick={() => void business.refresh()}>
            {common.retry}
          </Button>
        </div>
      ) : (
        <div role="status" aria-busy="true">
          <span className="sr-only">{common.loading}</span>
          <div aria-hidden className="grid gap-4 sm:grid-cols-2">
            <SkeletonBar className="h-10 w-full" />
            <SkeletonBar className="h-10 w-full" />
          </div>
        </div>
      )}
    </CustomerCard>
  );
}

function BusinessForm({
  data,
  canEdit,
  onSave,
}: {
  data: CustomerBusiness;
  canEdit: boolean;
  onSave: (body: { companyName: string; taxId: string; taxExempt: boolean; taxExemptNote: string }) => Promise<void>;
}) {
  const t = useT(B2B_STRINGS);
  const common = useCommon();
  const errorMessage = useErrorMessage();
  const exemptHint = useId();
  const [companyName, setCompanyName] = useState(data.companyName ?? "");
  const [taxId, setTaxId] = useState(data.taxId ?? "");
  const [taxExempt, setTaxExempt] = useState(data.taxExempt);
  const [note, setNote] = useState(data.taxExemptNote ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The note belongs to the exemption: without one there is nothing to keep.
  const noteToSave = taxExempt ? note.trim() : "";
  const dirty =
    companyName.trim() !== (data.companyName ?? "") ||
    taxId.trim() !== (data.taxId ?? "") ||
    taxExempt !== data.taxExempt ||
    noteToSave !== (data.taxExemptNote ?? "");
  useReportDirty(dirty);
  const locked = !canEdit || saving;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !dirty) return;
    setSaving(true);
    setFailure(null);
    setFieldErrors({});
    try {
      await onSave({ companyName: companyName.trim(), taxId: taxId.trim(), taxExempt, taxExemptNote: noteToSave });
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t.companyName}
          dir="auto"
          autoComplete="off"
          maxLength={BUSINESS_LIMITS.companyName}
          value={companyName}
          disabled={locked}
          error={fieldErrors.companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
        <TextField
          label={t.taxId}
          dir="ltr"
          autoComplete="off"
          maxLength={BUSINESS_LIMITS.taxId}
          value={taxId}
          disabled={locked}
          error={fieldErrors.taxId}
          onChange={(e) => setTaxId(e.target.value)}
        />
      </div>

      <div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-ink has-[:disabled]:cursor-default">
          <input
            type="checkbox"
            role="switch"
            className="size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-default"
            checked={taxExempt}
            disabled={locked}
            aria-describedby={exemptHint}
            onChange={(e) => setTaxExempt(e.target.checked)}
          />
          {t.taxExempt}
        </label>
        <p id={exemptHint} className="text-xs text-ink-soft">
          {taxExempt ? t.taxExemptOn : t.taxExemptOff}
        </p>
      </div>

      {taxExempt && (
        <Field label={t.exemptNote} hint={t.exemptNoteHint} error={fieldErrors.taxExemptNote}>
          {(props) => (
            <Textarea
              {...props}
              rows={2}
              dir="auto"
              maxLength={BUSINESS_LIMITS.taxExemptNote}
              placeholder={t.exemptNotePlaceholder}
              value={note}
              disabled={locked}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
      )}

      {failure && <Alert variant="danger">{failure}</Alert>}
      {canEdit ? (
        dirty && (
          <div className="flex justify-end">
            <Button type="submit" className="min-h-11" disabled={saving}>
              {saving ? common.saving : common.save}
            </Button>
          </div>
        )
      ) : (
        <p className="text-xs text-ink-soft">{t.viewOnly}</p>
      )}
    </form>
  );
}
