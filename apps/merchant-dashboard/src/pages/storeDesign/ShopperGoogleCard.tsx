import { useEffect, useId, useState, type FormEvent } from "react";
import { IconExternal, IconHelp, IconInfo } from "@/components/icons";
import { Input, cn } from "@store-builder/ui";
import { GOOGLE_CLIENT_ID_PATTERN, apiFieldProblems, shopperGoogleGet, shopperGoogleSave, type ShopperGoogleSettings } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { storeUrl } from "@/lib/storeAddress";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { AccordionSection } from "@/components/Accordion";
import { CopyButton } from "@/components/CopyButton";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsRow, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { GroupBlock, GroupState, STACK } from "./sections/parts";

const STRINGS = {
  en: {
    title: "Sign in with Google",
    description: "Customers open their account with Google's own “Sign in with Google” button instead of waiting for a code.",
    on: "On",
    off: "Off",
    enabled: "Let customers sign in with Google",
    enabledHint: "The button shows above the code form while customer accounts are on.",
    who: "It signs in a customer whose email is verified on their account. They verify it, or link Google, from their account's profile after a first sign-in with their phone.",
    clientId: "Google client ID",
    clientIdPlaceholder: "1234567890-abc123.apps.googleusercontent.com",
    clientIdHintPlatform: "Needed when your store runs on your own domain. Leave it empty to use the platform's.",
    clientIdHintOwn: "The web client ID from your Google Cloud project.",
    noPlatform: "The platform has no Google client of its own right now: add your client ID for the button to work.",
    usingPlatform: "Using the platform's Google client.",
    clientIdShape: "Paste the web client ID, the one ending in .apps.googleusercontent.com",
    clientIdNeeded: "Add your Google client ID to switch this on.",
    guideTitle: "Where do I get a client ID?",
    guideSteps:
      "In Google Cloud Console → APIs & Services → Credentials, create an OAuth client ID of type “Web application”, and add your store's address under “Authorized JavaScript origins”.",
    guideLink: "Google's guide",
    storeAddress: "Your store's address",
    copyAddress: "Copy address",
    save: "Save",
    saving: "Saving…",
    saved: "Google sign-in saved.",
    unsaved: "You have unsaved changes.",
  },
  ar: {
    title: "الدخول بحساب جوجل",
    description: "العميل يفتح حسابه بزرار «الدخول بحساب جوجل» بتاع جوجل نفسه، بدل ما يستنى كود.",
    on: "شغّال",
    off: "مقفول",
    enabled: "خلّي العملاء يدخلوا بحساب جوجل",
    enabledHint: "الزرار بيظهر فوق خانة الكود طول ما حسابات العملاء شغّالة.",
    who: "بيدخّل العميل اللي إيميله متأكد في حسابه. العميل يأكّد إيميله أو يربط جوجل من «البيانات» في حسابه، بعد أول دخول برقم موبايله.",
    clientId: "Google client ID",
    clientIdPlaceholder: "1234567890-abc123.apps.googleusercontent.com",
    clientIdHintPlatform: "محتاجه لو متجرك شغّال على دومين بتاعك. سيبه فاضي عشان تستخدم بتاع المنصة.",
    clientIdHintOwn: "الـ Client ID بتاع الويب من مشروعك على Google Cloud.",
    noPlatform: "المنصة مفيهاش Google client بتاعها دلوقتي: ضيف الـ Client ID بتاعك عشان الزرار يشتغل.",
    usingPlatform: "شغّال بالـ Google client بتاع المنصة.",
    clientIdShape: "الصق الـ Client ID بتاع الويب، اللي آخره ‎.apps.googleusercontent.com",
    clientIdNeeded: "ضيف الـ Google client ID بتاعك عشان تشغّله.",
    guideTitle: "أجيب الـ Client ID منين؟",
    guideSteps:
      "من Google Cloud Console ← APIs & Services ← Credentials: اعمل OAuth client ID من نوع «Web application»، وضيف عنوان متجرك في «Authorized JavaScript origins».",
    guideLink: "شرح جوجل",
    storeAddress: "عنوان متجرك",
    copyAddress: "انسخ العنوان",
    save: "حفظ",
    saving: "بنحفظ…",
    saved: "إعدادات الدخول بجوجل اتحفظت.",
    unsaved: "عندك تغييرات لسه ما اتحفظتش.",
  },
} satisfies Messages;

const GUIDE_URL = "https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid";

/**
 * Store settings → Customer accounts → «الدخول بحساب جوجل» (frontend-handoff
 * 217): the switch and the store's own Google web client id — needed on a
 * custom domain; empty uses the platform's, when the platform has one
 * (`platformClientAvailable`), and a note says so when it has none. Read and
 * saved with workspace.manage: without it the GET answers 403 and DataState
 * draws the no-permission card.
 */
