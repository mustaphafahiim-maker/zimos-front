import {
  expressWalletsOf,
  type ExpressWallet,
  type GatewayFieldDescriptor,
  type PaymentGatewayInfo,
} from "@store-builder/api-client";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { StatusBadge } from "@/components/StatusBadge";
import { SettingsSwitch } from "@/components/settings";
import { humanize } from "@/lib/format";
import { getFieldErrors } from "@/lib/errors";

/**
 * Payments → Stripe and PayPal, and the express checkout buttons (handoff
 * item 183). The gateway cards are still rendered from each adapter's fields
 * (PaymentsPage.tsx); this file holds what those cards need beyond Paymob and
 * Kashier: names for every way to pay (PayPal included), the wallet badges
 * a method carries in `express`, on/off settings (Stripe's
 * `expressWallets`), Stripe's and PayPal's webhook notes, and the note when
 * a gateway cannot take the store's currency.
 */

const STRINGS = {
  en: {
    card: "card",
    wallet: "mobile wallet",
    valu: "valU installments",
    kiosk: "kiosk (Aman / Masary)",
    paypal: "PayPal",
    express: "Express checkout",
    expressWalletsHint:
      "Buttons at the top of your checkout. Stripe's page shows Apple Pay and Google Pay on phones and browsers that have them.",
    stripeWebhookHint:
      "Add it in Stripe → Developers → Webhooks for the checkout.session events, then paste its signing secret (whsec_…) with your keys. Without it, payments are still confirmed when the shopper comes back.",
    stripeNoWebhookYet:
      "No update from Stripe yet. That's fine without a webhook: each payment is confirmed when the shopper comes back.",
    paypalConfirm:
      "Nothing to paste: each PayPal payment is confirmed and collected with PayPal when the shopper comes back to your store.",
    stripeSecretKey: "A Stripe secret key starts with sk_test_ or sk_live_. Copy it from Developers → API keys.",
    stripeWebhookSecret: "A Stripe webhook signing secret starts with whsec_. Leave it empty if you didn't add the webhook.",
    currencyTitle: "{name} isn't available in this currency ({currency})",
    currencyHint: "It takes {list} only, so checkout offers it just for orders in those currencies, like a funnel that sells in one of them.",
  },
  ar: {
    card: "كارت",
    wallet: "محفظة إلكترونية",
    valu: "تقسيط valU",
    kiosk: "الدفع في الكشك (أمان / مصاري)",
    paypal: "باي بال",
    express: "دفع سريع",
    expressWalletsHint:
      "أزرار في أول صفحة الدفع في متجرك. صفحة Stripe بتعرض Apple Pay وGoogle Pay على الموبايلات والمتصفحات اللي فيها.",
    stripeWebhookHint:
      "ضيفه في Stripe ← Developers ← Webhooks لأحداث checkout.session، وبعدين الصق مفتاح التوقيع بتاعه مع المفاتيح. من غيره الدفع برضه بيتأكد لما العميل يرجع للمتجر.",
    stripeNoWebhookYet: "لسه مفيش تحديث من Stripe. ده عادي من غير Webhook: كل دفعة بتتأكد لما العميل يرجع للمتجر.",
    paypalConfirm: "مفيش حاجة تلصقها: كل دفعة PayPal بتتأكد وتتحصّل من PayPal لما العميل يرجع لمتجرك.",
    stripeSecretKey: "مفتاح Stripe السري بيبدأ بـ sk_test_\u200E أو sk_live_\u200E. انسخه من Developers ← API keys.",
    stripeWebhookSecret: "مفتاح توقيع الـ Webhook في Stripe بيبدأ بـ whsec_\u200E. سيبه فاضي لو مضفتش الـ Webhook.",
    currencyTitle: "{name} مش متاح بالعملة دي ({currency})",
    currencyHint: "بياخد {list} بس، فبيظهر في صفحة الدفع للأوردرات بالعملات دي بس، زي مسار بيع بيبيع بواحدة منهم.",
  },
} satisfies Messages;

/** Brand names: never translated. */
const WALLET_NAMES: Record<ExpressWallet, string> = {
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  paypal: "PayPal",
};

/** Credentials a gateway takes but does not need (Stripe's webhook signing secret). */
const OPTIONAL_CREDENTIALS: Record<string, readonly string[]> = {
  stripe: ["webhookSecret"],
};

export function isOptionalCredential(gatewayCode: string, field: GatewayFieldDescriptor): boolean {
  return (OPTIONAL_CREDENTIALS[gatewayCode] ?? []).includes(field.key);
}

