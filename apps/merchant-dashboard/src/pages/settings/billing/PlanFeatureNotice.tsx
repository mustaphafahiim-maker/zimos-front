import { Button } from "@store-builder/ui";
import { apiErrorDetails, isApiErrorCode, type PlanFeatureRequiredDetails } from "@store-builder/api-client";
import { IconLock } from "@/components/icons";
import { ViewLink } from "@/components/ViewLink";
import { StateMessage } from "@/components/DataState";
import { useLocale, useT, fmt } from "@/i18n/LocaleContext";
import { BILLING_STRINGS, SUBSCRIPTION_PATH } from "./billingStrings";

/** The feature a 403 PLAN_FEATURE_REQUIRED names (handoff 333), or null for any other failure. */
export function planFeatureRequired(err: unknown): PlanFeatureRequiredDetails | null {
  if (!isApiErrorCode(err, "PLAN_FEATURE_REQUIRED")) return null;
  const details = apiErrorDetails<Partial<PlanFeatureRequiredDetails>>(err);
  const feature = details?.feature ?? "";
  return { feature, label: { en: details?.label?.en ?? feature, ar: details?.label?.ar ?? details?.label?.en ?? feature } };
}

/**
 * In place of what the plan doesn't include (Website traffic's charts, a
 * gated form): which feature it is, and the way to the plans.
 */
export function PlanFeatureNotice({ feature }: { feature: PlanFeatureRequiredDetails }) {
  const t = useT(BILLING_STRINGS);
  const { locale } = useLocale();
  return (
    <StateMessage
      role="status"
      tone="attention"
      icon={<IconLock aria-hidden />}
      title={fmt(t.featureRequired, { feature: feature.label[locale] || feature.label.en })}
      action={
        <Button asChild className="min-h-11">
          <ViewLink to={SUBSCRIPTION_PATH}>{t.seePlans}</ViewLink>
        </Button>
      }
    />
  );
}
