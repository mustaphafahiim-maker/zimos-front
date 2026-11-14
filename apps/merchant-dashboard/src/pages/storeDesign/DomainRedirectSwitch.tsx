import { domainRedirectsToPrimary, type StoreDomain } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { ToggleRow } from "./SettingsFormFooter";

const STRINGS = {
  en: {
    label: "Redirect visitors to the primary domain",
    hint: "Off: the store opens on this domain too (useful for a domain dedicated to a funnel).",
  },
  ar: {
    label: "تحويل الزوار إلى الدومين الأساسي",
    hint: "عند الإيقاف: يفتح المتجر على هذا الدومين أيضًا (مفيد لدومين مخصص لمسار بيع).",
  },
} satisfies Messages;

interface DomainRedirectSwitchProps {
  domain: StoreDomain;
  disabled?: boolean;
  onChange: (redirectToPrimary: boolean) => void;
}

/**
 * On each non-primary domain's card: whether a visit to this
 * domain moves to the primary one (on by default) or the store opens here
 * too. The caller hides it on the primary domain and saves the change.
 */
export function DomainRedirectSwitch({ domain, disabled, onChange }: DomainRedirectSwitchProps) {
  const t = useT(STRINGS);
  return <ToggleRow label={t.label} hint={t.hint} checked={domainRedirectsToPrimary(domain)} disabled={disabled} onChange={onChange} />;
}