/**
 * "{gateway}: {method}" for the Payments lists — "Stripe: card", "Sandbox:
 * PayPal" — and just "PayPal" when the gateway is named after its method.
 */
export function useMethodLabel() {
  const nameOf = useMethodName();
  return (method: string, gatewayName: string | null) => {
    const name = nameOf(method);
    const sameName = gatewayName?.toLowerCase() === WALLET_NAMES.paypal.toLowerCase() && method === "paypal";
    return gatewayName && !sameName ? `${gatewayName}: ${name}` : name;
  };
}

const METHOD_KEYS = ["card", "wallet", "valu", "kiosk", "paypal"] as const;

/** One way to pay by name: card, mobile wallet, valU, kiosk, PayPal. */
function useMethodName() {
  const t = useT(STRINGS);
  return (method: string) =>
    (METHOD_KEYS as readonly string[]).includes(method) ? t[method as (typeof METHOD_KEYS)[number]] : humanize(method);
}

/** The ways a gateway account takes, by name: "card · mobile wallet · PayPal". */
export function useMethodNames() {
  const nameOf = useMethodName();
  return (methods: string[]) => methods.map(nameOf).join(" · ");
}

/** The wallet buttons a method shows at the top of checkout (Apple Pay, Google Pay, PayPal). */
export function ExpressWalletBadges({ method }: { method: { id: string } }) {
  const t = useT(STRINGS);
  const wallets = expressWalletsOf(method);
  if (wallets.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="sr-only">{t.express}:</span>
      {wallets.map((wallet) => (
        <StatusBadge key={wallet} value={wallet} tone="info" text={WALLET_NAMES[wallet]} />
      ))}
    </span>
  );
}

/** An on/off gateway setting (Stripe: «اعرض أزرار Apple Pay وGoogle Pay»). */
export function SettingSwitch({
  field,
  checked,
  disabled,
  busy = false,
  onChange,
}: {
  field: GatewayFieldDescriptor;
  checked: boolean;
  disabled: boolean;
  /** The change is being saved: the thumb shows a spinner. */
  busy?: boolean;
  onChange: (on: boolean) => void;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  // A row of a SettingsGroup: the whole row is the switch.
  return (
    <SettingsSwitch
      label={field.label[locale]}
      hint={field.key === "expressWallets" ? t.expressWalletsHint : undefined}
      checked={checked}
      disabled={disabled}
      busy={busy}
      onChange={onChange}
    />
  );
}

/**
 * What a gateway card says about its webhook, where the generic copy is
 * wrong: Stripe's webhook is optional (its own help line), PayPal has nothing
 * to paste (the payment is captured when the shopper comes back), so its URL
 * is not shown. Empty for the other gateways.
 */
export function useGatewayWebhookNotes(gateway: PaymentGatewayInfo): {
  hint?: string;
  pending?: string;
  hideUrl?: boolean;
} {
  const t = useT(STRINGS);
  if (gateway.code === "stripe") return { hint: t.stripeWebhookHint, pending: t.stripeNoWebhookYet };
  if (gateway.code === "paypal") return { pending: t.paypalConfirm, hideUrl: true };
  return {};
}

/**
 * The 422 for a Stripe key in the wrong shape names its field
 * (credentials.secretKey / credentials.webhookSecret): said plainly here
 * instead of the generic "fix the fields in red", which this form has none of.
 */
export function useGatewayKeyProblem() {
  const t = useT(STRINGS);
  return (gatewayCode: string, err: unknown): string | null => {
    if (gatewayCode !== "stripe") return null;
    const fields = getFieldErrors(err);
    if (fields["credentials.secretKey"]) return t.stripeSecretKey;
    if (fields["credentials.webhookSecret"]) return t.stripeWebhookSecret;
    return null;
  };
}

/** «PayPal مش متاح بالعملة دي» when the gateway cannot take the store's own currency. */
export function GatewayCurrencyNote({ gateway }: { gateway: PaymentGatewayInfo }) {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency;
  if (!currency || gateway.currencies.length === 0 || gateway.currencies.includes(currency.toUpperCase())) return null;
  // The codes stay in reading order inside an Arabic sentence.
  const [before, after = ""] = t.currencyHint.split("{list}");
  return (
    <div className="rounded-[0.875rem] bg-paper-sunken px-4 py-3 text-sm">
      <p className="font-medium text-ink">{fmt(t.currencyTitle, { name: gateway.name, currency })}</p>
      <p className="mt-1 text-ink-soft">
        {before}
        <bdi dir="ltr">{gateway.currencies.join(" · ")}</bdi>
        {after}
      </p>
    </div>
  );
}
