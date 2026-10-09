import { useId, useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { IconCheck, IconLock, IconOffline, IconUnplug } from "@/components/icons";
import { Alert, Button, Spinner } from "@store-builder/ui";
import {
  ApiError,
  apiFieldProblems,
  isApiErrorCode,
  oauthAuthorizeDecide,
  oauthAuthorizePreview,
  type OAuthAuthorizeRequest,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { AuthBackdrop } from "@/components/AuthBackdrop";
import { SkeletonBar } from "@/components/DataState";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { PartnerAppIcon } from "./PartnerAppIcon";
import { SCOPE_STRINGS, scopeLabel } from "./scopeStrings";

/**
 * Where a partner app sends the merchant (frontend-handoff 265):
 * /oauth/authorize?client_id=…&redirect_uri=…&scope=…&state=…
 *
 * The merchant picks which of their stores the app is for, sees the app and
 * what it asks for in words, and allows or denies. Either answer comes back
 * from the server as the address to return to (with the code, or
 * error=access_denied) — nothing is installed until the app swaps the code.
 *
 * It stands outside the dashboard shell, on the sign-in pages' calm frame: the
 * merchant arrives from another site and leaves again. Someone not signed in
 * goes to sign in and comes back to this very link.
 */

const STRINGS = {
  en: {
    loading: "Loading…",
    signedInAs: "Signed in as {email}.",
    signOut: "Sign out",
    toDashboard: "Go to dashboard",
    badLinkTitle: "This approval link is not valid",
    badLinkBody: "Ask the app that sent you here for a new link.",
    goneTitle: "This app isn't available",
    goneBody: "It doesn't exist anymore, or ZIMOS suspended it. Nothing was connected.",
    noStoreTitle: "You have no store yet",
    noStoreBody: "Create your store first, then open the app's link again.",
    createStore: "Create a store",
    noAccessTitle: "You can't connect apps to your stores",
    noAccessBody: "Connecting an app needs the Apps permission. Ask the store owner to give it to you from Settings → Team.",
    storeNoAccess: "You don't have the Apps permission in this store. Pick another store, or ask its owner to give it to you from Settings → Team.",
    storeInDevelopment: "This app is still in development: only its developer's stores can install it. Pick another store if one of yours is the developer's.",
    errorTitle: "We couldn't load this app",
    retry: "Try again",
    unreachableTitle: "We can't reach ZIMOS right now",
    unreachableBody: "You're still signed in. Check your connection and try again in a moment.",
    heading: "{app} wants to connect to your store",
    by: "By {developer}",
    inDevelopment: "App in development",
    store: "Store",
    intro: "Allow only if you know this app and asked to connect it.",
    wants: "This app wants to:",
    alreadyInstalled: "This store already has this app. Allowing replaces the access it has now.",
    returnsTo: "You go back to {host}",
    allow: "Allow",
    allowing: "Connecting…",
    deny: "Deny",
    denying: "Going back…",
    leaving: "Taking you back to the app…",
  },
  ar: {
    loading: "بيحمّل…",
    signedInAs: "مسجّل دخول باسم {email}.",
    signOut: "تسجيل الخروج",
    toDashboard: "روح للوحة التحكم",
    badLinkTitle: "لينك الموافقة ده مش صحيح",
    badLinkBody: "اطلب لينك جديد من التطبيق اللي بعتك هنا.",
    goneTitle: "التطبيق ده مش متاح",
    goneBody: "مبقاش موجود، أو زيموس وقّفه. مفيش حاجة اتربطت.",
    noStoreTitle: "لسه معندكش متجر",
    noStoreBody: "اعمل متجرك الأول، وبعدين افتح لينك التطبيق تاني.",
    createStore: "اعمل متجر",
    noAccessTitle: "مش هتقدر تربط تطبيقات بمتاجرك",
    noAccessBody: "ربط تطبيق محتاج صلاحية التطبيقات. اطلب من صاحب المتجر يفتحهالك من الإعدادات ← الفريق.",
    storeNoAccess: "مش معاك صلاحية التطبيقات في المتجر ده. اختار متجر تاني، أو اطلب من صاحبه يفتحهالك من الإعدادات ← الفريق.",
    storeInDevelopment: "التطبيق ده لسه تحت التطوير: متاجر المطوّر بتاعه بس هي اللي تقدر تثبّته. اختار متجر تاني لو واحد من متاجرك بتاع المطوّر.",
    errorTitle: "معرفناش نحمّل التطبيق ده",
    retry: "جرّب تاني",
    unreachableTitle: "مش قادرين نوصل لزيموس دلوقتي",
    unreachableBody: "إنت لسه مسجّل دخولك. اتأكد من النت وجرّب تاني بعد شوية.",
    heading: "{app} عايز يتربط بمتجرك",
    by: "من {developer}",
    inDevelopment: "تطبيق تحت التطوير",
    store: "المتجر",
    intro: "اسمح بس لو عارف التطبيق ده وإنت اللي طلبت تربطه.",
    wants: "التطبيق ده عايز:",
    alreadyInstalled: "التطبيق ده مثبّت في المتجر ده قبل كده. السماح هيبدّل الصلاحيات اللي معاه دلوقتي.",
    returnsTo: "هترجع لـ {host}",
    allow: "سماح",
    allowing: "بنربط…",
    deny: "رفض",
    denying: "بنرجّعك…",
    leaving: "بنرجّعك للتطبيق…",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

/** System roles the backend gives no apps.manage (permissions.js SYSTEM_ROLES): their stores are left out of the picker. A custom role may hold it — the server says. */
const ROLES_WITHOUT_APPS: ReadonlySet<string> = new Set(["editor", "order_operator", "confirmation_agent", "fulfillment", "accountant"]);

/** The sign-in pages' frame: the logo, the language switch and one card. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="auth-glass">
      <AuthBackdrop />
      <div className="auth-glass-stage">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

/** A state that ends the page: what happened, and the one way on. */
function Notice({ icon, title, body, children }: { icon: ReactNode; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-paper-sunken text-ink-soft [&>svg]:size-5">{icon}</span>
      <h1 className="font-display text-xl font-medium text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink-soft">{body}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function OAuthAuthorizePage() {
  const t = useT(STRINGS);
  const { status, refreshUser } = useAuth();
  const location = useLocation();
  const [retrying, setRetrying] = useState(false);

  if (status === "loading") {
    return (
      <Frame>
        <div className="flex justify-center py-10 text-ink-soft" role="status" aria-live="polite">
          <Spinner className="size-6" />
          <span className="sr-only">{t.loading}</span>
        </div>
      </Frame>
    );
  }

  // Sign in, then straight back to this link with everything the app put in it.
  if (status === "guest") {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (status === "unreachable") {
    return (
      <Frame>
        <Notice icon={<IconOffline aria-hidden />} title={t.unreachableTitle} body={t.unreachableBody}>
          <Button
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              try {
                await refreshUser();
              } finally {
                setRetrying(false);
              }
            }}
          >
            {t.retry}
          </Button>
        </Notice>
      </Frame>
    );
  }

  return (
    <Frame>
      <Approval t={t} />
    </Frame>
  );
}

function Approval({ t }: { t: T }) {
  const scopeText = useT(SCOPE_STRINGS) as Record<string, string>;
  const { user, logout } = useAuth();
  const { workspaces, currentWorkspace, loading: storesLoading } = useWorkspace();
  const errorMessage = useErrorMessage();
  const [params] = useSearchParams();
  const storeFieldId = useId();

  const request = useMemo<OAuthAuthorizeRequest | null>(() => {
    const clientId = params.get("client_id");
    const redirectUri = params.get("redirect_uri");
    const scope = params.get("scope");
    if (!clientId || !redirectUri || !scope) return null;
    const state = params.get("state");
    const responseType = params.get("response_type");
    return { client_id: clientId, redirect_uri: redirectUri, scope, ...(state ? { state } : {}), ...(responseType ? { response_type: responseType } : {}) };
  }, [params]);

  const stores = useMemo(() => workspaces.filter((w) => !ROLES_WITHOUT_APPS.has(w.role ?? "")), [workspaces]);
  const [pickedStore, setPickedStore] = useState<string | null>(null);
  // The store that is open in the dashboard, when it can take apps; else the first that can.
  const storeId = pickedStore ?? (stores.some((w) => w.id === currentWorkspace?.id) ? (currentWorkspace?.id ?? "") : (stores[0]?.id ?? ""));

  const preview = useAsync(
    () => (request && storeId ? oauthAuthorizePreview(apiClient, storeId, request) : Promise.resolve(null)),
    [storeId, request]
  );
  const [busy, setBusy] = useState<"allow" | "deny" | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    if (!request || !storeId) return;
    setBusy(approve ? "allow" : "deny");
    setError(null);
    try {
      const { redirectTo } = await oauthAuthorizeDecide(apiClient, storeId, request, approve);
      setLeaving(true);
      window.location.assign(redirectTo);
    } catch (err) {
      setError(errorMessage(err, { APP_IN_DEVELOPMENT: t.storeInDevelopment, FORBIDDEN: t.storeNoAccess }));
      setBusy(null);
    }
  }

  const account = (
    <p className="mt-6 border-t border-line pt-4 text-center text-xs text-ink-soft">
      {fmt(t.signedInAs, { email: user?.email ?? "" })}{" "}
      <button type="button" onClick={() => void logout()} className="min-h-11 cursor-pointer font-medium text-primary hover:underline">
        {t.signOut}
      </button>
    </p>
  );
  const dashboardLink = (
    <Button variant="outline" asChild>
      <Link to="/">{t.toDashboard}</Link>
    </Button>
  );

  if (!request) {
    return (
      <>
        <Notice icon={<IconUnplug aria-hidden />} title={t.badLinkTitle} body={t.badLinkBody}>
          {dashboardLink}
        </Notice>
        {account}
      </>
    );
  }

  if (storesLoading) {
    return (
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">{t.loading}</span>
        <PreviewSkeleton />
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <>
        <Notice icon={<IconUnplug aria-hidden />} title={t.noStoreTitle} body={t.noStoreBody}>
          <Button asChild>
            <Link to="/workspaces">{t.createStore}</Link>
          </Button>
        </Notice>
        {account}
      </>
    );
  }

  if (stores.length === 0) {
    return (
      <>
        <Notice icon={<IconLock aria-hidden />} title={t.noAccessTitle} body={t.noAccessBody}>
          {dashboardLink}
        </Notice>
        {account}
      </>
    );
  }

  // A link the server refuses is the app's mistake, and an app that is gone cannot be approved: neither is worth a retry.
  const failure = preview.error;
  const linkProblems = isApiErrorCode(failure, "VALIDATION_ERROR") ? apiFieldProblems(failure) : null;
  if (linkProblems) {
    return (
      <>
        <Notice icon={<IconUnplug aria-hidden />} title={t.badLinkTitle} body={t.badLinkBody}>
          {dashboardLink}
        </Notice>
        {linkProblems.length > 0 && (
          <ul className="mt-4 space-y-1 text-start text-xs text-danger" dir="ltr">
            {linkProblems.map((problem, index) => (
              <li key={index}>
                <code className="font-mono">{problem.field}</code>: {problem.message}
              </li>
            ))}
          </ul>
        )}
        {account}
      </>
    );
  }
  if (failure instanceof ApiError && failure.status === 404) {
    return (
      <>
        <Notice icon={<IconUnplug aria-hidden />} title={t.goneTitle} body={t.goneBody}>
          {dashboardLink}
        </Notice>
        {account}
      </>
    );
  }

  const storePicker =
    stores.length > 1 ? (
      <div className="space-y-1.5">
        <label htmlFor={storeFieldId} className="block text-sm font-medium text-ink">
          {t.store}
        </label>
        <Select id={storeFieldId} className="h-11" value={storeId} disabled={busy !== null || leaving} onChange={(e) => setPickedStore(e.target.value)}>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </Select>
      </div>
    ) : (
      <p className="text-sm text-ink-soft">
        {t.store}: <bdi className="font-medium text-ink">{stores[0].name}</bdi>
      </p>
    );

  // This store cannot take the app (no Apps permission here, or the app is its developer's only): another one may.
  if (failure instanceof ApiError && failure.status === 403) {
    return (
      <>
        <div className="space-y-4">
          {storePicker}
          <Alert>
            <IconLock className="size-4" aria-hidden />
            <span>{isApiErrorCode(failure, "APP_IN_DEVELOPMENT") ? t.storeInDevelopment : t.storeNoAccess}</span>
          </Alert>
          <div className="flex justify-end">{dashboardLink}</div>
        </div>
        {account}
      </>
    );
  }

  if (failure) {
    return (
      <>
        <Notice icon={<IconOffline aria-hidden />} title={t.errorTitle} body={errorMessage(failure)}>
          <Button variant="outline" onClick={() => void preview.refresh()}>
            {t.retry}
          </Button>
        </Notice>
        {account}
      </>
    );
  }

  const data = preview.data;
  if (preview.loading || !data) {
    return (
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">{t.loading}</span>
        <PreviewSkeleton />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <PartnerAppIcon url={data.app.iconUrl} className="size-12" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-medium text-ink">
              {fmt(t.heading, { app: data.app.name })}
            </h1>
            {data.app.developer && (
              <p className="mt-0.5 text-xs text-ink-soft">
                {fmt(t.by, { developer: data.app.developer })}
              </p>
            )}
            {data.app.status === "development" && <StatusBadge value="development" tone="warning" text={t.inDevelopment} className="mt-2" />}
          </div>
        </div>

        {data.app.description && (
          <p className="text-sm text-ink" dir="auto">
            {data.app.description}
          </p>
        )}

        {storePicker}

        <div>
          <h2 className="text-sm font-semibold text-ink">{t.wants}</h2>
          <ul className="mt-2 space-y-1.5">
            {data.scopes.map((scope) => (
              <li key={scope} className="flex items-start gap-2 text-sm text-ink">
                <IconCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <span>{scopeLabel(scopeText, scope)}</span>
              </li>
            ))}
          </ul>
        </div>

        {data.installed && <Alert>{t.alreadyInstalled}</Alert>}
        <p className="text-sm text-ink-soft">{t.intro}</p>
        {error && <Alert variant="danger">{error}</Alert>}

        <div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={busy !== null || leaving} onClick={() => void decide(false)}>
              {busy === "deny" ? t.denying : t.deny}
            </Button>
            <Button disabled={busy !== null || leaving} onClick={() => void decide(true)}>
              {busy === "allow" ? t.allowing : t.allow}
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-ink-soft" aria-live="polite">
            {leaving ? t.leaving : fmtHost(t.returnsTo, data.app.redirectHost)}
          </p>
        </div>
      </div>
      {account}
    </>
  );
}

/** "You go back to host" with the host kept left to right inside an Arabic sentence. */
function fmtHost(template: string, host: string): ReactNode {
  const [before, after] = template.split("{host}");
  return (
    <>
      {before}
      <bdi dir="ltr">{host}</bdi>
      {after}
    </>
  );
}

/** The card's shape while the app is read: its icon and name, then the list. */
function PreviewSkeleton() {
  return (
    <div aria-hidden>
      <div className="flex items-center gap-3">
        <div className="size-12 animate-pulse rounded-xl bg-paper-sunken motion-reduce:animate-none" />
        <div className="flex-1">
          <SkeletonBar className="h-4 w-3/4" />
          <SkeletonBar className="mt-2 w-1/3" />
        </div>
      </div>
      <SkeletonBar className="mt-6 w-2/5" />
      <SkeletonBar className="mt-3 w-4/5" />
      <SkeletonBar className="mt-3 w-3/5" />
      <SkeletonBar className="mt-3 w-2/3" />
      <div className="mt-6 grid grid-cols-2 gap-2">
        <div className="h-11 animate-pulse rounded-[var(--radius)] bg-paper-sunken motion-reduce:animate-none" />
        <div className="h-11 animate-pulse rounded-[var(--radius)] bg-paper-sunken motion-reduce:animate-none" />
      </div>
    </div>
  );
}
