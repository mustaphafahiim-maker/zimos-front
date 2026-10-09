import { useId, useState } from "react";
import { Alert, cn } from "@store-builder/ui";
import {
  dropshipRulesOf,
  dropshipSaveRules,
  isDropshipNotSupported,
  type DropshipProviderDto,
  type DropshipSupplierRule,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Shipping and minimum order",
    useSupplierShipping: "Use the supplier's shipping rates",
    useSupplierShippingHint:
      "An order made only of this supplier's products is charged the supplier's shipping price. Your free-shipping rules still win, and mixed orders keep your own rates.",
    useSupplierShippingOff: "{name} doesn't give shipping prices, so your own rates are used.",
    enforceMinimum: "Refuse orders below the supplier's minimum",
    enforceMinimumHint:
      "A shopper can't place an order whose products from this supplier come to less than the supplier's minimum. The checkout says how much more to add. Orders your team types in are not refused.",
    enforceMinimumOff: "{name} has no minimum order to apply.",
    saved: "Saved.",
  },
  ar: {
    title: "الشحن والحد الأدنى",
    useSupplierShipping: "استخدم أسعار شحن المورّد",
    useSupplierShippingHint:
      "الأوردر اللي كل منتجاته من المورّد ده بيتحسب شحنه بسعر المورّد. قواعد الشحن المجاني بتاعتك ليها الأولوية، والأوردرات المخلوطة بتفضل على أسعارك.",
    useSupplierShippingOff: "{name} مش بيدّي أسعار شحن، فأسعارك إنت اللي بتتحسب.",
    enforceMinimum: "ارفض الطلب لو أقل من الحد الأدنى للمورّد",
    enforceMinimumHint:
      "العميل مش هيقدر يطلب لو منتجات المورّد ده في طلبه أقل من الحد الأدنى بتاعه. صفحة إتمام الطلب بتقوله يضيف بكام. الأوردرات اللي فريقك بيسجّلها بإيده مش بتترفض.",
    enforceMinimumOff: "{name} مالوش حد أدنى للطلب يتطبّق.",
    saved: "اتحفظ.",
  },
} satisfies Messages;

/**
 * What the supplier cannot do, learned from its refusal (422 DROPSHIP_NOT_SUPPORTED): the
 * supplier list does not say it, and it is a fact of the supplier, not of one store — so it is
 * kept for the session and the switch stays off with its reason on the next visit.
 */
const UNSUPPORTED = new Set<string>();
const unsupportedKey = (code: string, rule: DropshipSupplierRule) => `${code}:${rule}`;

const RULES: DropshipSupplierRule[] = ["useSupplierShipping", "enforceMinimum"];

/**
 * A connected supplier's own rules on the store's orders (frontend-handoff 263): charge its
 * shipping rates on orders that are all its products, and refuse a shopper's order below its
 * minimum. Each switch saves by itself; one the supplier cannot honour is switched off for
 * good, with the reason under it.
 */
export function DropshipSupplierRules({ provider, name, onChanged }: { provider: DropshipProviderDto; name: string; onChanged: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const baseId = useId();
  const stored = dropshipRulesOf(provider);
  const [values, setValues] = useState(stored);
  const [busy, setBusy] = useState<DropshipSupplierRule | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped when a refusal is learned, so the switch redraws disabled.
  const [, setLearned] = useState(0);

  async function save(rule: DropshipSupplierRule, on: boolean) {
    setBusy(rule);
    setError(null);
    setValues((prev) => ({ ...prev, [rule]: on }));
    try {
      const saved = await dropshipSaveRules(apiClient, workspaceId, provider.code, { [rule]: on });
      setValues(saved);
      toast.success(t.saved);
      onChanged();
    } catch (err) {
      setValues((prev) => ({ ...prev, [rule]: !on }));
      if (isDropshipNotSupported(err)) {
        UNSUPPORTED.add(unsupportedKey(provider.code, rule));
        setLearned((n) => n + 1);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-md space-y-3">
      <h3 className="text-sm font-medium text-ink">{t.title}</h3>
      {error && <Alert variant="danger">{error}</Alert>}
      {RULES.map((rule) => {
        const unsupported = UNSUPPORTED.has(unsupportedKey(provider.code, rule));
        const hintId = `${baseId}-${rule}`;
        return (
          <div key={rule}>
            <label className={cn("flex min-h-11 items-center gap-3 text-sm text-ink", unsupported ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
              <input
                type="checkbox"
                role="switch"
                className="size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
                checked={values[rule] && !unsupported}
                disabled={unsupported || busy !== null}
                aria-describedby={hintId}
                onChange={(e) => void save(rule, e.target.checked)}
              />
              {t[rule]}
            </label>
            <p id={hintId} className="text-xs text-ink-soft">
              {unsupported ? fmt(t[`${rule}Off`], { name }) : t[`${rule}Hint`]}
            </p>
          </div>
        );
      })}
    </div>
  );
}
