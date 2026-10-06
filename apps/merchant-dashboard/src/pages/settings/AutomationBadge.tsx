import { useLocale } from "@/i18n/LocaleContext";
import { StatusBadge } from "@/components/StatusBadge";
import { TOOL_NAME, automationOf } from "@/pages/apps/automationApps";

/**
 * Settings → Developers → Webhooks (handoff 193): an endpoint on
 * hooks.zapier.com or hook.*.make.com was subscribed by a Zap or a Make
 * scenario, so it carries a «زابير» / «ميك» badge. Nothing for any other URL.
 */
export function AutomationBadge({ url }: { url: string }) {
  const { locale } = useLocale();
  const tool = automationOf(url);
  if (!tool) return null;
  return <StatusBadge value={tool} tone="info" text={TOOL_NAME[tool][locale]} />;
}
