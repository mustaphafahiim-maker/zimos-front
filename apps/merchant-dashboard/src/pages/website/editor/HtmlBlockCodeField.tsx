import { useEffect, useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import { htmlBlockGet, htmlBlockSave, isApiErrorCode, newHtmlBlockId } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { SwitchRow } from "./inspector/controls";

const STRINGS = {
  en: {
    active: "Show it on the store",
    save: "Save code",
    saving: "Saving…",
    saved: "Code saved — it is live on your store now.",
    note: "Kept apart from the page and saved straight to your store (no publish needed). It runs only on your store's own domain, never in this preview or on payment pages.",
    noPermission: "Only teammates who can publish the website can edit custom code.",
    loading: "Loading the code…",
  },
  ar: {
    active: "اعرضه في المتجر",
    save: "حفظ الكود",
    saving: "بنحفظ…",
    saved: "تم حفظ الكود — ظاهر في متجرك الآن.",
    note: "يُحفظ بعيدًا عن الصفحة ومباشرةً في متجرك (من غير نشر). يعمل فقط على دومين متجرك، وليس في هذه المعاينة ولا في صفحات الدفع.",
    noPermission: "تعديل الكود الخاص متاح فقط لمن يستطيع نشر الموقع.",
    loading: "بنحمّل الكود…",
  },
} satisfies Messages;

/**
 * The code of one `html_block` element (SPEC §8.2 "HTML code", §8.4): loaded
 * and saved through its own API by `blockId`, never written into the page
 * tree. A new element gets its id when its code is first saved.
 */
export function HtmlBlockCodeField({ label, hint, blockId, onBlockId }: { label: string; hint?: string; blockId: string; onBlockId: (id: string) => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [html, setHtml] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(Boolean(blockId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!blockId) return;
    let live = true;
    setLoading(true);
    htmlBlockGet(apiClient, workspaceId, blockId)
      .then((block) => {
        if (!live) return;
        setHtml(block.html);
        setIsActive(block.isActive);
      })
      .catch((err) => live && (isPermissionError(err) ? setDenied(true) : setError(errorMessage(err))))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [workspaceId, blockId, errorMessage]);

  async function save() {
    setBusy(true);
    setError(null);
    const id = blockId || newHtmlBlockId();
    try {
      await htmlBlockSave(apiClient, workspaceId, id, { html, isActive });
      if (!blockId) onBlockId(id);
      toast.success(t.saved);
    } catch (err) {
      if (isPermissionError(err) || isApiErrorCode(err, "FORBIDDEN")) setDenied(true);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (denied) return <Alert variant="info">{t.noPermission}</Alert>;

  return (
    <div className="space-y-2">
      <Field label={label} hint={hint}>
        {(props) => (
          <Textarea
            {...props}
            dir="ltr"
            rows={10}
            spellCheck={false}
            className="font-mono text-xs"
            placeholder={loading ? t.loading : "<div>…</div>"}
            disabled={loading}
            value={html}
            maxLength={50000}
            onChange={(e) => setHtml(e.target.value)}
          />
        )}
      </Field>
      <SwitchRow label={t.active} checked={isActive} onChange={setIsActive} />
      {error && <Alert variant="danger">{error}</Alert>}
      <Button type="button" size="sm" disabled={busy || loading} onClick={() => void save()}>
        {busy ? t.saving : t.save}
      </Button>
      <p className="text-xs leading-5 text-ink-soft">{t.note}</p>
    </div>
  );
}
