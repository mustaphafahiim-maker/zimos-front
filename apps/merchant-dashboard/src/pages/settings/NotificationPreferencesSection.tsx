import { useState } from "react";
import {
  notificationsGetPreferences,
  notificationsUpdatePreferences,
  type MerchantNotificationChannel,
  type MerchantNotificationPreferences,
  type MerchantNotificationType,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { NOTIFICATION_STRINGS, notificationTypeLabel } from "@/lib/notificationText";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { AccordionSection } from "@/components/Accordion";
import { DataState } from "@/components/DataState";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { PushDeviceToggle } from "./PushDeviceToggle";
import { PaneSkeleton, SettingsCard } from "./sections/SettingsCard";

const STRINGS = {
  en: {
    description: "What you are told about in this store, and where. These choices are yours alone — each teammate sets their own.",
    tableTitle: "Tell me about",
    type: "Event",
    inApp: "In the dashboard",
    email: "Email",
    push: "Push",
    whatsapp: "WhatsApp",
    whatsappHint: "WhatsApp messages go to your verified phone number.",
    whatsappNoPhone: "Verify your phone number under “Profile” to get notifications on WhatsApp.",
    sound: "Play a sound when a new order arrives",
    soundHint: "Rings while the dashboard is open in a browser tab.",
    saved: "Saved.",
    channelFor: "{channel}: {type}",
    allOff: "Off",
    noTypes: "Your role has no notifications to choose from in this store.",
  },
  ar: {
    description: "إيه اللي يوصلك عن المتجر ده، وفين. الاختيارات دي بتاعتك إنت بس — كل واحد في الفريق ليه اختياراته.",
    tableTitle: "بلّغني عن",
    type: "الحدث",
    inApp: "جوّه الداشبورد",
    email: "إيميل",
    push: "إشعار على الجهاز",
    whatsapp: "واتساب",
    whatsappHint: "رسايل واتساب بتوصل على رقم موبايلك الموثّق.",
    whatsappNoPhone: "وثّق رقم موبايلك من «الملف الشخصي» عشان توصلك الإشعارات على واتساب.",
    sound: "شغّل صوت لما ييجي أوردر جديد",
    soundHint: "بيرنّ طول ما الداشبورد مفتوحة في المتصفح.",
    saved: "اتحفظ.",
    channelFor: "{channel}: {type}",
    allOff: "مقفول",
    noTypes: "دورك ملوش إشعارات يختار منها في المتجر ده.",
  },
} satisfies Messages;

type Row = MerchantNotificationPreferences["types"][number];
type Patch = Parameters<typeof notificationsUpdatePreferences>[2];

/**
 * Settings → «الإشعارات»: push on this device, the new-order sound, and the
 * table of what to be told about — events down, channels across. Every tick
 * saves at once (one PUT, optimistic, put back if it fails) and can be undone
 * from its toast. On a phone four channels do not fit across: there each event
 * is one card that folds, with a switch per channel inside.
 */
export function NotificationPreferencesSection() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const nt = useT(NOTIFICATION_STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  // The one tick being saved ("sound", or "<type>:<channel>"): it shows the spinner; a second press waits for it.
  const [saving, setSaving] = useState<string | null>(null);

  const { data, error, loading, refresh, setData } = useAsync<MerchantNotificationPreferences>(
    () => notificationsGetPreferences(apiClient, workspaceId),
    [workspaceId]
  );
  const { user } = useAuth();
  const phoneVerified = Boolean(user?.phoneVerifiedAt);

  async function save(key: string, patch: Patch, optimistic: MerchantNotificationPreferences, undo?: () => void) {
    if (saving !== null) return;
    const previous = data;
    setData(optimistic);
    setSaving(key);
    try {
      setData(await notificationsUpdatePreferences(apiClient, workspaceId, patch));
      if (undo) toast.undo(t.saved, undo);
      else toast.success(t.saved);
    } catch (err) {
      if (previous) setData(previous);
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  function toggle(current: MerchantNotificationPreferences, type: MerchantNotificationType, channel: MerchantNotificationChannel, value: boolean, undoable = true) {
    const next = { ...current, types: current.types.map((row) => (row.type === type ? { ...row, [channel]: value } : row)) };
    void save(
      `${type}:${channel}`,
      { types: [{ type, [channel]: value }] },
      next,
      // The opposite call is the same call with the other value.
      undoable ? () => toggle(next, type, channel, !value, false) : undefined
    );
  }

  function toggleSound(current: MerchantNotificationPreferences, value: boolean, undoable = true) {
    const next = { ...current, soundEnabled: value };
    void save("sound", { soundEnabled: value }, next, undoable ? () => toggleSound(next, !value, false) : undefined);
  }

  const channelLabel = (channel: MerchantNotificationChannel) =>
    channel === "inApp" ? t.inApp : channel === "push" ? t.push : channel === "whatsapp" ? t.whatsapp : t.email;

  /** «جوّه الداشبورد · إيميل», or «مقفول»: what a folded event card says. */
  const summaryOf = (row: Row, channels: MerchantNotificationChannel[]) => {
    const on = channels.filter((channel) => row[channel]).map(channelLabel);
    return on.length > 0 ? on.join(" · ") : t.allOff;
  };

  return (
    <>
      <p className="px-1 text-sm leading-6 text-ink-soft">{t.description}</p>

      <PushDeviceToggle />

      <DataState loading={loading} error={error} onRetry={() => void refresh()} skeleton={<PaneSkeleton rows={5} />}>
        {data && (
          <>
            <SettingsGroup>
              <SettingsSwitch
                label={t.sound}
                hint={t.soundHint}
                checked={data.soundEnabled}
                busy={saving === "sound"}
                onChange={(value) => toggleSound(data, value)}
              />
            </SettingsGroup>

            {data.types.length === 0 ? (
              <SettingsCard>
                <p className="text-sm text-ink-soft">{t.noTypes}</p>
              </SettingsCard>
            ) : (
              <>
                {/* From sm up: the table — events down, channels across. */}
                <SettingsCard id="notifications" flush className="hidden sm:block">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-ink-soft">
                          <th scope="col" className="px-5 py-3 text-start text-[13px] font-semibold">
                            {t.tableTitle}
                          </th>
                          {data.channels.map((channel) => (
                            <th key={channel} scope="col" className="px-2 py-3 text-center text-[13px] font-semibold">
                              {channelLabel(channel)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.types.map((row) => {
                          const label = notificationTypeLabel(nt, row.type);
                          return (
                            <tr key={row.type} className="border-t border-line">
                              <th scope="row" className="px-5 py-1 text-start font-medium text-ink">
                                {label}
                              </th>
                              {data.channels.map((channel) => (
                                <td key={channel} className="px-2 py-1 text-center">
                                  {/* A 44px target around a 20px box. */}
                                  <label className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full align-middle transition-colors duration-[var(--dur-fade)] hover:bg-ink/5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary motion-reduce:transition-none">
                                    <input
                                      type="checkbox"
                                      className="size-5 shrink-0 cursor-pointer accent-primary outline-none aria-busy:cursor-progress"
                                      checked={row[channel]}
                                      aria-busy={saving === `${row.type}:${channel}` || undefined}
                                      aria-label={fmt(t.channelFor, { channel: channelLabel(channel), type: label })}
                                      onChange={(e) => toggle(data, row.type, channel, e.target.checked)}
                                    />
                                  </label>
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </SettingsCard>

                {/* On a phone: one card per event; it folds to a line that says where it reaches you. */}
                <div className="flex flex-col gap-2 sm:hidden">
                  <h3 className="px-4 text-[13px] leading-5 font-semibold text-ink-soft">{t.tableTitle}</h3>
                  {data.types.map((row) => {
                    const label = notificationTypeLabel(nt, row.type);
                    return (
                      <AccordionSection key={row.type} title={label} summary={summaryOf(row, data.channels)} flush className="[--radius-card:1.25rem]">
                        {data.channels.map((channel) => (
                          <SettingsSwitch
                            key={channel}
                            label={channelLabel(channel)}
                            checked={row[channel]}
                            busy={saving === `${row.type}:${channel}`}
                            // Under the card's title line the first row keeps square top corners.
                            className="first:rounded-t-none"
                            onChange={(value) => toggle(data, row.type, channel, value)}
                          />
                        ))}
                      </AccordionSection>
                    );
                  })}
                </div>

                {data.channels.includes("whatsapp") && (
                  <p className="px-4 text-[13px] leading-5 text-ink-soft">{phoneVerified ? t.whatsappHint : t.whatsappNoPhone}</p>
                )}
              </>
            )}
          </>
        )}
      </DataState>
    </>
  );
}
