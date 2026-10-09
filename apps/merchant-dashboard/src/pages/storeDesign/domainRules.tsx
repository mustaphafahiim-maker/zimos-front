import { useCallback, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { IconGlobe, IconWarning } from "@/components/icons";
import { Alert, Button, Input, buttonVariants, cn } from "@store-builder/ui";
import {
  ApiError,
  apiErrorDetails,
  apiFieldProblems,
  domainStateExtras,
  isApiErrorCode,
  storeDesignAddDomain,
  type DomainApexNotSupportedDetails,
  type DomainDeploymentRules,
  type StoreDomain,
  type StoreDomainRecord,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage, type ErrorOverrides } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { CopyButton } from "@/components/CopyButton";
import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import { DOMAIN_CONNECT_ANCHOR } from "./DomainPurchaseAvailability";
import { FIELD } from "./sections/parts";

/**
 * Store settings → Domains, handoff item 341: the verification TXT on its own
 * name (`_zimos-verify`), the server's deployment rules (subdomains only, a
 * cap per store, a time limit to verify, the whole section closed), the
 * certificate's states and a suspended domain. DomainsTab.tsx mounts the
 * pieces; the wording is the handoff's.
 */

const STRINGS = {
  en: {
    closedTitle: "Custom domains aren't available right now",
    closedBody: "Your store keeps working on its free address. A domain that was already connected still opens the store.",
    hostname: "Domain",
    hintAny: "Type the domain, e.g. ahmedstore.com or shop.ahmedstore.com",
    hintSubdomain: "Type a subdomain, e.g. www.ahmedstore.com or shop.ahmedstore.com",
    add: "Connect",
    adding: "Connecting…",
    limitReached: "You've reached the most domains ({max}) — remove one first",
    limitReachedPlain: "You've reached the most domains — remove one first",
    invalidHostname: "Enter a valid domain like www.ahmedstore.com",
    ownSubdomain: "That's a Zimos address — it already works, no setup needed",
    useSuggestion: "Use {suggestion}",
    DOMAIN_NOT_ALLOWED: "This domain can't be connected to a store",
    APEX_NOT_SUPPORTED: "Connect a subdomain such as {suggestion}, and forward the main domain to it at your domain registrar",
    apexNoSuggestion: "Connect a subdomain such as www.ahmedstore.com, and forward the main domain to it at your domain registrar",
    DOMAIN_ALREADY_ADDED: "This domain is already on your store",
    DOMAIN_TAKEN: "This domain is connected to another store",
    DOMAIN_VERIFICATION_EXPIRED: "It wasn't verified in time — remove it and add it again",
    RATE_LIMITED: "Too many tries — try again in a minute",
    notVerified: "The TXT record isn't on {name} yet — add it at your DNS provider and try again in a few minutes",
    notVerifiedPlain: "The ownership TXT record wasn't found yet — add it at your DNS provider and try again in a few minutes",
    ownership: "Ownership proof",
    shortName: "Name: {host}",
    copy: "Copy",
    oldPlace: "If you already added the TXT on the domain itself before, it still works",
    verifyBy: "Verify the domain before {date} or it will be removed",
    cert_none: "No certificate yet",
    cert_pending: "Certificate in progress",
    cert_issued: "Certificate active",
    cert_failed: "Certificate failed",
    cert_moved: "The domain no longer points at the store",
    certPendingHint: "We follow it automatically — nothing to do",
    certMovedHint: "Check the DNS records, then press Check again",
    suspendedStore: "This domain is paused because the store is suspended",
    suspendedPlan: "This domain is paused — your plan doesn't include a custom domain",
    suspendedOther: "This domain is paused",
    upgrade: "Upgrade plan",
    paused: "Paused",
  },
  ar: {
    closedTitle: "ربط دومين خاص مش متاح دلوقتي",
    closedBody: "متجرك شغال على عنوانه المجاني. والدومين اللي كان مربوط قبل كده لسه بيفتح المتجر.",
    hostname: "الدومين",
    hintAny: "اكتب الدومين، مثلًا ahmedstore.com أو shop.ahmedstore.com",
    hintSubdomain: "اكتب دومين فرعي، مثلًا www.ahmedstore.com أو shop.ahmedstore.com",
    add: "ربط",
    adding: "بنربط…",
    limitReached: "وصلت لأقصى عدد دومينات ({max}) — امسح واحد الأول",
    limitReachedPlain: "وصلت لأقصى عدد دومينات — امسح واحد الأول",
    invalidHostname: "اكتب دومين صحيح زي www.ahmedstore.com",
    ownSubdomain: "ده عنوان زيموس وشغال خلاص — مش محتاج أي إعداد",
    useSuggestion: "استخدم {suggestion}",
    DOMAIN_NOT_ALLOWED: "الدومين ده مينفعش يتوصل بمتجر",
    APEX_NOT_SUPPORTED: "وصّل دومين فرعي زي {suggestion}، وحوّل الدومين الأساسي له من عند شركة الدومين",
    apexNoSuggestion: "وصّل دومين فرعي زي www.ahmedstore.com، وحوّل الدومين الأساسي له من عند شركة الدومين",
    DOMAIN_ALREADY_ADDED: "الدومين ده متضاف للمتجر خلاص",
    DOMAIN_TAKEN: "الدومين ده متوصل بمتجر تاني",
    DOMAIN_VERIFICATION_EXPIRED: "عدّت المدة ومتأكدش — امسحه وضيفه تاني",
    RATE_LIMITED: "محاولات كتير — جرّب بعد دقيقة",
    notVerified: "سجل الـ TXT لسه مش موجود على {name} — ضيفه عند مزوّد الـ DNS وجرّب تاني بعد كام دقيقة",
    notVerifiedPlain: "سجل إثبات الملكية (TXT) لسه مش موجود — ضيفه عند مزوّد الـ DNS وجرّب تاني بعد كام دقيقة",
    ownership: "إثبات الملكية",
    shortName: "الاسم: {host}",
    copy: "نسخ",
    oldPlace: "لو كنت ضفت سجل TXT على الدومين نفسه قبل كده، هيشتغل برضه",
    verifyBy: "لازم تأكد الدومين قبل {date} وإلا هيتمسح",
    cert_none: "مفيش شهادة لسه",
    cert_pending: "الشهادة بتتجهز",
    cert_issued: "الشهادة شغالة",
    cert_failed: "الشهادة فشلت",
    cert_moved: "الدومين مبقاش متوجه للمتجر",
    certPendingHint: "بنتابعها تلقائي — مش لازم تعمل حاجة",
    certMovedHint: "راجع سجلات الـ DNS وبعدين اضغط افحص تاني",
    suspendedStore: "الدومين متوقف لأن المتجر موقوف",
    suspendedPlan: "الدومين متوقف — باقتك مش فيها دومين خاص",
    suspendedOther: "الدومين متوقف",
    upgrade: "رقّي الباقة",
    paused: "متوقف",
  },
} satisfies Messages;

type T = (typeof STRINGS)["en"];

// ---------------------------------------------------- the closed section ----

// Whether the section is closed is learned and shared in customDomainsGate.ts.
export { noteCustomDomains } from "./customDomainsGate";

/** In place of the Domains tab when the section is closed: not an error, and nothing to retry. */
export function DomainsClosedNotice() {
  const t = useT(STRINGS);
  return <EmptyState icon={<IconGlobe />} title={t.closedTitle} description={t.closedBody} />;
}

// ------------------------------------------------------------- the errors ----

/** The domain screens' sentences for the domain codes; a caller's own overrides win. */
export function useDomainErrorMessage(maxPerStore?: number | null) {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  return useCallback(
    (err: unknown, overrides?: ErrorOverrides): string => {
      const suggestion = apiErrorDetails<DomainApexNotSupportedDetails>(err)?.suggestion;
      // The server names where it looked (_zimos-verify.<hostname>); the name is kept, the sentence is ours.
      const lookedOn = err instanceof ApiError ? / on (_zimos-verify.[a-z0-9.-]+) yet/i.exec(err.message)?.[1] : undefined;
      return errorMessage(err, {
        DOMAIN_NOT_ALLOWED: t.DOMAIN_NOT_ALLOWED,
        APEX_NOT_SUPPORTED: suggestion ? fmt(t.APEX_NOT_SUPPORTED, { suggestion: `⁦${suggestion}⁩` }) : t.apexNoSuggestion,
        DOMAIN_ALREADY_ADDED: t.DOMAIN_ALREADY_ADDED,
        DOMAIN_NOT_VERIFIED: lookedOn ? fmt(t.notVerified, { name: `⁦${lookedOn}⁩` }) : t.notVerifiedPlain,
        DOMAIN_TAKEN: t.DOMAIN_TAKEN,
        DOMAIN_LIMIT_REACHED: maxPerStore ? fmt(t.limitReached, { max: maxPerStore }) : t.limitReachedPlain,
        DOMAIN_VERIFICATION_EXPIRED: t.DOMAIN_VERIFICATION_EXPIRED,
        RATE_LIMITED: t.RATE_LIMITED,
        ...overrides,
      });
    },
    [t, errorMessage, maxPerStore]
  );
}

// ---------------------------------------------------------- add a domain ----

interface DomainAddFormProps {
  rules: DomainDeploymentRules;
  /** How many domains the store holds now, verified or not. */
  count: number;
  onAdded: () => Promise<unknown> | void;
}

/**
 * "Connect a domain": the hint follows the server's rules (subdomains only or
 * not), the button is off once the store holds as many domains as the server
 * allows, and a refused root domain offers the subdomain to use instead.
 */
export function DomainAddForm({ rules, count, onAdded }: DomainAddFormProps) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useDomainErrorMessage(rules.maxPerStore);
  const [hostname, setHostname] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const full = rules.maxPerStore !== null && count >= rules.maxPerStore;

  async function add(e: FormEvent) {
    e.preventDefault();
    const value = hostname.trim();
    if (!value || adding || full) return;
    setAdding(true);
    setError(null);
    setSuggestion(null);
    try {
      await storeDesignAddDomain(apiClient, workspaceId, value);
      setHostname("");
      await onAdded();
    } catch (err) {
      const problem = apiFieldProblems(err).find((p) => p.field === "hostname");
      if (problem) setError(/subdomain/i.test(problem.message) ? t.ownSubdomain : t.invalidHostname);
      else setError(errorMessage(err));
      if (isApiErrorCode(err, "APEX_NOT_SUPPORTED")) setSuggestion(apiErrorDetails<DomainApexNotSupportedDetails>(err)?.suggestion ?? null);
    } finally {
      setAdding(false);
    }
  }

  return (
    // The id is where "Buy a domain" points when buying is not available (DomainPurchaseAvailability.tsx).
    <form id={DOMAIN_CONNECT_ANCHOR} onSubmit={add} className="scroll-mt-24 space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        <Field
          label={t.hostname}
          error={error ?? undefined}
          hint={full ? undefined : rules.subdomainsOnly ? t.hintSubdomain : t.hintAny}
          labelHidden
          className="min-w-0 flex-1 basis-56"
        >
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              dir="ltr"
              inputMode="url"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              placeholder={rules.subdomainsOnly ? "www.example.com" : "shop.example.com"}
              value={hostname}
              disabled={adding || full}
              onChange={(e) => setHostname(e.target.value)}
              className={FIELD}
            />
          )}
        </Field>
        <Button type="submit" className="min-h-11 rounded-full px-5" disabled={adding || full || !hostname.trim()}>
          {adding ? t.adding : t.add}
        </Button>
      </div>
      {suggestion && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 rounded-full px-4 sm:min-h-8"
          onClick={() => {
            setHostname(suggestion);
            setError(null);
            setSuggestion(null);
          }}
        >
          {fmt(t.useSuggestion, { suggestion: `⁦${suggestion}⁩` })}
        </Button>
      )}
      {full && (
        <p role="status" className="text-sm font-medium text-accent-dark">
          {fmt(t.limitReached, { max: rules.maxPerStore ?? "" })}
        </p>
      )}
    </form>
  );
}

