import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import {
  ApiError,
  apiErrorCode,
  apiErrorDetails,
  dropshipConnect,
  dropshipDisconnect,
  dropshipImport,
  dropshipProviders,
  dropshipSyncStock,
  type DropshipProviderDto,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Section } from "@/components/Section";
import { DropshipForwardSettings } from "./DropshipForwardSettings";
import { TextField } from "@/components/Field";
import { StatusBadge } from "@/components/StatusBadge";
import { dropshipProviderName, isStoreProvider } from "./dropshipStores";
import { StoreSkuWarning } from "./StoreSkuWarning";

/**
 * Dropshipping suppliers: connect an account, import a product by the
 * supplier's code, copy its stock. The form is drawn from what the provider
 * says it needs, so a new provider needs no screen of its own.
 *
 * The merchant's own Shopify or WooCommerce store (frontend-handoff 181) uses
 * the same endpoints and sits in its own group, "Your other store": orders go
 * there and the shipping status comes back.
 */

const STRINGS = {
  en: {
    title: "Dropshipping suppliers",
    description: "Import a supplier's products, forward your orders to them and keep stock in step.",
    back: "Apps",
    test: "Test",
    connected: "Connected",
    notConnected: "Not connected",
    account: "Account: {name}",
    connect: "Connect",
    connecting: "Connecting…",
    disconnect: "Disconnect",
    connectedToast: "{name} is connected.",
    disconnectedToast: "{name} was disconnected.",
    importTitle: "Import a product",
    importHint: "Type the product's code at the supplier. It is added as a draft for you to review.",
    importHintTest: "The test supplier has SBX-1001 and SBX-1002.",
    code: "Product code",
    import: "Import",
    importing: "Importing…",
    imported: "Imported “{name}” as a draft.",
    openProduct: "Open product",
    stockTitle: "Stock",
    stockHint: "Copies the supplier's current stock onto the products you imported.",
    sync: "Sync stock now",
    syncing: "Syncing…",
    synced: "Checked {products} product(s), updated {updated} variant(s).",
    soonTitle: "Coming soon",
    soonHint: "These suppliers will appear here once their connection is ready.",
    comingSoon: "Coming soon",
    none: "No supplier is available yet.",
    suppliersTitle: "Suppliers",
    suppliersHint: "Import a supplier's products and forward your orders to them.",
    storesTitle: "Your other store",
    storesHint: "Send orders to your Shopify or WooCommerce store and get the shipping status back",
    storeImportTitle: "Import a product from your store",
    storeCode: "Product id in your store",
    storeImportHint_shopify:
      "It's the number at the end of the product's address in your Shopify admin ({example}). It's added as a draft for you to review.",
    storeImportHint_woocommerce:
      "It's the number in the product's edit address in WordPress ({example}). It's added as a draft for you to review.",
    storeStockHint: "Copies your store's current stock onto the products you imported from it.",
    help_shopify:
      "Where to find them: in your Shopify admin open {path}, create an app with the {scopes} permissions, install it and copy its Admin API access token (it starts with {token}).",
    help_woocommerce:
      "Where to find them: in WordPress open {path}, choose Read/Write, then copy the Consumer key (it starts with {key}) and the Consumer secret (it starts with {secret}).",
    helpLink: "Step-by-step guide",
    httpsOnly: "The store address must start with https://",
    badAddress: "That store address isn't valid. Copy it from your browser while your store is open.",
    notThatStore: "That address didn't answer as a {name}. Check it's your store's address.",
    storeRefused: "Your store refused these details. Check the token or keys and the permissions they have, then try again.",
    productNotInStore: "There's no product with that id in your store. Check the number and try again.",
  },
  ar: {
    title: "مورّدين الدروبشيبنج",
    description: "استورد منتجات المورّد، ابعت له طلباتك وخلّي المخزون مظبوط.",
    back: "التطبيقات",
    test: "تجريبي",
    connected: "متصل",
    notConnected: "غير متصل",
    account: "الحساب: {name}",
    connect: "ربط",
    connecting: "بنربط…",
    disconnect: "فصل",
    connectedToast: "اتربط {name}.",
    disconnectedToast: "اتفصل {name}.",
    importTitle: "استيراد منتج",
    importHint: "اكتب كود المنتج عند المورّد. هيتضاف كمسودة عشان تراجعه.",
    importHintTest: "المورّد التجريبي عنده SBX-1001 و SBX-1002.",
    code: "كود المنتج",
    import: "استيراد",
    importing: "بنستورد…",
    imported: "تم استيراد «{name}» كمسودة.",
    openProduct: "افتح المنتج",
    stockTitle: "المخزون",
    stockHint: "بينسخ مخزون المورّد الحالي على المنتجات اللي استوردتها.",
    sync: "حدّث المخزون دلوقتي",
    syncing: "بنحدّث…",
    synced: "اتراجع {products} منتج واتحدّث {updated} نوع.",
    soonTitle: "قريبًا",
    soonHint: "المورّدين دول هيظهروا هنا أول ما الربط بتاعهم يجهز.",
    comingSoon: "قريبًا",
    none: "مفيش مورّد متاح لسه.",
    suppliersTitle: "المورّدين",
    suppliersHint: "استورد منتجات المورّد وابعتله الأوردرات.",
    storesTitle: "متجرك التاني",
    storesHint: "ابعت الأوردرات لمتجرك على شوبيفاي أو ووكومرس وارجع بحالة الشحن",
    storeImportTitle: "استورد منتج من متجرك",
    storeCode: "رقم المنتج في متجرك",
    storeImportHint_shopify: "هو الرقم اللي في آخر عنوان المنتج في لوحة شوبيفاي ({example}). بيتضاف كمسودة عشان تراجعه.",
    storeImportHint_woocommerce: "هو الرقم اللي في عنوان تعديل المنتج في ووردبريس ({example}). بيتضاف كمسودة عشان تراجعه.",
    storeStockHint: "بينسخ المخزون الحالي من متجرك على المنتجات اللي استوردتها منه.",
    help_shopify:
      "تجيبهم منين: من لوحة شوبيفاي افتح {path}، اعمل App وإديله صلاحيات {scopes}، ثبّته وانسخ الـ Admin API access token (بيبدأ بـ {token}).",
    help_woocommerce:
      "تجيبهم منين: من ووردبريس افتح {path}، اختار Read/Write وانسخ الـ Consumer key (بيبدأ بـ {key}) والـ Consumer secret (بيبدأ بـ {secret}).",
    helpLink: "الشرح خطوة بخطوة",
    httpsOnly: "عنوان المتجر لازم يبدأ بـ https://",
    badAddress: "عنوان المتجر ده مش مظبوط. انسخه من المتصفح وإنت فاتح متجرك.",
    notThatStore: "العنوان ده مردّش على إنه {name}. اتأكد إنه عنوان متجرك.",
    storeRefused: "متجرك رفض البيانات دي. راجع التوكن أو المفاتيح والصلاحيات اللي ليهم، وجرّب تاني.",
    productNotInStore: "مفيش منتج بالرقم ده في متجرك. اتأكد من الرقم وجرّب تاني.",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

/** Where each store explains making the token / keys (opened in a new tab). */
const HELP_URL: Record<string, string> = {
  shopify: "https://help.shopify.com/en/manual/apps/app-types/custom-apps",
  woocommerce: "https://woocommerce.com/document/woocommerce-rest-api/",
};

/** The stores' own menu names and prefixes, kept as they appear there (shown left to right). */
const HELP_VALUES: Record<string, Record<string, string>> = {
  shopify: {
    path: "Settings → Apps and sales channels → Develop apps",
    scopes: "read/write orders, read products",
    token: "shpat_",
    example: "…/products/123456",
  },
  woocommerce: { path: "WooCommerce → Settings → Advanced → REST API → Add key", key: "ck_", secret: "cs_", example: "post.php?post=123" },
};

/** A sentence with its {placeholders} filled by left-to-right runs, so Latin menu paths keep their order inside Arabic. */
function withLtrValues(template: string, values: Record<string, string>): ReactNode[] {
  return template.split(/\{(\w+)\}/).map((part, i) =>
    i % 2 === 1 ? (
      <bdi key={i} dir="ltr" className="font-medium text-ink">
        {values[part] ?? part}
      </bdi>
    ) : (
      part
    )
  );
}

export function DropshipProviderPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const list = useAsync(() => dropshipProviders(apiClient, workspaceId), [workspaceId]);
  const providers = list.data?.providers ?? [];
  const planned = list.data?.planned ?? [];
  const suppliers = providers.filter((p) => !isStoreProvider(p.code));
  const stores = providers.filter((p) => isStoreProvider(p.code));
  const refresh = () => void list.refresh({ silent: true });

  return (
    <div>
      <PageHeader title={t.title} description={t.description} back={{ to: "/apps", label: t.back }} />
      <DataState
        loading={list.loading}
        error={list.error}
        empty={providers.length === 0 && planned.length === 0}
        emptyMessage={t.none}
        onRetry={() => void list.refresh()}
      >
        <div className="space-y-8">
          {suppliers.length > 0 && (
            <div className="space-y-4">
              {stores.length > 0 && <GroupHeading title={t.suppliersTitle} hint={t.suppliersHint} />}
              {suppliers.map((provider) => (
                <ProviderCard key={provider.code} t={t} provider={provider} onChanged={refresh} />
              ))}
            </div>
          )}
          {stores.length > 0 && (
            <div className="space-y-4">
              <GroupHeading title={t.storesTitle} hint={t.storesHint} />
              {stores.map((provider) => (
                <ProviderCard key={provider.code} t={t} provider={provider} onChanged={refresh} />
              ))}
            </div>
          )}
          {planned.length > 0 && (
            <Section title={t.soonTitle} description={t.soonHint}>
              <ul className="flex flex-wrap gap-2">
                {planned.map((provider) => (
                  <li key={provider.code} className="rounded-full border border-line px-3 py-1 text-sm text-ink-soft">
                    {provider.name} · {t.comingSoon}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </DataState>
    </div>
  );
}

function GroupHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <p className="mt-0.5 text-sm text-ink-soft">{hint}</p>
    </div>
  );
}

type Busy = "connect" | "disconnect" | "import" | "sync";

function ProviderCard({ t, provider, onChanged }: { t: T; provider: DropshipProviderDto; onChanged: () => void }) {
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Busy | null>(null);
  const [error, setError] = useState<string | null>(null);
  // An import refused as already done still points at the product it made.
  const [errorProductId, setErrorProductId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [imported, setImported] = useState<{ id: string; name: string } | null>(null);
  const store = isStoreProvider(provider.code);
  const name = dropshipProviderName(provider.code, provider.name, locale);

  /** The shared sentence, sharpened for the merchant's own store (the server's words name the cause). */
  function messageFor(kind: Busy, err: unknown): string {
    if (!store) return errorMessage(err);
    const raw = err instanceof ApiError ? err.message : "";
    const credentialsProblem = /https:\/\//.test(raw)
      ? t.httpsOnly
      : /valid URL|username or password/i.test(raw)
        ? t.badAddress
        : /did not answer/i.test(raw)
          ? fmt(t.notThatStore, { name })
          : t.storeRefused;
    return errorMessage(err, {
      DROPSHIP_INVALID_CREDENTIALS: credentialsProblem,
      // While connecting, a 404 means the address is not that kind of store, not a missing product.
      DROPSHIP_PRODUCT_NOT_FOUND: kind === "connect" ? fmt(t.notThatStore, { name }) : t.productNotInStore,
    });
  }

  async function run(kind: Busy, work: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    setErrorProductId(null);
    try {
      await work();
    } catch (err) {
      setError(messageFor(kind, err));
      if (apiErrorCode(err) === "DROPSHIP_ALREADY_IMPORTED") {
        setErrorProductId(apiErrorDetails<{ productId?: string }>(err)?.productId ?? null);
      }
    } finally {
      setBusy(null);
    }
  }

  const connect = (e: FormEvent) => {
    e.preventDefault();
    void run("connect", async () => {
      await dropshipConnect(apiClient, workspaceId, provider.code, credentials);
      setCredentials({});
      toast.success(fmt(t.connectedToast, { name }));
      onChanged();
    });
  };

  const importProduct = (e: FormEvent) => {
    e.preventDefault();
    setImported(null);
    void run("import", async () => {
      const { product } = await dropshipImport(apiClient, workspaceId, provider.code, code.trim());
      setImported({ id: product.id, name: product.name });
      setCode("");
    });
  };

  const help = store ? (t as Record<string, string>)[`help_${provider.code}`] : undefined;
  const importHint = store ? (t as Record<string, string>)[`storeImportHint_${provider.code}`] : undefined;

  return (
    <Section
      title={name}
      description={provider.connected && provider.accountName ? fmt(t.account, { name: provider.accountName }) : undefined}
      actions={
        <>
          {provider.isTest && <StatusBadge value="test" tone="warning" text={t.test} />}
          <StatusBadge
            value={provider.connected ? "connected" : "disconnected"}
            tone={provider.connected ? "success" : "neutral"}
            text={provider.connected ? t.connected : t.notConnected}
          />
        </>
      }
    >
      {error && (
        <Alert variant="danger" className="mb-3">
          {error}
          {errorProductId && (
            <>
              {" "}
              <Link to={`/catalog/${errorProductId}`} className="font-medium underline">
                {t.openProduct}
              </Link>
            </>
          )}
        </Alert>
      )}

      {!provider.connected ? (
        <form onSubmit={connect} className="max-w-md space-y-3">
          {provider.credentialFields.map((field) => (
            <TextField
              key={field.key}
              label={field.label[locale]}
              type={field.secret ? "password" : "text"}
              autoComplete="off"
              dir="ltr"
              required={field.required}
              value={credentials[field.key] ?? ""}
              onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
            />
          ))}
          {help && (
            <p className="text-xs leading-relaxed text-ink-soft">
              {withLtrValues(help, HELP_VALUES[provider.code] ?? {})}{" "}
              {HELP_URL[provider.code] && (
                <a
                  href={HELP_URL[provider.code]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  {t.helpLink}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
            </p>
          )}
          <Button type="submit" className="min-h-11" disabled={busy !== null}>
            {busy === "connect" ? t.connecting : t.connect}
          </Button>
        </form>
      ) : (
        <div className="space-y-5">
          <form onSubmit={importProduct} className="max-w-md space-y-2">
            <h3 className="text-sm font-medium text-ink">{store ? t.storeImportTitle : t.importTitle}</h3>
            <p className="text-xs text-ink-soft">
              {store && importHint
                ? withLtrValues(importHint, HELP_VALUES[provider.code] ?? {})
                : `${t.importHint} ${provider.isTest ? t.importHintTest : ""}`}
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextField
                  label={store ? t.storeCode : t.code}
                  labelHidden={!store}
                  dir="ltr"
                  inputMode={store ? "numeric" : undefined}
                  placeholder={store ? "123456" : t.code}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <Button type="submit" className="min-h-11" disabled={busy !== null || code.trim() === ""}>
                {busy === "import" ? t.importing : t.import}
              </Button>
            </div>
            {imported && (
              <div className="space-y-2">
                <Alert variant="success">
                  {fmt(t.imported, { name: imported.name })}{" "}
                  <Link to={`/catalog/${imported.id}`} className="font-medium underline">
                    {t.openProduct}
                  </Link>
                </Alert>
                {store && <StoreSkuWarning />}
              </div>
            )}
          </form>

          <DropshipForwardSettings provider={provider} onChanged={onChanged} />

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-ink">{t.stockTitle}</h3>
            <p className="text-xs text-ink-soft">{store ? t.storeStockHint : t.stockHint}</p>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={busy !== null}
              onClick={() =>
                run("sync", async () => {
                  const result = await dropshipSyncStock(apiClient, workspaceId, provider.code);
                  toast.success(fmt(t.synced, { products: result.products, updated: result.updated }));
                })
              }
            >
              {busy === "sync" ? t.syncing : t.sync}
            </Button>
          </div>

          <div className="border-t border-line pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11"
              disabled={busy !== null}
              onClick={() =>
                run("disconnect", async () => {
                  await dropshipDisconnect(apiClient, workspaceId, provider.code);
                  toast.success(fmt(t.disconnectedToast, { name }));
                  onChanged();
                })
              }
            >
              {t.disconnect}
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}
