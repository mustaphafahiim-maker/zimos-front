import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { storesOverview, type StoreOverview, type Workspace } from "@store-builder/api-client";
import { IconCaretRight, IconPlus, IconStore } from "@/components/icons";
import { SkeletonBar } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { storeHost } from "@/lib/storeAddress";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { AUTH_SUBMIT, AuthFooter, AuthHeading, AuthLinkButton, AuthShell } from "./AuthShell";
import { InvitesWaitingLine } from "@/components/account/InvitesLink";
import {
  CreateStoreFields,
  CreateStoreSheet,
  StoreCreated,
  StoreCreatedActions,
  useCreateStoreForm,
  useCreateStoreLabels,
} from "./stores/createStore";

const STRINGS = {
  en: {
    choose: "Choose a store",
    chooseBody: "Open the store you want to work in.",
    setUp: "Let's set up your store",
    setUpBody: "Name it and choose its address. You can change both later.",
    signedInAs: "Signed in as",
    signOut: "Sign out",
    open: "Open {name}",
    newStore: "New store",
    draft: "Draft",
    suspended: "Suspended",
    live: "Live",
    loading: "Loading your stores…",
    stores: "Your stores",
  },
  ar: {
    choose: "اختار متجر",
    chooseBody: "افتح المتجر اللي عايز تشتغل فيه.",
    setUp: "يلا نجهّز متجرك",
    setUpBody: "سمّيه واختار عنوانه. تقدر تغيّر الاتنين بعدين.",
    signedInAs: "داخل بـ",
    signOut: "اخرج",
    open: "افتح {name}",
    newStore: "متجر جديد",
    draft: "مسودة",
    suspended: "موقوف",
    live: "شغّال",
    loading: "بنحمّل متاجرك…",
    stores: "متاجرك",
  },
} satisfies Messages;

