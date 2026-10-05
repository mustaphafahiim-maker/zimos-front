import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import {
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

/**
 * Dropshipping suppliers: connect an account, import a product by the
 * supplier's code, copy its stock. The form is drawn from what the provider
 * says it needs, so a new provider needs no screen of its own.
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
    connecting: "جارٍ الربط…",
    disconnect: "فصل",
    connectedToast: "تم ربط {name}.",
    disconnectedToast: "تم فصل {name}.",
    importTitle: "استيراد منتج",
    importHint: "اكتب كود المنتج عند المورّد. هيتضاف كمسودة عشان تراجعه.",
    importHintTest: "المورّد التجريبي عنده SBX-1001 و SBX-1002.",
    code: "كود المنتج",
    import: "استيراد",
    importing: "جارٍ الاستيراد…",
    imported: "تم استيراد «{name}» كمسودة.",
    openProduct: "افتح المنتج",
    stockTitle: "المخزون",
    stockHint: "بينسخ مخزون المورّد الحالي على المنتجات اللي استوردتها.",
    sync: "حدّث المخزون دلوقتي",
    syncing: "جارٍ التحديث…",
    synced: "اتراجع {products} منتج واتحدّث {updated} نوع.",
    soonTitle: "قريبًا",
    soonHint: "المورّدين دول هيظهروا هنا أول ما الربط بتاعهم يجهز.",
    comingSoon: "قريبًا",
    none: "مفيش مورّد متاح لسه.",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

export function DropshipProviderPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const list = useAsync(() => dropshipProviders(apiClient, workspaceId), [workspaceId]);
  const providers = list.data?.providers ?? [];
  const planned = list.data?.planned ?? [];

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
        <div className="space-y-4">
          {providers.map((provider) => (
            <ProviderCard key={provider.code} t={t} provider={provider} onChanged={() => void list.refresh({ silent: true })} />
          ))}
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

function ProviderCard({ t, provider, onChanged }: { t: T; provider: DropshipProviderDto; onChanged: () => void }) {
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"connect" | "disconnect" | "import" | "sync" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [imported, setImported] = useState<{ id: string; name: string } | null>(null);

  async function run(kind: NonNullable<typeof busy>, work: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const connect = (e: FormEvent) => {
    e.preventDefault();
    void run("connect", async () => {
      await dropshipConnect(apiClient, workspaceId, provider.code, credentials);
      setCredentials({});
      toast.success(fmt(t.connectedToast, { name: provider.name }));
      onChanged();
    });
  };

  const importProduct = (e: FormEvent) => {
    e.preventDefault();
    void run("import", async () => {
      const { product } = await dropshipImport(apiClient, workspaceId, provider.code, code.trim());
      setImported({ id: product.id, name: product.name });
      setCode("");
    });
  };

  return (
    <Section
      title={provider.name}
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
          <Button type="submit" disabled={busy !== null}>
            {busy === "connect" ? t.connecting : t.connect}
          </Button>
        </form>
      ) : (
        <div className="space-y-5">
          <form onSubmit={importProduct} className="max-w-md space-y-2">
            <h3 className="text-sm font-medium text-ink">{t.importTitle}</h3>
            <p className="text-xs text-ink-soft">
              {t.importHint} {provider.isTest ? t.importHintTest : ""}
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextField label={t.code} labelHidden dir="ltr" placeholder={t.code} value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <Button type="submit" disabled={busy !== null || code.trim() === ""}>
                {busy === "import" ? t.importing : t.import}
              </Button>
            </div>
            {imported && (
              <Alert variant="success">
                {fmt(t.imported, { name: imported.name })}{" "}
                <Link to={`/catalog/${imported.id}`} className="font-medium underline">
                  {t.openProduct}
                </Link>
              </Alert>
            )}
          </form>

          <DropshipForwardSettings provider={provider} onChanged={onChanged} />

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-ink">{t.stockTitle}</h3>
            <p className="text-xs text-ink-soft">{t.stockHint}</p>
            <Button
              variant="outline"
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
              disabled={busy !== null}
              onClick={() =>
                run("disconnect", async () => {
                  await dropshipDisconnect(apiClient, workspaceId, provider.code);
                  toast.success(fmt(t.disconnectedToast, { name: provider.name }));
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
