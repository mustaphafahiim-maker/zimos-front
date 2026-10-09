import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { SEARCH_SYNONYM_LIMITS, normalizeSearchTerm, searchSynonymsGet, searchSynonymsSave } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { addSynonymPair } from "./synonymGroups";
import { SEARCH_STRINGS } from "./searchStrings";

/**
 * «أضف مرادف» beside a search that found nothing (handoff 211): one box for
 * the word the store does have products under. The pair joins the group
 * either word is already in, or becomes a new group; the store's groups are
 * read fresh when it is saved, so a change made elsewhere is not overwritten.
 */
export function AddSynonymDialog({ query, onClose }: { query: string | null; onClose: () => void }) {
  const t = useT(SEARCH_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const [term, setTerm] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (query !== null) {
      setTerm("");
      setProblem(null);
      setFailure(null);
    }
  }, [query]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || query === null) return;
    const word = term.trim();
    if (!word) return setProblem(t.addRequired);
    if (normalizeSearchTerm(word) === normalizeSearchTerm(query)) return setProblem(t.addSame);
    setSaving(true);
    setProblem(null);
    setFailure(null);
    try {
      const result = addSynonymPair(await searchSynonymsGet(apiClient, workspaceId), query, word);
      if (result.kind === "ok") {
        await searchSynonymsSave(apiClient, workspaceId, result.groups);
        toast.success(fmt(t.addDone, { query, term: word }));
        onClose();
      } else if (result.kind === "exists") {
        toast.success(fmt(t.addExists, { query, term: word }));
        onClose();
      } else if (result.kind === "both") {
        setProblem(fmt(t.addBoth, { query, term: word }));
      } else if (result.kind === "full") {
        setProblem(fmt(t.addGroupFull, { max: SEARCH_SYNONYM_LIMITS.maxTerms }));
      } else {
        setProblem(fmt(t.addTooMany, { max: SEARCH_SYNONYM_LIMITS.groups }));
      }
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={query !== null}
      onClose={onClose}
      title={fmt(t.addTitle, { query: query ?? "" })}
      description={fmt(t.addDescription, { query: query ?? "" })}
      footer={
        <>
          <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="min-h-11 rounded-full px-5" disabled={saving}>
            {saving ? t.addSaving : t.addSave}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <TextField
          label={t.addTerm}
          hint={t.addTermHint}
          dir="auto"
          autoComplete="off"
          autoFocus
          maxLength={SEARCH_SYNONYM_LIMITS.term}
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            if (problem) setProblem(null);
          }}
          error={problem ?? undefined}
          className="[&_input]:h-11"
        />
        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
