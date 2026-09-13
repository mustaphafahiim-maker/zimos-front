import { useEffect, useState, type KeyboardEvent } from "react";
import { EyeOff, X } from "lucide-react";
import { Alert, Button, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { CamouflageSettings } from "@/mock/types";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { DataState } from "@/components/DataState";
import { TextField, Field } from "@/components/Field";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";

function ChipsInput({
  id,
  values,
  onChange,
  placeholder,
  transform = (s) => s,
}: {
  id: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  transform?: (s: string) => string;
}) {
  const [text, setText] = useState("");

  function commit() {
    const v = transform(text.trim());
    if (v && !values.includes(v)) onChange([...values, v]);
    setText("");
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && text === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-[0.5rem] border border-line bg-paper-raised px-2 py-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/40">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-dark">
          {v}
          <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="rounded-full hover:bg-primary/20">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
        placeholder={values.length === 0 ? placeholder : undefined}
        className="min-w-[120px] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/60"
      />
    </div>
  );
}

export function CamouflageTab() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const settings = useAsync(() => mockApi.getCamouflage(workspaceId), [workspaceId]);
  const [draft, setDraft] = useState<CamouflageSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  function patch(p: Partial<CamouflageSettings>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await mockApi.saveCamouflage(workspaceId, draft);
      settings.setData(draft);
      toast.success("Ad review shield saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DataState loading={settings.loading || !draft} error={settings.error} onRetry={() => settings.refresh()}>
      {draft && (
        <div className="max-w-2xl space-y-6">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-medium text-ink">
              <EyeOff className="size-4 text-ink-soft" /> Ad review shield
            </h2>
            <p className="mt-1 text-sm text-ink-soft">Also known as camouflage (التمويه).</p>
          </div>

          <Alert variant="info">
            <p className="font-medium text-ink">What it does</p>
            <p className="text-xs text-ink-soft">
              Ad-review bots and reviewers from listed countries or user agents see a harmless decoy page (or no product at all) instead of
              your offer, so the real page stays live for customers. Use it responsibly — it does not change what customers see.
            </p>
          </Alert>

          <Toggle label="Enable shield" description="Turn the decoy on for matching visitors." checked={draft.enabled} onChange={(v) => patch({ enabled: v })} />

          <div className={cn("space-y-5 transition-opacity", !draft.enabled && "opacity-60")}>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-ink">Mode</legend>
              {(
                [
                  ["decoy_page", "Show decoy page", "Serve a neutral content page with the title below."],
                  ["hide_product", "Hide product", "Return a plain 'not available' page with no offer or price."],
                ] as const
              ).map(([v, t, d]) => (
                <label key={v} className={cn("flex cursor-pointer gap-3 rounded-[0.6rem] border p-3", draft.mode === v ? "border-primary bg-primary-soft" : "border-line")}>
                  <input type="radio" name="camo-mode" className="mt-1" checked={draft.mode === v} onChange={() => patch({ mode: v })} />
                  <span>
                    <span className="block text-sm font-medium text-ink">{t}</span>
                    <span className="block text-xs text-ink-soft">{d}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {draft.mode === "decoy_page" && (
              <TextField label="Decoy page title" value={draft.decoyPageTitle} onChange={(e) => patch({ decoyPageTitle: e.target.value })} dir="auto" />
            )}

            <Field label="Blocked countries" hint="Two-letter codes. Press Enter or comma to add.">
              {({ id }) => (
                <ChipsInput id={id} values={draft.blockedCountries} onChange={(v) => patch({ blockedCountries: v })} placeholder="US, IE, SG" transform={(s) => s.toUpperCase().slice(0, 2)} />
              )}
            </Field>

            <Field label="Blocked user agents" hint="Substring match, case-insensitive.">
              {({ id }) => <ChipsInput id={id} values={draft.blockedUserAgents} onChange={(v) => patch({ blockedUserAgents: v })} placeholder="facebookexternalhit" />}
            </Field>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </DataState>
  );
}
