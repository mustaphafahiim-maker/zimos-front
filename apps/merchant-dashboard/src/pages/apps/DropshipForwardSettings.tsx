import { useId, useState } from "react";
import { Alert } from "@store-builder/ui";
import {
  dropshipSaveSettings,
  dropshipSettingsOf,
  type DropshipAutoForward,
  type DropshipProviderDto,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Orders",
    autoForward: "Send orders to this supplier automatically",
    autoForwardHint: "Only orders holding products imported from this supplier, and only their lines. Test orders and unpaid online orders are never sent.",
    off: "No — I send each order from its page",
    created: "As soon as the order is placed",
    confirmed: "Once the order is confirmed",
    applyStatus: "Move the order when the supplier's status changes",
    applyHint: "Confirmed, shipped, delivered, returned or cancelled at the supplier moves the order here too, when it can make that move. Off: the status is only shown on the order.",
    saved: "Saved.",
  },
  ar: {
    title: "الأوردرات",
    autoForward: "ابعت الأوردرات للمورّد ده تلقائيًا",
    autoForwardHint: "بس الأوردرات اللي فيها منتجات مستوردة من المورّد ده، وبس منتجاته. الأوردرات التجريبية والأونلاين اللي لسه ما اتدفعتش عمرها ما بتتبعت.",
    off: "لأ — أنا هبعت كل أوردر من صفحته",
    created: "أول ما الأوردر يتعمل",
    confirmed: "بعد ما الأوردر يتأكد",
    applyStatus: "حرّك الأوردر لما حالته تتغير عند المورّد",
    applyHint: "لما يتأكد أو يتشحن أو يتسلّم أو يرجع أو يتلغي عند المورّد، الأوردر بيتحرك هنا كمان لو ينفع. لو مقفولة: الحالة بتظهر على الأوردر بس.",
    saved: "تم الحفظ.",
  },
} satisfies Messages;

/** A connected supplier's order settings (SPEC §16.5: forward automatically, follow the status). */
export function DropshipForwardSettings({ provider, onChanged }: { provider: DropshipProviderDto; onChanged: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const hintId = useId();
  const stored = dropshipSettingsOf(provider);
  const [autoForward, setAutoForward] = useState<DropshipAutoForward>(stored.autoForward);
  const [applyStatus, setApplyStatus] = useState(stored.applyStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: { autoForward?: DropshipAutoForward; applyStatus?: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const saved = await dropshipSaveSettings(apiClient, workspaceId, provider.code, next);
      setAutoForward(saved.autoForward);
      setApplyStatus(saved.applyStatus);
      toast.success(t.saved);
      onChanged();
    } catch (err) {
      setAutoForward(stored.autoForward);
      setApplyStatus(stored.applyStatus);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md space-y-3">
      <h3 className="text-sm font-medium text-ink">{t.title}</h3>
      {error && <Alert variant="danger">{error}</Alert>}
      <Field label={t.autoForward} hint={t.autoForwardHint}>
        {({ id, ...aria }) => (
          <Select
            id={id}
            {...aria}
            value={autoForward}
            disabled={busy}
            className="h-11"
            onChange={(e) => {
              const value = e.target.value as DropshipAutoForward;
              setAutoForward(value);
              void save({ autoForward: value });
            }}
          >
            <option value="off">{t.off}</option>
            <option value="created">{t.created}</option>
            <option value="confirmed">{t.confirmed}</option>
          </Select>
        )}
      </Field>
      {stored.followsStatus && (
        <div>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={applyStatus}
              disabled={busy}
              aria-describedby={hintId}
              onChange={(e) => {
                setApplyStatus(e.target.checked);
                void save({ applyStatus: e.target.checked });
              }}
            />
            {t.applyStatus}
          </label>
          <p id={hintId} className="text-xs text-ink-soft">
            {t.applyHint}
          </p>
        </div>
      )}
    </div>
  );
}
