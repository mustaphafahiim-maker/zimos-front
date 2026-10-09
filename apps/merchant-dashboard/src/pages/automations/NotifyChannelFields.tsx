import { Link } from "react-router-dom";
import { teamChannelsList } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { providerLabel, TEAM_CHANNEL_STRINGS } from "@/pages/settings/teamChannels/teamChannelStrings";

const STRINGS = {
  en: {
    channel: "Team channel",
    choose: "Choose a channel",
    message: "Message to the channel",
    paused: "{name} (paused)",
    gone: "A channel that was deleted",
    none: "No team channel yet.",
    addOne: "Add one in the notification settings",
    loading: "Loading the channels…",
    failed: "The channels could not be read. Only the store owner or a manager can choose one.",
  },
  ar: {
    channel: "قناة الفريق",
    choose: "اختار قناة",
    message: "الرسالة للقناة",
    paused: "{name} (متوقفة)",
    gone: "قناة اتمسحت",
    none: "مفيش قنوات فريق لسه.",
    addOne: "ضيف واحدة من إعدادات الإشعارات",
    loading: "بنحمّل القنوات…",
    failed: "معرفناش نقرا القنوات. صاحب المتجر أو مديره بس اللي يقدروا يختاروا قناة.",
  },
} satisfies Messages;

/**
 * The fields of an automation's «رسالة لقناة الفريق» step (handoff 378): which
 * of the store's Telegram / Slack / Discord channels gets the message, and
 * the message (up to 500, the same tokens as «تنبيه الفريق»). A channel
 * deleted since the rule was saved stays in the list as such, so the step
 * says what is wrong instead of silently pointing at another channel.
 */
export function NotifyChannelFields({
  teamChannelId,
  message,
  onChange,
  onMessageFocus,
}: {
  teamChannelId: string;
  message: string;
  onChange: (patch: { teamChannelId?: string; message?: string }) => void;
  /** The message field took the focus: token chips insert there. */
  onMessageFocus: () => void;
}) {
  const t = useT(STRINGS);
  const ct = useT(TEAM_CHANNEL_STRINGS);
  const workspaceId = useWorkspaceId();
  const channels = useAsync(() => teamChannelsList(apiClient, workspaceId), [workspaceId]);
  const list = channels.data?.channels ?? [];
  const known = teamChannelId === "" || list.some((channel) => channel.id === teamChannelId);

  return (
    <div className="space-y-3">
      <Field label={t.channel} hint={channels.loading ? t.loading : undefined} error={channels.error ? t.failed : undefined}>
        {({ id, ...aria }) => (
          <Select id={id} {...aria} value={teamChannelId} disabled={channels.loading} onChange={(e) => onChange({ teamChannelId: e.target.value })}>
            <option value="">{t.choose}</option>
            {!known && !channels.loading && <option value={teamChannelId}>{t.gone}</option>}
            {list.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {`${channel.isActive ? channel.name : fmt(t.paused, { name: channel.name })} — ${providerLabel(ct, channel.provider)}`}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {!channels.loading && !channels.error && list.length === 0 && (
        <p className="text-xs text-ink-soft">
          {t.none}{" "}
          <Link to="/settings?tab=notifications#team-channels" className="font-medium text-primary hover:underline">
            {t.addOne}
          </Link>
        </p>
      )}
      <Field label={t.message}>
        {({ id }) => <Textarea id={id} dir="auto" maxLength={500} value={message} onFocus={onMessageFocus} onChange={(e) => onChange({ message: e.target.value })} />}
      </Field>
    </div>
  );
}