/** Three store rows while the list loads, in the rows' own box. */
function StoresSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="mt-5">
      <span className="sr-only">{label}</span>
      <ul aria-hidden className="space-y-2.5">
        {[0, 1, 2].map((row) => (
          <li key={row} data-slot="store-pick" className="flex min-h-[4.5rem] items-center gap-3 rounded-[1.25rem] border border-line bg-paper-raised px-3.5">
            <SkeletonBar className="size-11 shrink-0 rounded-[0.875rem]" />
            <div className="min-w-0 flex-1">
              <SkeletonBar className="h-3.5 w-2/5" />
              <SkeletonBar className="mt-2.5 h-2.5 w-3/5" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Where an account lands after signing in, and where the store switcher's
 * "all stores" goes: the stores it works in, each one tap from its dashboard,
 * and a new store — the page itself for the first one, a sheet over the list
 * after that. Outside the dashboard (no store is chosen yet), so it wears the
 * frame of the sign-in screens.
 */
export function WorkspacePickerPage() {
  const t = useT(STRINGS);
  const labels = useCreateStoreLabels();
  const { user, logout } = useAuth();
  const { workspaces, loading, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();
  // The first store is made on the page; this form is that one.
  const first = useCreateStoreForm();
  // /workspaces?new=1 lands with the new-store sheet already open (a "new store" link from inside the dashboard).
  const [params] = useSearchParams();
  const [creating, setCreating] = useState(() => params.get("new") === "1");
  // Draft / suspended come from the overview every store page already reads; without it a row simply has no chip.
  const overview = useAsync(() => storesOverview(apiClient).catch((): StoreOverview[] => []), [workspaces.length]);
  const [failedLogos, setFailedLogos] = useState<ReadonlySet<string>>(new Set());

  function goToDashboard(workspaceId: string) {
    selectWorkspace(workspaceId);
    navigate("/");
  }

  const account = (
    <>
    {/* Team invitations waiting for this account (handoff 358). */}
    <InvitesWaitingLine />
    <AuthFooter>
      {t.signedInAs}
      <bdi dir="ltr" className="max-w-full truncate font-medium text-ink">
        {user?.email ?? ""}
      </bdi>
      <span aria-hidden>·</span>
      <AuthLinkButton onClick={() => logout()}>{t.signOut}</AuthLinkButton>
    </AuthFooter>
    </>
  );

  // The first store exists: its link gets the card to itself.
  if (first.created) {
    const created = first.created;
    return (
      <AuthShell size="md">
        <StoreCreated created={created} heading="h1" />
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <StoreCreatedActions created={created} onOpenDashboard={() => goToDashboard(created.workspace.id)} className="max-sm:w-full" />
        </div>
      </AuthShell>
    );
  }

  if (loading) {
    return (
      <AuthShell size="md">
        <AuthHeading title={t.choose}>{t.chooseBody}</AuthHeading>
        <StoresSkeleton label={t.loading} />
      </AuthShell>
    );
  }

  // While the first store is being made the list already has it: the form stays until its link is ready.
  if (workspaces.length === 0 || first.creating) {
    return (
      <AuthShell size="md">
        <AuthHeading title={t.setUp}>{t.setUpBody}</AuthHeading>
        <form onSubmit={(event) => void first.submit(event)} className="mt-6">
          <CreateStoreFields form={first} />
          <Button type="submit" className={`mt-5 ${AUTH_SUBMIT}`} disabled={!first.canSubmit}>
            {first.creating ? labels.creating : labels.create}
          </Button>
        </form>
        {account}
      </AuthShell>
    );
  }

  const stateOf = (workspace: Workspace) => (overview.data ?? []).find((store) => store.id === workspace.id) ?? null;

  return (
    <AuthShell size="md">
      <AuthHeading title={t.choose}>{t.chooseBody}</AuthHeading>

      <ul aria-label={t.stores} className="mt-5 space-y-2.5">
        {workspaces.map((workspace) => {
          const state = stateOf(workspace);
          const suspended = (state?.status ?? workspace.status) === "suspended";
          const logo = state?.logoUrl ?? workspace.logoUrl ?? null;
          return (
            <li key={workspace.id}>
              <button
                type="button"
                data-slot="store-pick"
                onClick={() => goToDashboard(workspace.id)}
                aria-label={fmt(t.open, { name: workspace.name })}
                className="flex min-h-[4.5rem] w-full cursor-pointer items-center gap-3 rounded-[1.25rem] border border-line bg-paper-raised px-3.5 py-3 text-start transition-[scale,background-color,border-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[0.875rem] bg-primary-soft text-primary">
                  {logo && !failedLogos.has(workspace.id) ? (
                    <img
                      src={logo}
                      alt=""
                      className="size-full object-contain"
                      onError={() => setFailedLogos((failed) => new Set(failed).add(workspace.id))}
                    />
                  ) : (
                    <IconStore className="size-5" weight="duotone" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span dir="auto" className="min-w-0 truncate text-[15px] leading-6 font-semibold text-ink">
                      {workspace.name}
                    </span>
                    {suspended ? (
                      <StatusBadge value="suspended" tone="danger" text={t.suspended} className="shrink-0" />
                    ) : state?.draft ? (
                      <StatusBadge value="draft" tone="warning" text={t.draft} className="shrink-0" />
                    ) : state ? (
                      <StatusBadge value="active" tone="success" text={t.live} className="shrink-0" />
                    ) : null}
                  </span>
                  <bdi dir="ltr" className="block truncate text-start text-[13px] leading-5 text-ink-soft">
                    {storeHost(workspace.slug)}
                  </bdi>
                </span>
                <IconCaretRight className="size-4 shrink-0 text-ink-soft rtl:-scale-x-100" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      <Button type="button" variant="outline" className="mt-4 min-h-12 w-full text-base" onClick={() => setCreating(true)}>
        <IconPlus weight="bold" className="size-4" aria-hidden />
        {t.newStore}
      </Button>

      {account}

      <CreateStoreSheet open={creating} onOpenChange={setCreating} onOpenDashboard={goToDashboard} />
    </AuthShell>
  );
}
