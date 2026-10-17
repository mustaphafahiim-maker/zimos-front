import { useState } from "react";
import { Button } from "@store-builder/ui";
import type { StoreLocale } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useToast } from "@/components/Toast";
import { fillFromTemplate } from "./templateFill";

const STRINGS = {
  en: {
    fill: "Fill the English from the template",
    filling: "Filling the English…",
    hint: "Fills the English of every text your template wrote that is still empty here — pages, header and footer, products and collections. Nothing you translated is changed.",
    done: "{filled} texts filled from the template. {left} have no English in the template.",
  },
  ar: {
    fill: "املأ الإنجليزية من القالب",
    filling: "جارٍ ملء الإنجليزية…",
    hint: "يملأ الإنجليزية لكل نص كتبه قالبك وما زال فارغًا هنا: الصفحات والرأس والتذييل والمنتجات والتصنيفات. لا يُغيَّر شيء ترجمته أنت.",
    done: "تم ملء {filled} نصًا من القالب. {left} نصًا ليس له إنجليزية في القالب.",
  },
} satisfies Messages;

/**
 * Languages → translate, on a store that wears an imported template: one
 * press fills the English its Arabic template already has. The dictionary is
 * fetched with the press, not with the page.
 */
export function TemplateFillButton({ locale, onDone }: { locale: StoreLocale; onDone: () => void }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ filled: number; left: number } | null>(null);
  const look = (currentWorkspace?.themeSettings as Record<string, unknown> | undefined)?.xsLook;

  async function fill() {
    setBusy(true);
    try {
      const { default: dictionary } = await import("../website/templates/xs/xsDictionary.json");
      const done = await fillFromTemplate({ client: apiClient, workspaceId, locale, dictionary, look: typeof look === "string" ? look : null });
      setResult(done);
      toast.success(fmt(t.done, { filled: done.filled, left: done.left }));
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 space-y-1" data-slot="template-fill">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void fill()}>
        {busy ? t.filling : t.fill}
      </Button>
      <p className="text-xs text-ink-soft">{result ? fmt(t.done, { filled: result.filled, left: result.left }) : t.hint}</p>
    </div>
  );
}
