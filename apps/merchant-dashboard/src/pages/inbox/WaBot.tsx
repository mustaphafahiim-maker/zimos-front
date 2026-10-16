import { useState } from "react";
import { Link } from "react-router-dom";
import { Bot } from "lucide-react";
import { Button } from "@store-builder/ui";
import { waBotGet, waBotPausedOf, waBotSetPaused } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    settings: "Bot",
    badge: "Bot",
    answering: "The bot is answering",
    paused: "The bot is quiet here",
    takeOver: "Take over",
    letBot: "Let the bot answer",
    tookOver: "You took over this conversation. The bot stays quiet here.",
    handedBack: "The bot answers this conversation again.",
  },
  ar: {
    settings: "البوت",
    badge: "البوت",
    answering: "البوت بيرد",
    paused: "البوت ساكت هنا",
    takeOver: "استلم المحادثة",
    letBot: "خلّي البوت يرد",
    tookOver: "استلمت المحادثة. البوت مش هيرد فيها.",
    handedBack: "البوت هيرد في المحادثة دي تاني.",
  },
} satisfies Messages;

/** The inbox header's link to the bot's settings (SPEC §19.3). */
export function BotSettingsLink() {
  const t = useT(STRINGS);
  return (
    <Link to="/inbox/bot" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink hover:border-primary">
      <Bot className="size-4" aria-hidden />
      {t.settings}
    </Link>
  );
}

/** "Bot" on a message the bot sent. */
export function BotBadge() {
  const t = useT(STRINGS);
  return (
    <span className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-paper px-1.5 text-[11px] font-medium text-ink-soft ring-1 ring-line">
      <Bot className="size-3" aria-hidden />
      {t.badge}
    </span>
  );
}

/**
 * In a conversation's header while the bot is on: whether it answers here,
 * and the button to take over (it stays quiet) or hand back.
 */
export function BotToggle({ conversation, onChange }: { conversation: { id: string }; onChange: (paused: boolean) => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const bot = useAsync(() => waBotGet(apiClient, workspaceId).catch(() => null), [workspaceId]);
  const [busy, setBusy] = useState(false);
  if (!bot.data?.bot.enabled) return null;
  const paused = waBotPausedOf(conversation);

  async function toggle() {
    setBusy(true);
    try {
      const next = await waBotSetPaused(apiClient, workspaceId, conversation.id, !paused);
      onChange(next);
      toast.success(next ? t.tookOver : t.handedBack);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-1 text-xs text-ink-soft 2xl:inline-flex">
        <Bot className="size-3.5" aria-hidden />
        {paused ? t.paused : t.answering}
      </span>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void toggle()}>
        {paused ? t.letBot : t.takeOver}
      </Button>
    </div>
  );
}
