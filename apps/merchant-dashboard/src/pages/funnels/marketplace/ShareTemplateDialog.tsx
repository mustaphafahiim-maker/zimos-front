import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconInfo, IconUpload } from "@/components/icons";
import { Alert, Button } from "@store-builder/ui";
import {
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_LIMITS,
  funnelsList,
  marketplaceSubmissions,
  marketplaceSubmit,
  marketplaceUpdateSubmission,
  type MarketplaceCardInput,
  type MarketplaceCategory,
  type MarketplaceLanguage,
  type MarketplaceSubmission,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useMarketplaceErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Field, TextField } from "@/components/Field";
import { Sheet } from "@/components/Sheet";
import { Select } from "@/components/Select";
import { TagListField } from "@/components/TagListField";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { ImageUrlInput } from "@/pages/catalog/components/ImageUrlInput";
import { LANGUAGES, MARKET_STRINGS, categoryLabel, languageLabel } from "./marketplaceStrings";

interface Form {
  funnelId: string;
  name: string;
  category: MarketplaceCategory;
  description: string;
  tags: string[];
  thumbnailUrl: string;
  authorName: string;
  language: MarketplaceLanguage;
}

/** What makes a submission still "open" — the server refuses a second one for that funnel (ALREADY_SUBMITTED). */
const isOpen = (s: MarketplaceSubmission) => s.status === "pending" || s.status === "approved";

/**
 * "Share to marketplace" (handoff 192): one of the store's funnels as a
 * template card — name, kind, description, search words, picture, author,
 * language — sent for review. Its pages are copied when it is sent. With
 * `submission` the same form edits that card (PATCH); a listed card that
 * changes goes back to review, which the form says before saving.
 *
 * Opened from the funnels list or the editor (`funnelId` given), or from the
 * marketplace page, where the merchant picks the funnel. Funnels already
 * pending or listed are marked and can't be sent twice.
 *
 * A sheet, with the form in short sections: the funnel, the card people see,
 * how they find it, its picture and author.
 */
