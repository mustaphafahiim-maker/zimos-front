import { useState } from "react";
import { Button, cn } from "@store-builder/ui";
import { waBotGet, waBotPausedOf, waBotSetPaused, type WaBotView } from "@store-builder/api-client";
import { IconRobot, IconSpinner } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";

const STRINGS = {
  en: {
    settings: "Bot",
    settingsLabel: "Bot settings",
    on: "On",
    off: "Off",
    badge: "Bot",
    answering: "The bot is answering here",
    paused: "The bot is quiet here",
    takeOver: "Take over",
    letBot: "Let the bot answer",
    tookOver: "You took over this conversation. The bot stays quiet here.",
    handedBack: "The bot answers this conversation again.",
  },
  ar: {
    settings: "البوت",
    settingsLabel: "إعدادات البوت",
    on: "شغّال",
    off: "مقفول",
    badge: "البوت",
    answering: "البوت بيرد هنا",
    paused: "البوت ساكت هنا",
    takeOver: "استلم المحادثة",
    letBot: "خلّي البوت يرد",
    tookOver: "استلمت المحادثة. البوت مش هيرد فيها.",
    handedBack: "البوت هيرد في المحادثة دي تاني.",
  },
} satisfies Messages;

/**
 * The bot's settings as the inbox reads them: kept for the session, so the
 * header chip and the strip of a conversation show at once on the way back.
 * A role that cannot read them gets `null` and sees neither.
 */
function useBotView(): WaBotView | null {
  const workspaceId = useWorkspaceId();
  const bot = useCachedAsync<WaBotView | null>(`wa-bot:${workspaceId}`, () => waBotGet(apiClient, workspaceId).catch(() => null), [workspaceId]);
  return bot.data;
}

/** The inbox header's way to the bot's settings (SPEC §19.3), saying whether the bot is on. */
export function BotSettingsLink() {
  const t = useT(STRINGS);
  const view = useBotView();
  return (
    // The same pill as the settings button of the returns queue: the words and the state from sm up, the glyph alone on a phone.
    <Button variant="outline" asChild className="h-11 shrink-0 gap-2 rounded-full px-3 sm:px-4">
      <ViewLink to="/inbox/bot" aria-label={t.settingsLabel} title={t.settingsLabel}>
        <IconRobot className="size-[18px] shrink-0" aria-hidden />
        <span className="max-sm:sr-only">{t.settings}</span>
        {view && (
          <StatusBadge
            value={view.bot.enabled ? "on" : "off"}
            tone={view.bot.enabled ? "success" : "neutral"}
            text={view.bot.enabled ? t.on : t.off}
            className="max-sm:hidden"
          />
        )}
      </ViewLink>
    </Button>
  );
}

/** "Bot" on a message the bot sent. */
export function BotBadge() {
  const t = useT(STRINGS);
  return (
    <span
      data-slot="chat-bot-badge"
      className="mb-1 inline-flex items-center gap-1 rounded-full bg-paper-sunken px-2 py-0.5 text-[11px] leading-4 font-medium text-ink-soft"
    >
      <IconRobot className="size-3" aria-hidden />
      {t.badge}
    </span>
  );
}

/**
 * Under a conversation's header while the bot is on: whether it answers here,
 * and the one button that takes the conversation over (the bot stays quiet)
 * or hands it back. The switch happens on the press and is confirmed by a
 * toast that can take it back.
 */
export function BotToggle({
  conversation,
  onChange,
  className,
}: {
  conversation: { id: string };
  onChange: (paused: boolean) => void;
  className?: string;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const view = useBotView();
  const [busy, setBusy] = useState(false);
  if (!view?.bot.enabled) return null;
  const paused = waBotPausedOf(conversation);

  async function set(next: boolean, offerUndo: boolean) {
    setBusy(true);
    // The strip answers at once; the server's word replaces it, or the press is taken back.
    onChange(next);
    try {
      const saved = await waBotSetPaused(apiClient, workspaceId, conversation.id, next);
      onChange(saved);
      const message = saved ? t.tookOver : t.handedBack;
      if (offerUndo) toast.undo(message, () => set(!saved, false));
      else toast.success(message);
    } catch (err) {
      onChange(!next);
      if (!offerUndo) throw err;
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      data-slot="chat-strip"
      data-paused={paused ? "" : undefined}
      className={cn("flex min-h-12 shrink-0 items-center gap-2.5 border-b border-line bg-paper-raised px-3 py-1.5 sm:px-4", className)}
    >
      <IconRobot className={cn("size-[18px] shrink-0", paused ? "text-ink-soft" : "text-primary")} weight={paused ? "regular" : "fill"} aria-hidden />
      <p role="status" className="min-w-0 flex-1 truncate text-[13px] leading-5 text-ink-soft">
        {paused ? t.paused : t.answering}
      </p>
      <Button
        type="button"
        variant="outline"
        aria-busy={busy || undefined}
        disabled={busy}
        onClick={() => void set(!paused, true)}
        className="h-11 shrink-0 gap-1.5 rounded-full px-4 text-[13px] pointer-fine:h-9 pointer-fine:px-3.5"
      >
        {busy && <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" weight="bold" aria-hidden />}
        {paused ? t.letBot : t.takeOver}
      </Button>
    </div>
  );
}
