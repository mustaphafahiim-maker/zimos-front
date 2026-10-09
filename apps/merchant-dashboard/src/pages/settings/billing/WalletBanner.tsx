import { Link } from "react-router-dom";
import { cn } from "@store-builder/ui";
import { accessStoppedByBalance, accessWalletOf } from "@store-builder/api-client";
import { IconWarning } from "@/components/icons";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, fmt } from "@/i18n/LocaleContext";
import { BILLING_STRINGS, TOPUP_PATH } from "./billingStrings";

/**
 * The prepaid balance of a pay-per-order store, above every page (handoff 335),
 * from `access.wallet` of GET /workspaces/:id/access: running low, below zero,
 * or run out (the store stopped taking orders). Drawn in the access banner's
 * own shell (`data-slot="access-banner"`), so it carries the same tinted glass.
 * Nothing while the balance is fine or the store pays no fee per order.
 */
export function WalletBalanceBanner({ access }: { access: object | null }) {
  const t = useT(BILLING_STRINGS);
  const { currentWorkspace } = useWorkspace();
  const wallet = accessWalletOf(access);
  const stopped = accessStoppedByBalance(access) || wallet?.phase === "exhausted";
  if (!stopped && (!wallet || wallet.phase === "ok")) return null;

  const text = stopped
    ? t.bannerExhausted
    : wallet!.phase === "overdraft"
      ? fmt(t.bannerOverdraft, { orders: Math.max(0, wallet!.ordersLeft ?? 0) })
      : fmt(t.bannerLow, { orders: Math.max(0, wallet!.ordersBeforeOverdraft ?? 0) });
  const danger = stopped || wallet?.phase === "overdraft";
  const canTopUp = ["owner", "accountant"].includes(currentWorkspace?.role ?? "");

  return (
    <div
      role={danger ? "alert" : "status"}
      data-testid="wallet-banner"
      data-slot="access-banner"
      data-tone={danger ? "danger" : "warning"}
      className={cn(
        "mb-4 flex flex-wrap items-start gap-x-2 gap-y-1 rounded-[1.25rem] border py-1.5 ps-4 pe-2 text-sm text-ink",
        danger ? "border-danger/30 bg-danger-soft" : "border-accent/30 bg-accent-soft"
      )}
    >
      <IconWarning
        weight="fill"
        data-slot="access-banner-icon"
        className={cn("me-1 mt-2 size-5 shrink-0 pointer-coarse:mt-3", danger ? "text-danger" : "text-accent-dark")}
        aria-hidden
      />
      <p className="min-w-0 flex-1 basis-40 py-1.5 pe-2 leading-6 pointer-coarse:py-2.5">{text}</p>
      {canTopUp && (
        <>
          <span aria-hidden className="order-1 basis-full sm:hidden" />
          <Link
            to={TOPUP_PATH}
            data-slot="access-banner-link"
            className="order-1 ms-8 mb-1 inline-flex min-h-11 shrink-0 items-center rounded-full bg-paper-raised px-4 text-[13px] font-semibold text-ink ring-1 ring-line-strong/40 transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 sm:order-none sm:ms-0 sm:mb-0 pointer-fine:min-h-9"
          >
            {t.topUp}
          </Link>
        </>
      )}
    </div>
  );
}