// ------------------------------------------------- the verification record ----

/** Second-level labels that are part of a public ending (example.com.eg, example.co.uk). */
const SECOND_LEVEL = new Set(["co", "com", "net", "org", "gov", "edu", "ac"]);

/**
 * What most DNS panels want in their "Name / Host" box: the record's name
 * without the domain the zone is for — `_zimos-verify` for ahmedstore.com,
 * `_zimos-verify.www` for www.ahmedstore.com. The zone is the root domain
 * where we know it (the domain itself, or the counterpart of its www), the
 * registrable part of the name otherwise.
 */
export function domainRecordHost(recordName: string, domain: StoreDomain): string {
  const labels = domain.hostname.split(".");
  const tldSize = labels.length >= 3 && (labels.at(-1) ?? "").length === 2 && SECOND_LEVEL.has(labels.at(-2) ?? "") ? 3 : 2;
  const zone = domain.isRoot
    ? domain.hostname
    : domain.counterpart && domain.hostname === `www.${domain.counterpart.hostname}`
      ? domain.counterpart.hostname
      : labels.slice(-tldSize).join(".");
  if (recordName === zone) return "@";
  return recordName.endsWith(`.${zone}`) ? recordName.slice(0, -(zone.length + 1)) : recordName;
}

/** The record's purpose under its type: only the ownership proof is named. */
export function DomainRecordPurpose({ record }: { record: StoreDomainRecord }) {
  const t = useT(STRINGS);
  if (record.type !== "TXT" || record.purpose !== "verification") return null;
  return <span className="block text-xs font-normal text-ink-soft">{t.ownership}</span>;
}

