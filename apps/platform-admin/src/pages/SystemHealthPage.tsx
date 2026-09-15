import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Alert, Button, useAsync } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { DetailRow } from "@/components/Drawer";
import { Mono, Panel } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { adminApi, type AdminSystem } from "@/lib/adminApi";
import { formatDuration, formatNumber } from "@/lib/format";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "System health",
    description: "What is actually configured on the API server right now.",
    runtime: "Runtime",
    environment: "Environment",
    node: "Node.js",
    uptime: "Uptime",
    database: "Database",
    connection: "Connection",
    connected: "Connected",
    unreachable: "Unreachable",
    migrations: "Migrations",
    migrationsValue: "{applied} of {files} applied",
    pending: "Pending migrations",
    noPending: "None",
    pendingWarn: "{n} migration(s) haven't been applied on this server.",
    integrations: "Integrations",
    storage: "Media storage",
    email: "Email provider",
    sms: "SMS provider",
    whatsapp: "WhatsApp provider",
    webhook: "Billing webhook secret",
    gateway: "Payment gateway",
    google: "Google sign-in",
    configured: "Configured",
    notConfigured: "Not configured",
    connectedGw: "Connected",
    notConnected: "Not connected",
    consoleProvider: "console (messages are only logged)",
  },
  ar: {
    title: "صحة النظام",
    description: "اللي متظبط فعلًا على سيرفر الـ API دلوقتي.",
    runtime: "التشغيل",
    environment: "البيئة",
    node: "Node.js",
    uptime: "مدة التشغيل",
    database: "قاعدة البيانات",
    connection: "الاتصال",
    connected: "متصلة",
    unreachable: "مش متاحة",
    migrations: "الـ Migrations",
    migrationsValue: "{applied} من {files} اتطبقت",
    pending: "Migrations مستنية",
    noPending: "مفيش",
    pendingWarn: "فيه {n} migration لسه ماتطبقتش على السيرفر ده.",
    integrations: "التكاملات",
    storage: "تخزين الميديا",
    email: "مزود الإيميل",
    sms: "مزود الرسائل SMS",
    whatsapp: "مزود واتساب",
    webhook: "سر webhook الفوترة",
    gateway: "بوابة الدفع",
    google: "الدخول بجوجل",
    configured: "متظبط",
    notConfigured: "مش متظبط",
    connectedGw: "متوصلة",
    notConnected: "مش متوصلة",
    consoleProvider: "console (الرسايل بتتسجل بس)",
  },
};

export function SystemHealthPage() {
  const t = useT(STRINGS);
  const c = useCommon();
  const { data, loading, error, refresh } = useAsync(() => adminApi.system(), []);
  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> {c.refresh}
          </Button>
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {data && <Body s={data} />}
      </DataState>
    </div>
  );
}

function Flag({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <StatusBadge tone={ok ? "success" : "warning"} dot>
      {ok ? yes : no}
    </StatusBadge>
  );
}

function Body({ s }: { s: AdminSystem }) {
  const t = useT(STRINGS);
  const provider = (v?: string): ReactNode => (!v ? "—" : v === "console" ? <StatusBadge tone="warning" dot>{t.consoleProvider}</StatusBadge> : <Mono>{v}</Mono>);
  const dbOk = s.database === "connected";
  return (
    <div className="space-y-4">
      {s.migrations.pending.length > 0 && <Alert variant="warning">{fmt(t.pendingWarn, { n: s.migrations.pending.length })}</Alert>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title={t.runtime}>
          <dl>
            <DetailRow label={t.environment}>
              <Mono>{s.environment}</Mono>
            </DetailRow>
            <DetailRow label={t.node}>
              <Mono>{s.node}</Mono>
            </DetailRow>
            <DetailRow label={t.uptime}>
              <span dir="ltr">{formatDuration(s.uptimeSeconds)}</span>
            </DetailRow>
          </dl>
        </Panel>
        <Panel title={t.database}>
          <dl>
            <DetailRow label={t.connection}>
              <StatusBadge tone={dbOk ? "success" : "danger"} dot>
                {dbOk ? t.connected : t.unreachable}
              </StatusBadge>
            </DetailRow>
            <DetailRow label={t.migrations}>{fmt(t.migrationsValue, { applied: formatNumber(s.migrations.applied), files: formatNumber(s.migrations.files) })}</DetailRow>
            <DetailRow label={t.pending}>
              {s.migrations.pending.length === 0 ? (
                t.noPending
              ) : (
                <ul className="space-y-1" dir="ltr">
                  {s.migrations.pending.map((m) => (
                    <li key={m}>
                      <Mono>{m}</Mono>
                    </li>
                  ))}
                </ul>
              )}
            </DetailRow>
          </dl>
        </Panel>
        <Panel title={t.integrations} className="xl:col-span-2">
          <dl>
            <DetailRow label={t.storage}>
              <Mono>{s.storage}</Mono>
            </DetailRow>
            <DetailRow label={t.email}>{provider(s.notifications.email)}</DetailRow>
            <DetailRow label={t.sms}>{provider(s.notifications.sms)}</DetailRow>
            <DetailRow label={t.whatsapp}>{provider(s.notifications.whatsapp)}</DetailRow>
            <DetailRow label={t.webhook}>
              <Flag ok={s.billingWebhookSecretConfigured} yes={t.configured} no={t.notConfigured} />
            </DetailRow>
            <DetailRow label={t.gateway}>
              <Flag ok={s.paymentGatewayConnected} yes={t.connectedGw} no={t.notConnected} />
            </DetailRow>
            <DetailRow label={t.google}>
              <Flag ok={s.googleOAuthConfigured} yes={t.configured} no={t.notConfigured} />
            </DetailRow>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
