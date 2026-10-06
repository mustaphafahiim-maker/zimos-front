import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card } from "@store-builder/ui";
import { couponsGetOrderRules, couponsSaveOrderRules } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { majorToMinor, minorToMajorInput } from "@/lib/format";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { MoneyInput } from "@/components/MoneyInput";
import { useToast } from "@/components/Toast";

/**
 * Minimum order and free shipping (SPEC §10.6). The minimum is set here; the
 * free-shipping threshold belongs to the shipping settings, and the store
 * shows the customer how far they are from it.
 */

const STRINGS = {
  en: {
    back: "Offers",
    title: "Minimum order and free shipping",
    description: "A floor under small orders, and a reason to add one more thing.",
    minimum: "Minimum order amount",
    minimumHint:
      "An order below this is not accepted; the customer is told how much more to add. Leave blank for no minimum. It does not apply to orders your team enters.",
    invalid: "Enter a valid amount, or leave it blank.",
    save: "Save",
    saving: "Saving…",
    saved: "Minimum order saved.",
    freeTitle: "Free shipping from an amount",
    freeHint:
      "Set the amount in the shipping settings. In the cart and at checkout the customer sees a bar showing how much is left to reach it.",
    freeLink: "Open shipping settings",
  },
  ar: {
    back: "العروض",
    title: "الحد الأدنى للطلب والشحن المجاني",
    description: "حد أدنى للأوردرات الصغيرة، وسبب لإضافة منتج آخر.",
    minimum: "الحد الأدنى للطلب",
    minimumHint: "الأوردر الأقل من هذا المبلغ لا يُقبل، ويُخبَر العميل بالمبلغ المتبقي. اتركه فارغًا لعدم وضع حد. لا يُطبَّق على الأوردرات التي يُدخلها فريقك.",
    invalid: "اكتب مبلغًا صحيحًا، أو اتركه فارغًا.",
    save: "حفظ",
    saving: "بنحفظ…",
    saved: "تم حفظ الحد الأدنى للطلب.",
    freeTitle: "شحن مجاني من مبلغ معين",
    freeHint: "حدّد المبلغ من إعدادات الشحن. في السلة وعند إتمام الطلب يرى العميل شريطًا يوضح المتبقي للوصول إليه.",
    freeLink: "فتح إعدادات الشحن",
  },
} satisfies Messages;

export function OrderRulesPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [minimum, setMinimum] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = useAsync(async () => {
    const loaded = await couponsGetOrderRules(apiClient, workspaceId);
    setMinimum(minorToMajorInput(loaded.minOrderAmount));
    return loaded;
  }, [workspaceId]);

  async function save() {
    const amount = minimum.trim() === "" ? null : majorToMinor(minimum);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      setError(t.invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await couponsSaveOrderRules(apiClient, workspaceId, { minOrderAmount: amount || null });
      setMinimum(minorToMajorInput(saved.minOrderAmount));
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title={t.title} description={t.description} back={{ to: "/offers", label: t.back }} />
      <DataState loading={rules.loading} error={rules.error} onRetry={() => rules.refresh()}>
        <Card className="space-y-4 p-5">
          <MoneyInput label={t.minimum} hint={t.minimumHint} value={minimum} onChange={setMinimum} />
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="flex justify-end">
            <Button type="button" disabled={busy} onClick={() => void save()}>
              {busy ? t.saving : t.save}
            </Button>
          </div>
        </Card>
        <Card className="space-y-2 p-5">
          <h2 className="font-medium text-ink">{t.freeTitle}</h2>
          <p className="text-sm text-ink-soft">{t.freeHint}</p>
          <Link to="/shipping" className="inline-block text-sm font-medium text-primary hover:underline">
            {t.freeLink}
          </Link>
        </Card>
      </DataState>
    </div>
  );
}