/**
 * The "Name" cell of a DNS record. The ownership proof shows the short host
 * («الاسم: _zimos-verify») with a copy button and the full name in small text;
 * every other record shows its name as before.
 */
export function DomainRecordName({ record, domain }: { record: StoreDomainRecord; domain: StoreDomain }) {
  const t = useT(STRINGS);
  if (record.type !== "TXT" || record.purpose !== "verification") return <bdi dir="ltr">{record.name}</bdi>;
  const host = domainRecordHost(record.name, domain);
  const [before, after] = t.shortName.split("{host}");
  return (
    <span className="flex flex-col items-start gap-0.5">
      <span className="inline-flex flex-wrap items-center gap-x-2">
        <span>
          {before}
          <bdi dir="ltr" className="font-mono text-xs font-medium text-ink">
            {host}
          </bdi>
          {after}
        </span>
        <CopyButton value={host} label={t.copy} />
      </span>
      <bdi dir="ltr" className="break-all text-xs text-ink-soft">
        {record.name}
      </bdi>
    </span>
  );
}

/** Under the records of a domain still to verify: the old place still works, and the time limit when there is one. */
export function DomainVerificationNotes({ domain }: { domain: StoreDomain }) {
  const t = useT(STRINGS);
  if (domain.status !== "pending_verification" && domain.status !== "failed") return null;
  const { verifyBy } = domainStateExtras(domain);
  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs text-ink-soft">{t.oldPlace}</p>
      {verifyBy && <p className="text-xs font-medium text-accent-dark">{fmt(t.verifyBy, { date: formatDateTime(verifyBy) })}</p>}
    </div>
  );
}

