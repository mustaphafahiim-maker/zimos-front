import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { IconKey, IconMoreVertical, IconRows, IconSwap, IconWarning } from "@/components/icons";
import { Alert, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@store-builder/ui";
import {
  apiFieldProblems,
  domainPurchaseManage,
  domainTransferCode,
  type DomainPurchase,
  type DomainTransferCode,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { CopyButton } from "@/components/CopyButton";
import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { useDomainPurchaseErrorMessage } from "./DomainOwnerStep";

/**
 * Store settings → Domains → "Bought domains", handoff item 385: each bought
 * domain's menu («سجلات DNS», and for the store's owner «نقل لمسجّل تاني»),
 * the «مفتوح للنقل» badge, and the transfer-out dialog. The transfer code is
 * shown once, lives only in this dialog's state and goes when it closes.
 */

const STRINGS = {
  en: {
    menu: "Manage {domain}",
    dns: "DNS records",
    transfer: "Transfer to another registrar",
    unlocked: "Unlocked for transfer",
    title: "Transfer {domain} out",
    warning: "Taking the code unlocks the domain and turns auto-renew off. The store keeps working on the domain as long as its DNS records stay the same",
    password: "Password",
    passwordWrong: "The password is not right",
    noPassword: "Set a password on your account first",
    show: "Show transfer code",
    showing: "Asking the registrar…",
    cancel: "Cancel",
    done: "Done",
    code: "Transfer code",
    copy: "Copy",
    keep: "Keep this code — we don't keep a copy",
    serverNote: "Auto-renew is off: renew the domain at its new registrar. The store stays connected while its DNS records stay as they are.",
    NOT_STORE_OWNER: "Only the store's owner can move the domain to another registrar",
    DOMAIN_TRANSFER_UNSUPPORTED: "This registrar doesn't give the code automatically — contact support",
    RATE_LIMITED: "Too many tries — try again in an hour",
    DOMAIN_NOT_ACTIVE: "This domain isn't active, so it can't be moved from here",
    DOMAIN_REGISTRAR_CHANGED: "This domain is no longer held by the registrar it was bought from — contact support",
  },
  ar: {
    menu: "إدارة {domain}",
    dns: "سجلات DNS",
    transfer: "نقل لمسجّل تاني",
    unlocked: "مفتوح للنقل",
    title: "نقل {domain} لمسجّل تاني",
    warning: "لما تاخد الكود، الدومين بيتفتح للنقل والتجديد التلقائي بيتقفل. المتجر هيفضل شغال على الدومين طول ما سجلات DNS زي ما هي",
    password: "كلمة السر",
    passwordWrong: "كلمة السر دي مش صح",
    noPassword: "اعمل باسورد لحسابك الأول",
    show: "إظهار كود النقل",
    showing: "بنطلب الكود من المسجّل…",
    cancel: "إلغاء",
    done: "تمام",
    code: "كود النقل",
    copy: "نسخ",
    keep: "احتفظ بالكود — إحنا مش بنحتفظ بنسخة منه",
    serverNote: "التجديد التلقائي اتقفل: جدّد الدومين عند المسجّل الجديد. المتجر هيفضل متوصل طول ما سجلات DNS زي ما هي.",
    NOT_STORE_OWNER: "صاحب المتجر بس هو اللي يقدر ينقل الدومين لمسجّل تاني",
    DOMAIN_TRANSFER_UNSUPPORTED: "الكود ده مش متاح أوتوماتيك عند المسجّل ده — كلّم الدعم",
    RATE_LIMITED: "محاولات كتير — جرّب بعد ساعة",
    DOMAIN_NOT_ACTIVE: "الدومين ده مش شغال، فمينفعش يتنقل من هنا",
    DOMAIN_REGISTRAR_CHANGED: "الدومين ده مبقاش عند المسجّل اللي اتشترى منه — كلّم الدعم",
  },
} satisfies Messages;

/** The server's one note about a transfer, in English; anything else it may say is shown as it is. */
const SERVER_NOTE = /^Auto-renew is off/i;

/** «مفتوح للنقل» beside a bought domain's status, once its owner took the transfer code. */
export function TransferUnlockedBadge({ purchase }: { purchase: DomainPurchase }) {
  const t = useT(STRINGS);
  if (!domainPurchaseManage(purchase).transferUnlockedAt) return null;
  return <StatusBadge value="unlocked" tone="warning" text={t.unlocked} />;
}

interface BoughtDomainMenuProps {
  purchase: DomainPurchase;
  disabled?: boolean;
  /** The purchase as the server has it after the transfer code was taken (auto-renew off, unlocked). */
  onChanged: (purchase: DomainPurchase) => void;
}

/**
 * The row's menu. Each action shows only where the domain's registrar offers
 * it (`manage`), and the transfer only to the store's owner — nobody else can
 * take the code (403 NOT_STORE_OWNER). Nothing to offer: no menu.
 */
export function BoughtDomainMenu({ purchase, disabled, onChanged }: BoughtDomainMenuProps) {
  const t = useT(STRINGS);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [transferring, setTransferring] = useState(false);
  const manage = domainPurchaseManage(purchase);
  const isOwner = Boolean(user && currentWorkspace && currentWorkspace.ownerUserId === user.id);
  const canTransfer = manage.transferCode && isOwner;
  if (!manage.dnsRecords && !canTransfer) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 min-w-11 px-2 md:min-h-8 md:min-w-8"
              aria-label={fmt(t.menu, { domain: purchase.hostname })}
              disabled={disabled}
            />
          }
        >
          <IconMoreVertical className="size-5" weight="bold" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-52">
          {manage.dnsRecords && (
            <DropdownMenuItem className="min-h-11 gap-2 md:min-h-9" onClick={() => navigate(`/domains/purchases/${purchase.id}/dns`)}>
              <IconRows className="size-4" aria-hidden />
              {t.dns}
            </DropdownMenuItem>
          )}
          {canTransfer && (
            <DropdownMenuItem className="min-h-11 gap-2 md:min-h-9" onClick={() => setTransferring(true)}>
              <IconSwap className="size-4" aria-hidden />
              {t.transfer}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {transferring && <DomainTransferDialog purchase={purchase} onClose={() => setTransferring(false)} onUnlocked={onChanged} />}
    </>
  );
}

interface DomainTransferDialogProps {
  purchase: DomainPurchase;
  onClose: () => void;
  onUnlocked: (purchase: DomainPurchase) => void;
}

/**
 * «نقل لمسجّل تاني»: the warning, the owner's password, then the code in a box
 * with «نسخ». The code is in this component's state only — never cached, never
 * in the address — so closing the dialog (which unmounts it) forgets it.
 */
function DomainTransferDialog({ purchase, onClose, onUnlocked }: DomainTransferDialogProps) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useDomainPurchaseErrorMessage();
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DomainTransferCode | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    setPasswordError(undefined);
    try {
      const answer = await domainTransferCode(apiClient, workspaceId, purchase.id, password);
      setPassword("");
      setResult(answer);
      // The row now says auto-renew off and «مفتوح للنقل»; the code itself stays here.
      onUnlocked({ ...purchase, ...answer.purchase });
    } catch (err) {
      const problem = apiFieldProblems(err).find((p) => p.field === "password");
      if (problem) setPasswordError(/set a password/i.test(problem.message) ? t.noPassword : t.passwordWrong);
      else
        setError(
          errorMessage(err, {
            NOT_STORE_OWNER: t.NOT_STORE_OWNER,
            DOMAIN_TRANSFER_UNSUPPORTED: t.DOMAIN_TRANSFER_UNSUPPORTED,
            RATE_LIMITED: t.RATE_LIMITED,
            DOMAIN_NOT_ACTIVE: t.DOMAIN_NOT_ACTIVE,
            DOMAIN_REGISTRAR_CHANGED: t.DOMAIN_REGISTRAR_CHANGED,
          })
        );
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    if (!busy) onClose();
  };
  const formId = `transfer-${purchase.id}`;

  return (
    <Modal
      open
      onClose={close}
      title={fmt(t.title, { domain: `⁦${purchase.hostname}⁩` })}
      footer={
        result ? (
          <Button type="button" className="min-h-11 sm:min-h-0" onClick={onClose}>
            {t.done}
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" className="min-h-11 sm:min-h-0" disabled={busy} onClick={close}>
              {t.cancel}
            </Button>
            <Button type="submit" form={formId} className="min-h-11 sm:min-h-0" disabled={busy || !password}>
              <IconKey className="size-4" aria-hidden />
              {busy ? t.showing : t.show}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <div className="rounded-[var(--radius-card)] bg-paper-sunken px-4 py-3">
            <p className="text-xs text-ink-soft">{t.code}</p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <bdi dir="ltr" className="break-all font-mono text-lg font-semibold text-ink select-all">
                {result.authCode}
              </bdi>
              <CopyButton value={result.authCode} label={t.copy} className="min-h-11 text-sm" />
            </div>
          </div>
          <p className="flex items-start gap-2 rounded-[var(--radius)] bg-accent-soft px-3 py-2 text-sm font-medium text-accent-dark">
            <IconKey className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t.keep}
          </p>
          {result.note && (
            <p dir="auto" className="text-sm text-ink-soft">
              {SERVER_NOTE.test(result.note) ? t.serverNote : result.note}
            </p>
          )}
        </div>
      ) : (
        <form id={formId} onSubmit={submit} noValidate className="space-y-4">
          <Alert className="border-accent/40 bg-accent-soft text-accent-dark">
            <IconWarning aria-hidden />
            <p className="font-medium">{t.warning}</p>
          </Alert>
          <TextField
            label={t.password}
            type="password"
            autoComplete="current-password"
            dir="ltr"
            value={password}
            error={passwordError}
            disabled={busy}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError(undefined);
            }}
          />
          {error && <Alert variant="danger">{error}</Alert>}
        </form>
      )}
    </Modal>
  );
}
