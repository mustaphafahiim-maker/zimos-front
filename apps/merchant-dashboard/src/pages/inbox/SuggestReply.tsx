import { useState } from "react";
import { IconSparkle, IconSpinner } from "@/components/icons";
import { cn } from "@store-builder/ui";
import { aiStart, aiWaitForJob } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { CHAT_TOOL } from "./inboxScreen";

const STRINGS = {
  en: {
    suggest: "Suggest a reply (AI)",
    suggesting: "Writing a reply…",
    failed: "No suggestion this time — write the reply yourself.",
    nothing: "The customer hasn't written anything to answer yet.",
  },
  ar: {
    suggest: "اقترح رد (ذكاء اصطناعي)",
    suggesting: "بكتب رد…",
    failed: "مفيش اقتراح المرة دي — اكتب الرد بنفسك.",
    nothing: "العميل لسه ماكتبش حاجة نرد عليها.",
  },
} satisfies Messages;

/**
 * The inbox's suggested reply (SPEC §19.2 "Suggested WhatsApp replies",
 * backend ai/featuresP2.js `wa_reply`): from the conversation, the store's
 * facts and the customer's own orders. It only fills the message box — the
 * employee reads it, edits it if needed, and sends it.
 */
export function SuggestReplyButton({
  conversationId,
  onSuggest,
  className,
}: {
  conversationId: string;
  onSuggest: (text: string) => void;
  className?: string;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);

  async function suggest() {
    setBusy(true);
    try {
      const started = await aiStart(apiClient, workspaceId, "wa_reply", { conversationId });
      const job = await aiWaitForJob<"wa_reply">(apiClient, workspaceId, started.id, { intervalMs: 800, timeoutMs: 60000 });
      if (job.status === "succeeded" && job.output) onSuggest(job.output.reply);
      else toast.error(t.failed);
    } catch (err) {
      // AI_LIMIT_REACHED (by its scope), AI_PROVIDER_UNAVAILABLE and AI_NOT_CONFIGURED are worded in lib/errorMessages.
      toast.error(errorMessage(err, { AI_NOTHING_TO_ANSWER: t.nothing }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      aria-label={busy ? t.suggesting : t.suggest}
      title={busy ? t.suggesting : t.suggest}
      aria-busy={busy || undefined}
      disabled={busy}
      onClick={() => void suggest()}
      data-slot="chat-tool"
      className={cn(CHAT_TOOL, className)}
    >
      {busy ? (
        <IconSpinner className="size-5 animate-spin motion-reduce:animate-none" weight="bold" aria-hidden />
      ) : (
        <IconSparkle className="size-5" aria-hidden />
      )}
    </button>
  );
}
