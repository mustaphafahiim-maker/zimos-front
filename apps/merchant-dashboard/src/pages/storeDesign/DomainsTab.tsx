import { useEffect, useState } from "react";
import { IconDelete, IconGlobe, IconStar, IconSuccess } from "@/components/icons";
import { Alert, Badge, Button, cn } from "@store-builder/ui";
import {
  domainCounterpartDnsManaged,
  domainDeploymentRules,
  domainSetRedirectToPrimary,
  funnelsList,
  isDomainsSectionClosed,
  storeDesignCheckDomainSsl,
  storeDesignDeleteDomain,
  storeDesignDomainDnsCheck,
  storeDesignDomainsOverview,
  storeDesignUpdateDomain,
  storeDesignVerifyDomain,
  type StoreDomain,
  type StoreDomainDnsCheck,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { AccordionSection } from "@/components/Accordion";
import { DataState } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import { SettingsGroup } from "@/components/settings";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { DomainRedirectSwitch } from "./DomainRedirectSwitch";
import { BuyDomainSection } from "./BuyDomainSection";
// Handoff 341: the verification TXT's own name, the server's rules, certificate states, a suspended domain, the closed section.
import {
  DomainAddForm,
  DomainCertificateState,
  DomainCertificateSummary,
  DomainRecordName,
  DomainRecordPurpose,
  DomainSuspendedNotice,
  DomainVerificationNotes,
  DomainsClosedNotice,
  noteCustomDomains,
  useDomainCertificateLabel,
  useDomainErrorMessage,
} from "./domainRules";
import { BoughtDomainsSection } from "./BoughtDomainsSection";
import { ToggleRow } from "./SettingsFormFooter";
import { GroupBlock, STACK, SettingsSkeleton, TOUCH_FIELDS } from "./sections/parts";

const STRINGS = {
  en: {
    addTitle: "Connect a domain",
    addDescription: "Use a domain you own (example.com — its www comes along), or a subdomain such as shop.example.com.",
    rootHint: "A domain without a subdomain can't use a CNAME: point it with the A records below.",
    alternativesTitle: "Or, if your DNS provider offers ALIAS / ANAME (CNAME flattening), use this instead of the A records:",
    counterpart: "Send {host} here too",
    counterpartHint: "Visitors who type {host} land on {domain}, same page.",
    counterpartAddRecord: "Add its record above.",
    counterpartManaged: "We set this up for you",
    counterpartSsl: "{host} certificate: {status}",
    hostname: "Domain",
    add: "Connect",
    adding: "Connecting…",
    emptyTitle: "No domain connected yet",
    emptyBody: "Your store already works on its free address. Connect your own domain to use it instead.",
    pending_verification: "Waiting for DNS",
    verified: "Verified",
    active: "Live",
    failed: "Failed",
    primary: "Primary",
    ssl: "SSL",
    ssl_none: "Not requested",
    ssl_pending: "Being issued",
    ssl_issued: "Secure",
    ssl_failed: "Failed",
    stepsTitle: "Add these records at your DNS provider",
    stepsHint: "Delete any other record on the same name that conflicts with them. Changes can take up to an hour to spread.",
    type: "Type",
    name: "Name",
    value: "Value",
    ttl: "TTL",
    copy: "Copy",
    found: "Found",
    notFound: "Not found yet",
    verify: "Verify domain",
    checkDns: "Check DNS",
    checkSsl: "Check certificate",
    makePrimary: "Make primary",
    remove: "Remove",
    homeFunnel: "Home funnel",
    homeFunnelHint: "The funnel that opens on this domain's root instead of the store home. Only published funnels are listed.",
    storeHome: "Store home page",
    verifiedToast: "Domain verified.",
    notVerifiedYet: "The verification record was not found yet. Add it and try again in a few minutes.",
    savedToast: "Domain updated.",
    removedToast: "Domain removed.",
    removeTitle: "Remove this domain?",
    removeBody: "Shoppers opening it will no longer reach your store. Your free store address keeps working.",
    testProvider: "Certificates are issued by a test provider for now: the status here does not mean a real certificate exists.",
    boughtDns: "Bought here: its DNS is set for you, nothing to add at a DNS provider.",
    noProvider: "No certificate provider is configured yet; certificates cannot be requested.",
  },
  ar: {
    addTitle: "ربط دومين",
    addDescription: "استخدم دومين تملكه (example.com — والـ www بتاعه معاه) أو دومين فرعي مثل shop.example.com.",
    rootHint: "الدومين من غير دومين فرعي مينفعش يتربط بـ CNAME: وجّهه بسجلات A اللي تحت.",
    alternativesTitle: "أو لو مزود الـ DNS عندك فيه ALIAS / ANAME (CNAME flattening)، استخدم ده بدل سجلات A:",
    counterpart: "ابعت {host} هنا كمان",
    counterpartHint: "اللي يكتب {host} هيوصل لـ {domain} على نفس الصفحة.",
    counterpartAddRecord: "ضيف السجل بتاعه فوق.",
    counterpartManaged: "جهزناه لك",
    counterpartSsl: "شهادة {host}: {status}",
    hostname: "الدومين",
    add: "ربط",
    adding: "بنربط…",
    emptyTitle: "مفيش دومين مربوط لسه",
    emptyBody: "متجرك يعمل بالفعل على عنوانه المجاني. اربط دومينك الخاص لاستخدامه بدلًا منه.",
    pending_verification: "في انتظار الـ DNS",
    verified: "تم التحقق",
    active: "يعمل",
    failed: "فشل",
    primary: "الأساسي",
    ssl: "SSL",
    ssl_none: "لم يُطلب",
    ssl_pending: "بنصدر",
    ssl_issued: "آمن",
    ssl_failed: "فشل",
    stepsTitle: "أضف هذه السجلات عند مزود الـ DNS",
    stepsHint: "احذف أي سجل آخر على نفس الاسم يتعارض معها. قد يستغرق انتشار التغيير حتى ساعة.",
    type: "النوع",
    name: "الاسم",
    value: "القيمة",
    ttl: "TTL",
    copy: "نسخ",
    found: "موجود",
    notFound: "غير موجود بعد",
    verify: "تحقق من الدومين",
    checkDns: "فحص الـ DNS",
    checkSsl: "فحص الشهادة",
    makePrimary: "اجعله الأساسي",
    remove: "حذف",
    homeFunnel: "مسار البيع الرئيسي",
    homeFunnelHint: "مسار البيع الذي يفتح على جذر هذا الدومين بدل الصفحة الرئيسية للمتجر. تظهر المسارات المنشورة فقط.",
    storeHome: "الصفحة الرئيسية للمتجر",
    verifiedToast: "تم التحقق من الدومين.",
    notVerifiedYet: "سجل التحقق غير موجود بعد. أضفه وحاول مرة أخرى بعد دقائق.",
    savedToast: "تم تحديث الدومين.",
    removedToast: "تم حذف الدومين.",
    removeTitle: "حذف هذا الدومين؟",
    removeBody: "من يفتحه لن يصل إلى متجرك. عنوان متجرك المجاني يظل يعمل.",
    testProvider: "الشهادات تصدر حاليًا من مزود تجريبي: الحالة هنا لا تعني وجود شهادة حقيقية.",
    boughtDns: "اتشترى من هنا: الـ DNS بتاعه متظبط لوحده، مش محتاج تضيف حاجة عند مزود DNS.",
    noProvider: "لم يُضبط مزود شهادات بعد؛ لا يمكن طلب شهادات.",
  },
} satisfies Messages;

export function DomainsTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const state = useAsync(() => storeDesignDomainsOverview(apiClient, workspaceId), [workspaceId]);
  const rules = domainDeploymentRules(state.data);
  const errorMessage = useDomainErrorMessage(rules.maxPerStore);
  const certificateLabel = useDomainCertificateLabel();
  // The settings menu and the setup guide hide "Domains" once the server says the section is closed.
  useEffect(() => noteCustomDomains(state.error, Boolean(state.data)), [state.error, state.data]);
  // Funnels are optional here: a role without funnel access still manages domains.
  const funnels = useAsync(() => funnelsList(apiClient, workspaceId).catch(() => []), [workspaceId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [dns, setDns] = useState<Record<string, StoreDomainDnsCheck>>({});
  const [removing, setRemoving] = useState<StoreDomain | null>(null);
  // Bumped after a purchase so "Bought domains" reads its list again.
  const [boughtVersion, setBoughtVersion] = useState(0);
  // Domains bought in the dashboard: the platform holds their DNS, so the merchant has no records to add.
  const [boughtDomainIds, setBoughtDomainIds] = useState<ReadonlySet<string>>(() => new Set());

  const publishedFunnels = (funnels.data ?? []).filter((f) => f.status === "published");

  /** Runs one action on a domain, then re-reads the list. */
  async function run(domain: StoreDomain, key: string, action: () => Promise<string | void>) {
    setBusy(`${domain.id}:${key}`);
    try {
      const message = await action();
      if (message) toast.success(message);
      await state.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const verify = (domain: StoreDomain) =>
    run(domain, "verify", async () => {
      await storeDesignVerifyDomain(apiClient, workspaceId, domain.id);
      // A verified domain asks for its certificate straight away.
      await storeDesignCheckDomainSsl(apiClient, workspaceId, domain.id).catch(() => undefined);
      return t.verifiedToast;
    });

  const statusTone = (status: StoreDomain["status"]) =>
    status === "active" ? "text-success" : status === "failed" ? "text-danger" : "text-ink-soft";

  // CUSTOM_DOMAINS_ENABLED closed the section on this server: said plainly, not as a failed load.
  if (isDomainsSectionClosed(state.error)) return <DomainsClosedNotice />;

  return (
    <DataState loading={state.loading} error={state.error} onRetry={() => void state.refresh()} skeleton={<SettingsSkeleton groups={2} rows={2} />}>
      <div className={STACK}>
        {state.data?.certificateProvider === "sandbox" && <Alert>{t.testProvider}</Alert>}
        {state.data && state.data.certificateProvider === null && <Alert variant="danger">{t.noProvider}</Alert>}

        {/* The section's one action first: connect a domain you own. Buying one is under the list. */}
        <SettingsGroup title={t.addTitle} description={t.addDescription}>
          <GroupBlock>
            <DomainAddForm rules={rules} count={state.data?.domains.length ?? 0} onAdded={() => state.refresh({ silent: true })} />
          </GroupBlock>
        </SettingsGroup>

        {state.data && state.data.domains.length === 0 ? (
          <EmptyState icon={<IconGlobe />} title={t.emptyTitle} description={t.emptyBody} />
        ) : (
          (state.data?.domains ?? []).map((domain) => {
            const usable = domain.status === "verified" || domain.status === "active";
            const check = dns[domain.id];
            const counterpart = domain.counterpart ?? null;
            // The counterpart still needs its record or its certificate.
            const counterpartPending = Boolean(counterpart?.redirect && counterpart.sslStatus !== "issued");
            // We created the counterpart's (www) record ourselves (a root domain bought here): nothing to add for it.
            const counterpartManaged = Boolean(counterpart?.redirect) && domainCounterpartDnsManaged(domain);
            const dnsHeldByUs = boughtDomainIds.has(domain.id);
            const recordsToAdd = counterpartManaged ? domain.records.filter((r) => r.purpose !== "redirect") : domain.records;
            // A certificate that "moved" means the records no longer point here: they are shown again.
            const moved = (domain.sslStatus as string) === "moved";
            const showSteps = !dnsHeldByUs && (domain.status !== "active" || moved || (counterpartPending && !counterpartManaged));
            const recordFound = (record: StoreDomain["records"][number]) =>
              !check
                ? null
                : record.type === "TXT"
                  ? check.txt.found
                  : record.purpose === "redirect"
                    ? (check.counterpart?.found ?? null)
                    : (check.routing?.found ?? check.cname.found);
            const isBusy = (key: string) => busy === `${domain.id}:${key}`;
            return (
              // One domain, folded to a row once it is live; a domain that still needs something opens by itself.
              <AccordionSection
                key={domain.id}
                title={domain.hostname}
                icon={IconGlobe}
                summary={
                  <span className={statusTone(domain.status)}>
                    {t[domain.status]} · <DomainCertificateSummary domain={domain} />
                  </span>
                }
                badge={
                  domain.isPrimary ? (
                    <Badge>
                      <IconStar className="size-3" aria-hidden />
                      {t.primary}
                    </Badge>
                  ) : undefined
                }
                defaultOpen={showSteps || !usable}
                persistKey={`store-settings:domains:${domain.id}`}
              >
                <div className={`space-y-4 ${TOUCH_FIELDS}`}>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-5">
                    <span className={cn("font-medium", statusTone(domain.status))}>{t[domain.status]}</span>
                    <DomainCertificateState domain={domain} />
                  </p>
                  <DomainSuspendedNotice domain={domain} />
                  {dnsHeldByUs && <p className="text-sm text-ink-soft">{t.boughtDns}</p>}
                  {showSteps && (
                    <div>
                      <p className="text-sm font-medium text-ink">{t.stepsTitle}</p>
                      <p className="mt-0.5 text-xs text-ink-soft">{t.stepsHint}</p>
                      {domain.isRoot && domain.records.some((r) => r.type === "A") && <p className="mt-0.5 text-xs text-ink-soft">{t.rootHint}</p>}
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[36rem] text-start text-sm">
                          <thead className="text-xs text-ink-soft">
                            <tr>
                              <th className="pb-2 pe-3 text-start font-medium">{t.type}</th>
                              <th className="pb-2 pe-3 text-start font-medium">{t.name}</th>
                              <th className="pb-2 pe-3 text-start font-medium">{t.value}</th>
                              <th className="pb-2 pe-3 text-start font-medium">{t.ttl}</th>
                              <th className="pb-2" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {recordsToAdd.map((record) => {
                              const result = recordFound(record);
                              return (
                                <tr key={`${record.type}-${record.name}-${record.value}`}>
                                  <td className="py-2 pe-3 font-medium text-ink">
                                    {record.type}
                                    <DomainRecordPurpose record={record} />
                                  </td>
                                  <td className="py-2 pe-3">
                                    <DomainRecordName record={record} domain={domain} />
                                  </td>
                                  <td className="py-2 pe-3">
                                    <bdi dir="ltr" className="break-all font-mono text-xs">
                                      {record.value}
                                    </bdi>
                                    {result !== null && (
                                      <span className={cn("ms-2 text-xs font-medium", result ? "text-success" : "text-danger")}>
                                        {result ? t.found : t.notFound}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 pe-3 text-ink-soft">{record.ttl}</td>
                                  <td className="py-2 text-end">
                                    <CopyButton value={record.value} label={t.copy} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <DomainVerificationNotes domain={domain} />
                      {(domain.alternatives ?? []).length > 0 && (
                        <div className="mt-3 rounded-lg bg-muted px-3 py-2">
                          <p className="text-xs text-ink-soft">{t.alternativesTitle}</p>
                          {(domain.alternatives ?? []).map((record) => (
                            <p key={`${record.type}-${record.name}`} className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-medium text-ink">{record.type}</span>
                              <bdi dir="ltr">{record.name}</bdi>
                              <span aria-hidden>→</span>
                              <bdi dir="ltr" className="break-all font-mono text-xs">
                                {record.value}
                              </bdi>
                              <CopyButton value={record.value} label={t.copy} />
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {counterpart && (
                    <div className="space-y-1">
                      <ToggleRow
                        label={fmt(t.counterpart, { host: counterpart.hostname })}
                        checked={counterpart.redirect}
                        disabled={isBusy("counterpart")}
                        onChange={(redirectCounterpart) =>
                          void run(domain, "counterpart", async () => {
                            await storeDesignUpdateDomain(apiClient, workspaceId, domain.id, { redirectCounterpart });
                            return t.savedToast;
                          })
                        }
                      />
                      <p className="text-xs text-ink-soft">
                        {fmt(t.counterpartHint, { host: counterpart.hostname, domain: domain.hostname })}
                        {counterpart.redirect && showSteps && !counterpartManaged && <> {t.counterpartAddRecord}</>}
                      </p>
                      {counterpartManaged && (
                        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                          <IconSuccess className="size-4 shrink-0" aria-hidden />
                          {t.counterpartManaged}
                        </p>
                      )}
                      {counterpart.redirect && usable && (
                        <p className="text-xs text-ink-soft">
                          {fmt(t.counterpartSsl, { host: counterpart.hostname, status: certificateLabel(counterpart.sslStatus) })}
                        </p>
                      )}
                    </div>
                  )}

                  {!domain.isPrimary && (
                    <DomainRedirectSwitch
                      domain={domain}
                      disabled={isBusy("redirect")}
                      onChange={(redirectToPrimary) =>
                        void run(domain, "redirect", async () => {
                          await domainSetRedirectToPrimary(apiClient, workspaceId, domain.id, redirectToPrimary);
                          return t.savedToast;
                        })
                      }
                    />
                  )}

                  {usable && (
                    <Field label={t.homeFunnel} hint={t.homeFunnelHint}>
                      {({ id }) => (
                        <Select
                          id={id}
                          value={domain.homeFunnel?.id ?? ""}
                          disabled={isBusy("funnel")}
                          onChange={(e) =>
                            void run(domain, "funnel", async () => {
                              await storeDesignUpdateDomain(apiClient, workspaceId, domain.id, {
                                homeFunnelId: e.target.value || null,
                              });
                              return t.savedToast;
                            })
                          }
                        >
                          <option value="">{t.storeHome}</option>
                          {/* Keeps a funnel that was unpublished after being chosen visible. */}
                          {domain.homeFunnel && !publishedFunnels.some((f) => f.id === domain.homeFunnel?.id) && (
                            <option value={domain.homeFunnel.id}>{domain.homeFunnel.name}</option>
                          )}
                          {publishedFunnels.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {!usable && (
                      <Button size="sm" className="min-h-11 rounded-full px-4 sm:min-h-8" disabled={isBusy("verify")} onClick={() => void verify(domain)}>
                        {t.verify}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 rounded-full px-4 sm:min-h-8"
                      disabled={isBusy("dns")}
                      onClick={() =>
                        void run(domain, "dns", async () => {
                          const result = await storeDesignDomainDnsCheck(apiClient, workspaceId, domain.id);
                          setDns((prev) => ({ ...prev, [domain.id]: result }));
                        })
                      }
                    >
                      {t.checkDns}
                    </Button>
                    {usable && (domain.sslStatus !== "issued" || counterpartPending) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11 rounded-full px-4 sm:min-h-8"
                        disabled={isBusy("ssl")}
                        onClick={() =>
                          void run(domain, "ssl", async () => {
                            const { detail } = await storeDesignCheckDomainSsl(apiClient, workspaceId, domain.id);
                            return detail ?? undefined;
                          })
                        }
                      >
                        {t.checkSsl}
                      </Button>
                    )}
                    {usable && !domain.isPrimary && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11 rounded-full px-4 sm:min-h-8"
                        disabled={isBusy("primary")}
                        onClick={() =>
                          void run(domain, "primary", async () => {
                            await storeDesignUpdateDomain(apiClient, workspaceId, domain.id, { isPrimary: true });
                            return t.savedToast;
                          })
                        }
                      >
                        {t.makePrimary}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="min-h-11 rounded-full px-4 sm:min-h-8" onClick={() => setRemoving(domain)}>
                      <IconDelete className="size-4 text-danger" />
                      {t.remove}
                    </Button>
                  </div>
                </div>
              </AccordionSection>
            );
          })
        )}

        {/* A subdomains-only server sells no domains (search and purchase answer APEX_NOT_SUPPORTED). */}
        {rules.subdomainsOnly ? null : <BuyDomainSection
          onBought={() => {
            setBoughtVersion((v) => v + 1);
            void state.refresh({ silent: true });
          }}
          onPurchaseFailed={() => {
            setBoughtVersion((v) => v + 1);
            // Bought but not connected (DOMAIN_CONNECT_FAILED) may still have added the domain.
            void state.refresh({ silent: true });
          }}
        />}

        <BoughtDomainsSection
          version={boughtVersion}
          onLoaded={(purchases) =>
            setBoughtDomainIds(new Set(purchases.filter((p) => p.status === "active" || p.status === "expired").flatMap((p) => (p.domainId ? [p.domainId] : []))))
          }
        />

        <ConfirmDialog
          open={removing !== null}
          title={t.removeTitle}
          description={t.removeBody}
          confirmLabel={t.remove}
          destructive
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            if (!removing) return;
            await storeDesignDeleteDomain(apiClient, workspaceId, removing.id);
            setRemoving(null);
            toast.success(t.removedToast);
            await state.refresh({ silent: true });
          }}
        />
      </div>
    </DataState>
  );
}