// ---------------------------------------------------------- certificate ----

const CERT_TONE: Record<string, string> = {
  issued: "text-success",
  failed: "text-danger",
  moved: "text-danger",
};

function certificateText(t: T, status: string): string {
  return (t as Record<string, string>)[`cert_${status}`] ?? status;
}

/** The certificate's state as a sentence, for a line that names a host («شهادة www…: …»). */
export function useDomainCertificateLabel(): (status: string) => string {
  const t = useT(STRINGS);
  return useCallback((status: string) => certificateText(t, status), [t]);
}

/** One line for the folded row: the certificate's state, or "Paused" for a suspended domain. */
export function DomainCertificateSummary({ domain }: { domain: StoreDomain }) {
  const t = useT(STRINGS);
  if (domainStateExtras(domain).suspended) return <>{t.paused}</>;
  return <>{certificateText(t, domain.sslStatus)}</>;
}

/**
 * The certificate badge of an open domain: its state, what (not) to do about
 * it, and — for a failed or moved certificate — the provider's own reason.
 */
export function DomainCertificateState({ domain }: { domain: StoreDomain }) {
  const t = useT(STRINGS);
  const status: string = domain.sslStatus;
  const { sslDetail } = domainStateExtras(domain);
  const hint = status === "pending" ? t.certPendingHint : status === "moved" ? t.certMovedHint : null;
  return (
    <span className="min-w-0">
      <span className={cn("font-medium", CERT_TONE[status] ?? "text-ink-soft")}>{certificateText(t, status)}</span>
      {hint && <span className="text-ink-soft"> · {hint}</span>}
      {(status === "failed" || status === "moved") && sslDetail && (
        <span dir="auto" className="mt-0.5 block text-xs text-ink-soft">
          {sslDetail}
        </span>
      )}
    </span>
  );
}

// ------------------------------------------------------------ suspended ----

/** A suspended domain's warning; it goes by itself once the reason is gone. */
export function DomainSuspendedNotice({ domain }: { domain: StoreDomain }) {
  const t = useT(STRINGS);
  const { suspended, suspendedReason } = domainStateExtras(domain);
  if (!suspended) return null;
  return (
    <Alert className="border-accent/40 bg-accent-soft text-accent-dark">
      <IconWarning aria-hidden />
      <div className="space-y-2">
        <p className="font-medium">
          {suspendedReason === "store_suspended" ? t.suspendedStore : suspendedReason === "plan" ? t.suspendedPlan : t.suspendedOther}
        </p>
        {suspendedReason === "plan" && (
          <Link to="/settings?tab=billing" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11 bg-paper-raised sm:min-h-8")}>
            {t.upgrade}
          </Link>
        )}
      </div>
    </Alert>
  );
}