export function ShareTemplateDialog({
  open,
  onClose,
  funnelId,
  submission,
  unsaved = false,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** The funnel to share; without it the form offers a picker. */
  funnelId?: string | null;
  /** Edit this card instead of sending a new one. */
  submission?: MarketplaceSubmission | null;
  /** The editor has changes that aren't saved yet (they wouldn't be copied). */
  unsaved?: boolean;
  onSaved?: (submission: MarketplaceSubmission) => void;
}) {
  const t = useT(MARKET_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const marketError = useMarketplaceErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const storeName = currentWorkspace?.name ?? "";
  const editing = submission ?? null;

  // The store's funnels and what it already shared: only needed to send a new one.
  const sources = useAsync(
    () =>
      open && !editing
        ? Promise.all([funnelsList(apiClient, workspaceId), marketplaceSubmissions(apiClient, workspaceId)]).then(([funnels, mine]) => ({ funnels, mine }))
        : Promise.resolve(null),
    [workspaceId, open, editing?.id]
  );
  const taken = new Set((sources.data?.mine ?? []).filter(isOpen).map((s) => s.funnelId));

  const blank = (): Form => ({
    funnelId: funnelId ?? "",
    name: "",
    category: "ecommerce",
    description: "",
    tags: [],
    thumbnailUrl: "",
    authorName: "",
    language: locale === "en" ? "en" : "ar",
  });
  const [form, setForm] = useState<Form>(blank);
  const [problems, setProblems] = useState<{ name?: string; thumbnailUrl?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!open) return;
    setError(null);
    setProblems({});
    setBusy(false);
    setForm(
      editing
        ? {
            funnelId: editing.funnelId ?? "",
            name: editing.name,
            category: editing.category,
            description: editing.description ?? "",
            tags: editing.tags,
            thumbnailUrl: editing.thumbnailUrl ?? "",
            authorName: editing.authorName,
            language: editing.language ?? (locale === "en" ? "en" : "ar"),
          }
        : blank()
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id, funnelId]);

  // A new card starts with the funnel's own name.
  const funnels = sources.data?.funnels ?? [];
  const chosen = funnels.find((f) => f.id === form.funnelId) ?? null;
  useEffect(() => {
    if (!editing && chosen && !form.name) set("name", chosen.name.slice(0, MARKETPLACE_LIMITS.nameMax));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen?.id]);

  const alreadyShared = !editing && form.funnelId !== "" && taken.has(form.funnelId);
  const limits = { min: MARKETPLACE_LIMITS.nameMin, max: MARKETPLACE_LIMITS.nameMax };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const name = form.name.trim();
    const picture = form.thumbnailUrl.trim();
    const found: typeof problems = {};
    if (name.length < limits.min || name.length > limits.max) found.name = fmt(t.nameInvalid, limits);
    if (picture && !/^https:\/\/\S+$/i.test(picture)) found.thumbnailUrl = t.pictureInvalid;
    setProblems(found);
    if (Object.keys(found).length > 0) {
      // The sheet scrolls on its own: bring the first problem into view and put the cursor there.
      requestAnimationFrame(() => {
        const field = formRef.current?.querySelector<HTMLElement>("[data-problem='true']");
        field?.scrollIntoView({ block: "center", behavior: "smooth" });
        field?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
      });
      return;
    }
    if ((!editing && !form.funnelId) || alreadyShared) return;

    const card: MarketplaceCardInput = {
      name,
      category: form.category,
      description: form.description.trim() || null,
      tags: form.tags,
      thumbnailUrl: picture || null,
      // Left empty, the server uses the store's name; an edit can't send "" so it sends that name itself.
      authorName: form.authorName.trim() || (editing ? storeName || editing.authorName : undefined),
      language: form.language,
    };
    const changes = editing ? changesOf(editing, card) : null;
    // Nothing changed: nothing to send (the server wants at least one field).
    if (changes && Object.keys(changes).length === 0) return onClose();
    setBusy(true);
    setError(null);
    try {
      if (editing && changes) {
        const saved = await marketplaceUpdateSubmission(apiClient, workspaceId, editing.id, changes);
        toast.success(editing.status === "approved" && saved.status === "pending" ? t.savedBackToReview : t.saved);
        onSaved?.(saved);
      } else {
        const sent = await marketplaceSubmit(apiClient, workspaceId, {
          ...card,
          funnelId: form.funnelId,
          name,
          category: form.category,
          description: card.description || undefined,
          thumbnailUrl: card.thumbnailUrl || undefined,
        });
        toast.success(fmt(t.sent, { name: sent.name }));
        onSaved?.(sent);
      }
      onClose();
    } catch (err) {
      setError(marketError(err));
      setBusy(false);
    }
  }

  const noFunnels = !editing && !funnelId && sources.data !== null && funnels.length === 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
      size="md"
      title={editing ? fmt(t.editTitle, { name: editing.name }) : t.share}
      description={editing ? undefined : t.shareBody}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" form="share-market-template" disabled={busy || alreadyShared || noFunnels || (!editing && sources.loading)}>
            {editing ? (busy ? t.saving : t.save) : busy ? t.sending : t.send}
          </Button>
        </>
      }
    >
      <form ref={formRef} id="share-market-template" onSubmit={submit} className="space-y-5" noValidate>
        {sources.error ? <Alert variant="danger">{marketError(sources.error)}</Alert> : null}
        {noFunnels && <Alert variant="info">{t.noFunnels}</Alert>}

        {!editing && !funnelId && funnels.length > 0 && (
          <FormSection title={t.secFunnel}>
          <Field label={t.funnel} required labelHidden>
            {(props) => (
              <Select {...props} value={form.funnelId} disabled={busy} onChange={(e) => set("funnelId", e.target.value)}>
                <option value="" disabled>
                  {t.funnelPick}
                </option>
                {funnels.map((f) => (
                  <option key={f.id} value={f.id}>
                    {taken.has(f.id) ? fmt(t.funnelTaken, { name: f.name }) : f.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          </FormSection>
        )}

        {alreadyShared && (
          <Alert variant="info" className="space-y-1">
            <p>{t.alreadyShared}</p>
            <Link to="/funnels/marketplace?tab=mine" className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline sm:min-h-0">
              {t.openMine}
            </Link>
          </Alert>
        )}

        <FormSection title={t.secCard}>
        <div data-problem={problems.name ? "true" : undefined}>
          <TextField
            label={t.name}
            required
            dir="auto"
            maxLength={MARKETPLACE_LIMITS.nameMax}
            value={form.name}
            disabled={busy}
            error={problems.name}
            hint={fmt(t.nameHint, limits)}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.categoryLabel} required>
            {(props) => (
              <Select {...props} value={form.category} disabled={busy} onChange={(e) => set("category", e.target.value as MarketplaceCategory)}>
                {MARKETPLACE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(t, c)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.templateLanguage}>
            {(props) => (
              <Select {...props} value={form.language} disabled={busy} onChange={(e) => set("language", e.target.value as MarketplaceLanguage)}>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {languageLabel(t, l)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label={t.descriptionLabel} hint={fmt(t.descriptionHint, { max: MARKETPLACE_LIMITS.description })}>
          {(props) => (
            <Textarea
              {...props}
              dir="auto"
              rows={3}
              maxLength={MARKETPLACE_LIMITS.description}
              value={form.description}
              disabled={busy}
              onChange={(e) => set("description", e.target.value)}
            />
          )}
        </Field>
        </FormSection>

        <FormSection title={t.secFind}>
        <TagListField
          label={t.tags}
          values={form.tags}
          onChange={(next) => set("tags", next)}
          max={MARKETPLACE_LIMITS.tags}
          maxLength={MARKETPLACE_LIMITS.tagLength}
          lowercase
          dir="auto"
          placeholder={t.tagsPlaceholder}
          hint={fmt(t.tagsHint, { max: MARKETPLACE_LIMITS.tags })}
          disabled={busy}
        />
        </FormSection>

        <FormSection title={t.secLook}>
        <div data-problem={problems.thumbnailUrl ? "true" : undefined}>
          <Field label={t.picture} error={problems.thumbnailUrl} hint={t.pictureHint}>
            {({ id }) => (
              <ImageUrlInput
                id={id}
                value={form.thumbnailUrl}
                disabled={busy}
                onChange={(url) => {
                  set("thumbnailUrl", url);
                  setProblems((p) => ({ ...p, thumbnailUrl: undefined }));
                }}
              />
            )}
          </Field>
        </div>
        <TextField
          label={t.author}
          dir="auto"
          maxLength={MARKETPLACE_LIMITS.authorName}
          value={form.authorName}
          placeholder={storeName}
          disabled={busy}
          hint={storeName ? fmt(t.authorHint, { store: storeName }) : undefined}
          onChange={(e) => set("authorName", e.target.value)}
        />
        </FormSection>

        <div className="zimos-funnel-note space-y-2 rounded-[0.875rem] bg-paper-sunken/70 px-3 py-2.5 text-sm leading-6 text-ink-soft">
          {editing?.status === "approved" ? (
            <Note>{t.listedNote}</Note>
          ) : !editing ? (
            <>
              <Note>{t.snapshotNote}</Note>
              <Note>{t.notCopied}</Note>
            </>
          ) : (
            <Note>{t.notCopied}</Note>
          )}
          {unsaved && !editing && <Note strong>{t.unsavedNote}</Note>}
        </div>

        {error && <Alert variant="danger">{error}</Alert>}
      </form>
    </Sheet>
  );
}

/** The funnel editor's «شارك في سوق القوالب»: the form for this funnel, warning about unsaved edits. */
export function ShareToMarketplaceButton({ funnelId, unsaved }: { funnelId: string; unsaved: boolean }) {
  const t = useT(MARKET_STRINGS);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <IconUpload className="size-4" aria-hidden /> {t.share}
      </Button>
      <ShareTemplateDialog open={open} funnelId={funnelId} unsaved={unsaved} onClose={() => setOpen(false)} />
    </>
  );
}

/** A short titled group of the form: one thing to decide at a time. */
function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm leading-5 font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function Note({ children, strong = false }: { children: string; strong?: boolean }) {
  return (
    <p className={strong ? "flex items-start gap-2 font-medium text-accent-dark" : "flex items-start gap-2"}>
      <IconInfo className="mt-1 size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

/** Only what changed goes in the PATCH: an untouched listed card stays listed. */
function changesOf(before: MarketplaceSubmission, card: MarketplaceCardInput): MarketplaceCardInput {
  const out: MarketplaceCardInput = {};
  if (card.name !== before.name) out.name = card.name;
  if (card.category !== before.category) out.category = card.category;
  if ((card.description ?? null) !== (before.description ?? null)) out.description = card.description ?? null;
  if (JSON.stringify(card.tags ?? []) !== JSON.stringify(before.tags)) out.tags = card.tags;
  if ((card.thumbnailUrl ?? null) !== (before.thumbnailUrl ?? null)) out.thumbnailUrl = card.thumbnailUrl ?? null;
  if (card.authorName !== undefined && card.authorName !== before.authorName) out.authorName = card.authorName;
  if (card.language !== (before.language ?? undefined)) out.language = card.language;
  return out;
}
