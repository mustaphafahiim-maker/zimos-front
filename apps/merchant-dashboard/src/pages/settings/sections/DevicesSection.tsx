import { useMemo, useState, type ReactNode } from "react";
import { Button, cn } from "@store-builder/ui";
import {
  pushDevices,
  pushRemove,
  securityEndAllSessions,
  securityEndSession,
  securityListDevices,
  type PushDevice,
  type SignedInDevice,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatRelativeTime } from "@/lib/relativeTime";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { IconBell, IconDesktop, IconPhoneDevice, IconSignOut, type IconComponent } from "@/components/icons";
import { SettingsGroup, SettingsRow } from "@/components/settings";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { PaneSkeleton, SettingsCard } from "./SettingsCard";

const STRINGS = {
  en: {
    thisDevice: "This device",
    thisDeviceTitle: "You are signed in here",
    unknownDevice: "Unknown device",
    on: "{browser} on {os}",
    lastActive: "Last active {when}",
    activeNow: "Active now",
    othersTitle: "Other devices ({n})",
    othersHint: "Every other browser and app signed in to your account, the most recent first. Sign out any you do not recognise.",
    noOthers: "No other device is signed in.",
    end: "Sign out",
    ending: "Signing out…",
    ended: "That device was signed out.",
    showAll: "Show all ({n})",
    showLess: "Show the latest {n}",
    endOthers: "Sign out all other devices",
    endOthersHint: "This device stays signed in.",
    endOthersTitle: "Sign out {n} other devices?",
    endOthersBody: "Each of them has to sign in again with your password. This device stays signed in.",
    endOthersConfirm: "Sign them out",
    endOthersDone: "{n} devices were signed out.",
    endOthersPartial: "{done} of {n} devices were signed out. Try again in a moment for the rest.",
    endAll: "Sign out everywhere",
    endAllHint: "Every device, this one included.",
    endAllTitle: "Sign out everywhere?",
    endAllBody: "Every device, this one included, is signed out. You will sign in again here.",
    cancel: "Cancel",
    working: "Working…",
    pushTitle: "Devices that get notifications",
    pushHint: "Phones and browsers where you turned push notifications on.",
    pushNone: "No device gets push notifications yet. Turn them on under Notifications.",
    pushWeb: "Browser",
    pushIos: "iPhone app",
    pushAndroid: "Android app",
    pushSeen: "Last seen {when}",
    pushHere: "This browser — turn it off under Notifications.",
    pushRemove: "Remove",
    pushRemoved: "That device no longer gets notifications.",
  },
  ar: {
    thisDevice: "الجهاز ده",
    thisDeviceTitle: "إنت داخل من هنا",
    unknownDevice: "جهاز مش معروف",
    on: "{browser} على {os}",
    lastActive: "آخر نشاط {when}",
    activeNow: "شغّال دلوقتي",
    othersTitle: "أجهزة تانية ({n})",
    othersHint: "كل متصفح وتطبيق تاني داخل على حسابك، الأحدث الأول. خرّج أي جهاز مش عارفه.",
    noOthers: "مفيش جهاز تاني داخل.",
    end: "خرّجه",
    ending: "بيخرج…",
    ended: "الجهاز ده خرج.",
    showAll: "اعرض الكل ({n})",
    showLess: "اعرض آخر {n} بس",
    endOthers: "خرّج كل الأجهزة التانية",
    endOthersHint: "الجهاز ده هيفضل داخل.",
    endOthersTitle: "تخرّج {n} جهاز تاني؟",
    endOthersBody: "كل جهاز منهم هيحتاج يدخل تاني بكلمة السر. الجهاز ده هيفضل داخل.",
    endOthersConfirm: "خرّجهم",
    endOthersDone: "{n} جهاز خرجوا.",
    endOthersPartial: "خرج {done} من {n} جهاز. جرّب تاني بعد شوية للباقي.",
    endAll: "اخرج من كل الأجهزة",
    endAllHint: "كل الأجهزة، ومنها الجهاز ده.",
    endAllTitle: "تخرج من كل الأجهزة؟",
    endAllBody: "كل الأجهزة، ومنها الجهاز ده، هتخرج. هتسجّل دخول تاني من هنا.",
    cancel: "إلغاء",
    working: "بننفّذ…",
    pushTitle: "أجهزة بتوصلها الإشعارات",
    pushHint: "الموبايلات والمتصفحات اللي شغّلت عليها إشعارات الجهاز.",
    pushNone: "لسه مفيش جهاز بتوصله إشعارات. شغّلها من «الإشعارات».",
    pushWeb: "متصفح",
    pushIos: "تطبيق آيفون",
    pushAndroid: "تطبيق أندرويد",
    pushSeen: "آخر ظهور {when}",
    pushHere: "المتصفح ده — اقفلها من «الإشعارات».",
    pushRemove: "شيله",
    pushRemoved: "الجهاز ده مش هتوصله إشعارات تاني.",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

/** How many other sessions the list opens with: the rest wait behind «اعرض الكل». */
const SHOWN_AT_FIRST = 10;
/** Sign-out calls sent at a time when ending every other session. */
const END_BATCH = 4;
/** Where PushDeviceToggle keeps this browser's push device id. */
const PUSH_DEVICE_KEY = "zimos_push_device";

const time = (iso: string) => new Date(iso).getTime() || 0;

function isPhone(text: string | null | undefined): boolean {
  return /android|iphone|ipad|ios|mobile/i.test(text ?? "");
}

/** "Chrome on Windows" from a user-agent string; null when it says nothing we know. Product names are not translated. */
function readUserAgent(userAgent: string | null): { browser: string | null; os: string | null } {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : null;
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  return { browser, os };
}

/** One device in a list: a glyph, what it is, a quiet line, and one action at the end. */
function DeviceRow({ icon: Icon, title, badge, meta, action }: { icon: IconComponent; title: string; badge?: ReactNode; meta: ReactNode; action?: ReactNode }) {
  return (
    <li className="flex min-h-16 items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-paper-sunken text-ink-soft">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5 font-medium text-ink">
          <bdi className="min-w-0 truncate">{title}</bdi>
          {badge}
        </p>
        <p className="mt-0.5 text-[13px] leading-5 text-ink-soft">{meta}</p>
      </div>
      {action}
    </li>
  );
}

/**
 * Settings → «الأجهزة»: where the account is signed in. The device in hand
 * first; then the other sessions, the ten most recent, with the rest behind
 * «اعرض الكل» — the list has no end on the server and used to be drawn whole.
 * One device is signed out from its row; all the others in one confirmed
 * action (the same per-session call, a few at a time); «اخرج من كل الأجهزة»
 * keeps its place. Then the devices that get push notifications.
 */
export function DevicesSection() {
  const t = useT(STRINGS);
  return (
    <>
      <SessionsPanel t={t} />
      <PushDevicesPanel t={t} />
    </>
  );
}

function SessionsPanel({ t }: { t: T }) {
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const devices = useAsync(() => securityListDevices(apiClient), []);
  const [ending, setEnding] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [confirmOthers, setConfirmOthers] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const all = useMemo(() => devices.data ?? [], [devices.data]);
  const current = all.find((device) => device.isCurrent) ?? null;
  // The most recently used first: an unknown session is most likely a recent one.
  const others = useMemo(
    () => all.filter((device) => !device.isCurrent).sort((a, b) => time(b.lastActiveAt) - time(a.lastActiveAt)),
    [all]
  );
  const shown = showAll ? others : others.slice(0, SHOWN_AT_FIRST);

  const label = (device: SignedInDevice) =>
    device.browser && device.os ? fmt(t.on, { browser: device.browser, os: device.os }) : (device.browser ?? device.os ?? t.unknownDevice);

  const meta = (device: SignedInDevice) => (
    <>
      {fmt(t.lastActive, { when: formatRelativeTime(device.lastActiveAt) })}
      {device.ipAddress ? (
        <>
          {" · "}
          <bdi dir="ltr">{device.ipAddress}</bdi>
        </>
      ) : null}
    </>
  );

  async function end(device: SignedInDevice) {
    setEnding(device.id);
    try {
      await securityEndSession(apiClient, device.id);
      toast.success(t.ended);
      await devices.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setEnding(null);
    }
  }

  /** Every other session, a few calls at a time; stops at the first refusal and says how far it got. */
  async function endOthers() {
    const targets = others.map((device) => device.id);
    let done = 0;
    let failed: unknown = null;
    for (let at = 0; at < targets.length && failed === null; at += END_BATCH) {
      const results = await Promise.allSettled(targets.slice(at, at + END_BATCH).map((id) => securityEndSession(apiClient, id)));
      for (const result of results) {
        if (result.status === "fulfilled") done += 1;
        else failed = result.reason;
      }
    }
    await devices.refresh({ silent: true });
    setConfirmOthers(false);
    setShowAll(false);
    if (failed === null) toast.success(fmt(t.endOthersDone, { n: done }));
    else if (done > 0) toast.error(fmt(t.endOthersPartial, { done, n: targets.length }));
    else toast.error(errorMessage(failed));
  }

  return (
    <>
      <DataState loading={devices.loading} error={devices.error} onRetry={() => void devices.refresh()} skeleton={<PaneSkeleton rows={4} />}>
        {current && (
          <div>
            <h3 className="mb-2 px-4 text-[13px] leading-5 font-semibold text-ink-soft">{t.thisDeviceTitle}</h3>
            <SettingsCard flush>
              <ul>
                <DeviceRow
                  icon={isPhone(current.os) ? IconPhoneDevice : IconDesktop}
                  title={label(current)}
                  badge={<StatusBadge value="current" tone="success" text={t.thisDevice} />}
                  meta={
                    <>
                      {t.activeNow}
                      {current.ipAddress ? (
                        <>
                          {" · "}
                          <bdi dir="ltr">{current.ipAddress}</bdi>
                        </>
                      ) : null}
                    </>
                  }
                />
              </ul>
            </SettingsCard>
          </div>
        )}

        <div>
          <h3 className="px-4 text-[13px] leading-5 font-semibold text-ink-soft">{fmt(t.othersTitle, { n: others.length })}</h3>
          <p className="mb-2 px-4 text-[13px] leading-5 text-ink-soft">{others.length === 0 ? t.noOthers : t.othersHint}</p>
          {others.length > 0 && (
            <SettingsCard flush>
              <ul>
                {shown.map((device) => (
                  <DeviceRow
                    key={device.id}
                    icon={isPhone(device.os) ? IconPhoneDevice : IconDesktop}
                    title={label(device)}
                    meta={meta(device)}
                    action={
                      <Button variant="outline" className="min-h-11 shrink-0" disabled={ending !== null} onClick={() => void end(device)}>
                        {ending === device.id ? t.ending : t.end}
                      </Button>
                    }
                  />
                ))}
              </ul>
              {others.length > SHOWN_AT_FIRST && (
                <button
                  type="button"
                  aria-expanded={showAll}
                  onClick={() => setShowAll((value) => !value)}
                  className={cn(
                    "flex min-h-13 w-full cursor-pointer items-center justify-center rounded-b-[1.25rem] border-t border-line px-4 text-sm font-medium text-primary",
                    "transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/4 active:bg-ink/8 motion-reduce:transition-none",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  )}
                >
                  {showAll ? fmt(t.showLess, { n: SHOWN_AT_FIRST }) : fmt(t.showAll, { n: others.length })}
                </button>
              )}
            </SettingsCard>
          )}
        </div>

        <SettingsGroup>
          {others.length > 0 && (
            <SettingsRow
              label={t.endOthers}
              hint={t.endOthersHint}
              control={
                <Button variant="danger" className="min-h-11" onClick={() => setConfirmOthers(true)}>
                  <IconSignOut className="size-4 rtl:-scale-x-100" weight="bold" aria-hidden />
                  {t.endOthersConfirm}
                </Button>
              }
            />
          )}
          <SettingsRow
            label={t.endAll}
            hint={t.endAllHint}
            control={
              <Button variant="outline" className="min-h-11" onClick={() => setConfirmAll(true)}>
                {t.endAll}
              </Button>
            }
          />
        </SettingsGroup>
      </DataState>

      <ConfirmDialog
        open={confirmOthers}
        title={fmt(t.endOthersTitle, { n: others.length })}
        description={t.endOthersBody}
        confirmLabel={t.endOthersConfirm}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        destructive
        onCancel={() => setConfirmOthers(false)}
        onConfirm={endOthers}
      />
      <ConfirmDialog
        open={confirmAll}
        title={t.endAllTitle}
        description={t.endAllBody}
        confirmLabel={t.endAll}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        destructive
        onCancel={() => setConfirmAll(false)}
        onConfirm={async () => {
          try {
            await securityEndAllSessions(apiClient);
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          apiClient.clearSession();
          window.location.href = "/login";
        }}
      />
    </>
  );
}

function storedPushDevice(): string | null {
  try {
    return window.localStorage.getItem(PUSH_DEVICE_KEY);
  } catch {
    return null;
  }
}

/** The devices registered for push (GET /me/push/devices). Left out where the server has no push at all. */
function PushDevicesPanel({ t }: { t: T }) {
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => pushDevices(apiClient).catch(() => null), []);
  const [removing, setRemoving] = useState<string | null>(null);
  const [here] = useState(() => storedPushDevice());

  if (list.loading) return <PaneSkeleton rows={2} />;
  if (!list.data) return null;
  const devices = [...list.data].sort((a, b) => time(b.lastSeenAt) - time(a.lastSeenAt));

  const title = (device: PushDevice) => {
    const kind = device.platform === "ios" ? t.pushIos : device.platform === "android" ? t.pushAndroid : t.pushWeb;
    const { browser, os } = readUserAgent(device.userAgent);
    const what = browser && os ? fmt(t.on, { browser, os }) : (browser ?? os);
    return what ? `${kind} · ${what}` : kind;
  };

  async function remove(device: PushDevice) {
    setRemoving(device.id);
    try {
      await pushRemove(apiClient, device.id);
      toast.success(t.pushRemoved);
      await list.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div>
      <h3 className="px-4 text-[13px] leading-5 font-semibold text-ink-soft">{t.pushTitle}</h3>
      <p className="mb-2 px-4 text-[13px] leading-5 text-ink-soft">{devices.length === 0 ? t.pushNone : t.pushHint}</p>
      {devices.length > 0 && (
        <SettingsCard flush>
          <ul>
            {devices.map((device) => (
              <DeviceRow
                key={device.id}
                icon={device.platform === "web" && !isPhone(device.userAgent) ? IconBell : IconPhoneDevice}
                title={title(device)}
                meta={device.id === here ? t.pushHere : fmt(t.pushSeen, { when: formatRelativeTime(device.lastSeenAt) })}
                action={
                  // This browser's own registration is undone where it was made, so the switch there stays true.
                  device.id === here ? undefined : (
                    <Button variant="outline" className="min-h-11 shrink-0" disabled={removing !== null} onClick={() => void remove(device)}>
                      {removing === device.id ? t.working : t.pushRemove}
                    </Button>
                  )
                }
              />
            ))}
          </ul>
        </SettingsCard>
      )}
    </div>
  );
}
