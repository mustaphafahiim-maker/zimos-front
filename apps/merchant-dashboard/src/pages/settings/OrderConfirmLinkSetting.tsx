import { useState } from "react";
import { Alert } from "@store-builder/ui";
import { checkoutHardeningSelfServiceConfirmSave, checkoutHardeningSelfServiceSettingsGet } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { PaneSkeleton } from "./sections/SettingsCard";

const STRINGS = {
  en: {
    label: "Customers can confirm cash-on-delivery orders from a link",
    hint: "Put {{confirm_link}} in an SMS or email and the customer confirms with one tap, no call needed",
    on: "On. Add {{confirm_link}} to your order SMS or email.",
    off: "Off. The confirmation link stays empty in your messages.",
  },
  ar: {
    label: "العميل يقدر يأكّد طلب الدفع عند الاستلام من لينك",
    hint: "ابعت المتغيّر {{confirm_link}} في رسالة SMS أو إيميل، والعميل يأكّد بضغطة من غير مكالمة",
    on: "اتفعّلت. ضيف {{confirm_link}} في رسالة الأوردر أو الإيميل.",
    off: "اتقفلت. لينك التأكيد هيفضل فاضي في رسايلك.",
  },
} satisfies Messages;

/**
 * Settings → Orders → what customers can do on their order (handoff 388,
 * orders.manage): the third switch — the shopper confirms a cash-on-delivery
 * order from the store's link. It saves on its own, as it is switched; the
 * cancel and address rules beside it (OrderSelfServiceSection) keep their
 * own Save and are sent back as the server holds them.
 */
export function OrderConfirmLinkSetting() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const settings = useAsync(() => checkoutHardeningSelfServiceSettingsGet(apiClient, workspaceId), [workspaceId]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(enabled: boolean) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      // Read again first: the rules beside this switch may have been saved since this card loaded.
      const current = await checkoutHardeningSelfServiceSettingsGet(apiClient, workspaceId);
      const next = await checkoutHardeningSelfServiceConfirmSave(apiClient, workspaceId, current, enabled);
      settings.setData(next);
      toast.success(enabled ? t.on : t.off);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DataState loading={settings.loading} error={settings.error} onRetry={() => void settings.refresh()} skeleton={<PaneSkeleton rows={1} />}>
      {settings.data && (
        <div className="flex min-w-0 flex-col gap-[var(--bento-gap)] pt-[var(--bento-gap)]">
          <SettingsGroup>
            <SettingsSwitch
              label={t.label}
              hint={t.hint}
              checked={settings.data.confirm?.enabled === true}
              disabled={saving}
              onChange={(enabled) => void toggle(enabled)}
            />
          </SettingsGroup>
          {error && <Alert variant="danger">{error}</Alert>}
        </div>
      )}
    </DataState>
  );
}