export function ShopperGoogleCard({ className }: { className?: string }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const loaded = useAsync(() => shopperGoogleGet(apiClient, workspaceId), [workspaceId]);
  const saved = loaded.data;
  return (
    <div className={cn("min-w-0", className)}>
      <GroupState title={t.title} loading={loaded.loading && !saved} error={loaded.error} onRetry={() => void loaded.refresh()}>
        {saved && <GoogleForm saved={saved} onSaved={loaded.setData} />}
      </GroupState>
    </div>
  );
}

function GoogleForm({ saved, onSaved }: { saved: ShopperGoogleSettings; onSaved: (next: ShopperGoogleSettings) => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const ids = useId();
  // The switch as the merchant left it: `enabled` reads false while there is no client to run on.
  const [enabled, setEnabled] = useState(saved.enabled);
  const [clientId, setClientId] = useState(saved.clientId ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnabled(saved.enabled);
    setClientId(saved.clientId ?? "");
  }, [saved]);

  const typed = clientId.trim();
  const dirty = enabled !== saved.enabled || typed !== (saved.clientId ?? "");
  useReportDirty(dirty);
  const address = currentWorkspace?.slug ? storeUrl(currentWorkspace.slug) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !dirty) return;
    setError(null);
    const problem = typed && !GOOGLE_CLIENT_ID_PATTERN.test(typed) ? t.clientIdShape : enabled && !typed && !saved.platformClientAvailable ? t.clientIdNeeded : null;
    setFieldError(problem);
    if (problem) {
      document.getElementById(`${ids}-client`)?.focus();
      return;
    }
    setBusy(true);
    try {
      onSaved(await shopperGoogleSave(apiClient, workspaceId, { enabled, clientId: typed || null }));
      toast.success(t.saved);
    } catch (err) {
      // The API's own refusal of the id (a wrong shape, or none while the platform has none).
      if (apiFieldProblems(err).some((p) => p.field === "clientId")) {
        setFieldError(typed ? t.clientIdShape : t.clientIdNeeded);
        document.getElementById(`${ids}-client`)?.focus();
      } else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function discard() {
    setEnabled(saved.enabled);
    setClientId(saved.clientId ?? "");
    setFieldError(null);
    setError(null);
  }

  return (
    <form onSubmit={submit} noValidate className={STACK}>
      <SettingsGroup
        title={t.title}
        description={t.description}
        footer={
          <span className="flex items-start gap-1.5">
            <IconInfo className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t.who}
          </span>
        }
      >
        <SettingsSwitch
          label={t.enabled}
          hint={t.enabledHint}
          checked={enabled}
          disabled={busy}
          onChange={(next) => {
            setEnabled(next);
            setFieldError(null);
          }}
        />
        <SettingsRow
          label={t.clientId}
          hint={saved.platformClientAvailable ? t.clientIdHintPlatform : t.clientIdHintOwn}
          htmlFor={`${ids}-client`}
          error={fieldError ?? undefined}
          stacked
          control={
            <Input
              id={`${ids}-client`}
              dir="ltr"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={200}
              placeholder={t.clientIdPlaceholder}
              value={clientId}
              aria-invalid={fieldError ? true : undefined}
              disabled={busy}
              onChange={(e) => {
                setClientId(e.target.value);
                setFieldError(null);
              }}
              className={cn("min-h-11 text-start font-mono", fieldError && "border-danger focus-visible:ring-danger/30")}
            />
          }
        />
        {saved.platformClientAvailable
          ? saved.enabled &&
            !saved.clientId && (
              <GroupBlock>
                <p className="text-[13px] leading-5 text-ink-soft">{t.usingPlatform}</p>
              </GroupBlock>
            )
          : !typed && (
              <GroupBlock>
                <p className="flex items-start gap-2 text-sm text-accent-dark" role="note">
                  <IconInfo className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {t.noPlatform}
                </p>
              </GroupBlock>
            )}
      </SettingsGroup>

      {/* The how-to is read once: folded. */}
      <AccordionSection title={t.guideTitle} icon={IconHelp} persistKey="store-settings:accounts:google-guide">
        <div className="space-y-3 text-sm">
          <p className="text-ink-soft">{t.guideSteps}</p>
          {address && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] bg-paper-sunken px-3 py-1.5">
              <span className="min-w-0">
                <span className="block text-xs text-ink-soft">{t.storeAddress}</span>
                <bdi dir="ltr" className="block truncate text-ink">
                  {address}
                </bdi>
              </span>
              <CopyButton value={address} label={t.copyAddress} className="min-h-11 md:min-h-9" />
            </div>
          )}
          <a
            href={GUIDE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 font-medium text-primary hover:underline"
          >
            <IconExternal className="size-4" aria-hidden />
            {t.guideLink}
          </a>
        </div>
      </AccordionSection>

      {/* No onSave: inside the form the bar's button submits it, through the checks above. */}
      <SaveBar
        dirty={dirty}
        saving={busy}
        onDiscard={discard}
        saveLabel={t.save}
        savingLabel={t.saving}
        message={
          error ? (
            <span role="alert" className="text-danger">
              {error}
            </span>
          ) : undefined
        }
      />
    </form>
  );
}
