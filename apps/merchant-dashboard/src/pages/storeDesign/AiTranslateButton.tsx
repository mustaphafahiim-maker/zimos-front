import { useEffect, useRef, useState } from "react";
import { IconSparkle } from "@/components/icons";
import { Button } from "@store-builder/ui";
import { translationsAiApply, translationsAiStart, type ContentEntity, type StoreLocale, type TranslatableEntity } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    run: "Translate what's missing with AI",
    running: "Translating {n} texts…",
    nothing: "Everything here is already translated.",
    done: "{n} texts translated with AI. Read them over — you can change any of them.",
    more: "{n} more are left: run it again for the next ones.",
    failed: "Some texts could not be translated. Try again later.",
    slow: "The translation is taking a while. Come back to this page in a minute.",
  },
  ar: {
    run: "ترجم الناقص بالذكاء الاصطناعي",
    running: "بنترجم {n} نص…",
    nothing: "كل حاجة هنا مترجمة بالفعل.",
    done: "اتترجم {n} نص بالذكاء الاصطناعي. راجعهم — تقدر تعدّل أي واحد.",
    more: "لسه فيه {n} — شغّلها تاني للباقي.",
    failed: "فيه نصوص ماتترجمتش. جرّب تاني بعدين.",
    slow: "الترجمة واخدة وقت. ارجع للصفحة دي بعد دقيقة.",
  },
} satisfies Messages;

const POLL_MS = 2000;
const MAX_POLLS = 60;

/** Fills the missing translations of one kind in one language (translations/aiFill.js). */
export function AiTranslateButton({
  locale,
  kind,
  onDone,
}: {
  locale: StoreLocale;
  kind: TranslatableEntity | ContentEntity;
  onDone: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [running, setRunning] = useState<number | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    // Set on mount as well: development mounts effects twice.
    alive.current = true;
    return () => void (alive.current = false);
  }, []);

  async function run() {
    try {
      const started = await translationsAiStart(apiClient, workspaceId, { entityType: kind, locale });
      if (started.jobs.length === 0) {
        toast.success(t.nothing);
        return;
      }
      setRunning(started.texts);
      let saved = 0;
      let pending = started.jobs;
      let failed = 0;
      for (let i = 0; i < MAX_POLLS && pending.length > 0 && alive.current; i += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, POLL_MS));
        const result = await translationsAiApply(apiClient, workspaceId, pending);
        saved += result.saved;
        failed += result.failed.length;
        pending = result.pending;
      }
      if (!alive.current) return;
      if (pending.length > 0) toast.error(t.slow);
      else if (failed > 0) toast.error(t.failed);
      if (saved > 0) toast.success([fmt(t.done, { n: saved }), started.remaining > 0 ? fmt(t.more, { n: started.remaining }) : ""].join(" ").trim());
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      if (alive.current) setRunning(null);
    }
  }

  return (
    <Button type="button" variant="outline" className="min-h-11 rounded-full px-4 sm:min-h-9" disabled={running !== null} onClick={() => void run()}>
      <IconSparkle className="size-4" aria-hidden />
      {running !== null ? fmt(t.running, { n: running }) : t.run}
    </Button>
  );
}
