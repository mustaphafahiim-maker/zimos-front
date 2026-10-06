import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@store-builder/ui";
import type { AiDialect, AiProductOutput } from "@store-builder/api-client";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { runAiJob, useAiDialects, useAiErrorText } from "@/lib/aiRun";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";

const STRINGS = {
  en: {
    write: "Write with AI",
    writing: "Writing…",
    language: "AI language",
    needName: "Type the product name first.",
    hint: "The AI fills the description from the name; nothing is saved until you save the product.",
  },
  ar: {
    write: "اكتب بالذكاء الاصطناعي",
    writing: "بنكتب…",
    language: "لغة الذكاء الاصطناعي",
    needName: "اكتب اسم المنتج أولًا.",
    hint: "الذكاء الاصطناعي يملأ الوصف من الاسم؛ لا يُحفظ شيء حتى تحفظ المنتج.",
  },
} satisfies Messages;

/**
 * The product form's AI entry point (SPEC §19 "Create product with AI"):
 * writes the description from the product's name, in the chosen dialect,
 * into the form — a draft until the merchant saves.
 */
export function AiDescriptionButton({ name, onWritten }: { name: string; onWritten: (output: AiProductOutput) => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const dialects = useAiDialects();
  const aiError = useAiErrorText();
  const [dialect, setDialect] = useState<AiDialect>("egyptian");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function write() {
    if (!name.trim()) return setError(t.needName);
    setBusy(true);
    setError(null);
    try {
      const job = await runAiJob(workspaceId, "product", { name: name.trim(), dialect });
      if (job.output) onWritten(job.output);
    } catch (err) {
      setError(aiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label={t.language} value={dialect} onChange={(e) => setDialect(e.target.value as AiDialect)} className="h-9 w-auto" disabled={busy}>
          {dialects.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </Select>
        <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => void write()} disabled={busy}>
          <Sparkles className="size-4" aria-hidden />
          {busy ? t.writing : t.write}
        </Button>
      </div>
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : <p className="text-xs text-ink-soft">{t.hint}</p>}
    </div>
  );
}
