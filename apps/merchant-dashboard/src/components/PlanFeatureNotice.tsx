import { Link } from "react-router-dom";
import type { PlanFeatureKey } from "@store-builder/api-client";
import { Alert, Button } from "@store-builder/ui";
import { PLAN_STRINGS, featureLabel } from "@/lib/planDisplay";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    featureRequired: "Your plan doesn't include {feature}. Upgrade your plan to use it.",
    seePlans: "See the plans",
  },
  ar: {
    featureRequired: "خطتك الحالية لا تشمل {feature}. رقِّ خطتك لاستخدامها.",
    seePlans: "عرض الخطط",
  },
} satisfies Messages;

/**
 * The dashboard's one way of saying a feature is locked behind the plan: a
 * quiet notice and a button to the Subscription section — never a permission
 * problem, nothing to retry. DataState shows it when a request came back
 * PLAN_FEATURE_REQUIRED (with the server's own sentence); a screen that knows
 * up front (lib/usePlanFeatures) names the feature itself.
 */
export function PlanFeatureNotice({ feature, message, className }: { feature?: PlanFeatureKey; message?: string; className?: string }) {
  const t = useT(STRINGS);
  const plan = useT(PLAN_STRINGS);
  const text = message ?? (feature ? fmt(t.featureRequired, { feature: featureLabel(feature, plan) }) : "");
  return (
    <Alert variant="info" className={className ? `flex flex-col gap-3 ${className}` : "flex flex-col gap-3"}>
      <span>{text}</span>
      <div>
        <Button asChild size="sm" className="min-h-11">
          <Link to="/subscription">{t.seePlans}</Link>
        </Button>
      </div>
    </Alert>
  );
}
