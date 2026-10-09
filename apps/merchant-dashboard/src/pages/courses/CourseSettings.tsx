import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@store-builder/ui";
import { coursesUpdate, type Course, type Product } from "@store-builder/api-client";
import { CopyButton } from "@/components/CopyButton";
import { Field, TextField } from "@/components/Field";
import { SaveBar } from "@/components/SaveBar";
import { Section } from "@/components/Section";
import { Select } from "@/components/Select";
import { SettingsGroup, SettingsRow } from "@/components/settings";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { COURSE_STRINGS } from "./courseText";

const formOf = (course: Course) => ({ title: course.title, description: course.description ?? "", coverUrl: course.coverUrl ?? "", productId: course.productId ?? "" });

/**
 * A course's own details — title, description, cover, the product that sells
 * it — saved from the bar that appears with the first change, and the link of
 * its page on the store. Publishing and deleting are in the header.
 */
export function CourseSettings({ course, link, onSaved }: { course: Course; link: string; onSaved: (course: Course) => void }) {
  const t = useT(COURSE_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const titleBox = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(() => formOf(course));
  const [form, setForm] = useState(saved);
  const [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .listProducts(workspaceId, { limit: 200 })
      .then((result) => {
        if (!cancelled) setProducts(result.products);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const dirty = form.title !== saved.title || form.description !== saved.description || form.coverUrl !== saved.coverUrl || form.productId !== saved.productId;
  useReportDirty(dirty && !busy);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!form.title.trim()) {
      setTitleError(t.nameError);
      titleBox.current?.querySelector("input")?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await coursesUpdate(apiClient, workspaceId, course.id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        coverUrl: form.coverUrl.trim() || null,
        productId: form.productId || null,
      });
      const fresh = formOf(next);
      setSaved(fresh);
      setForm(fresh);
      onSaved(next);
      toast.success(t.settingsSaved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--bento-gap)]">
      <form onSubmit={submit} noValidate className="flex flex-col gap-[var(--bento-gap)]">
        <Section title={t.settingsTitle}>
          <div className="space-y-4">
            <div ref={titleBox}>
              <TextField
                label={t.name}
                required
                dir="auto"
                maxLength={200}
                value={form.title}
                error={titleError ?? undefined}
                onChange={(e) => {
                  setForm({ ...form, title: e.target.value });
                  setTitleError(null);
                }}
              />
            </div>
            <Field label={t.courseDescription}>
              {(props) => <Textarea {...props} dir="auto" rows={3} maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
            </Field>
            <TextField label={t.cover} hint={t.coverHint} type="url" inputMode="url" dir="ltr" maxLength={1000} value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} />
            <Field label={t.product} hint={t.productHint}>
              {(props) => (
                <Select {...props} className="h-11" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                  <option value="">{t.noProduct}</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {error && <Alert variant="danger">{error}</Alert>}
          </div>
        </Section>
        <SaveBar dirty={dirty} saving={busy} onDiscard={() => setForm(saved)} />
      </form>

      <SettingsGroup>
        <SettingsRow
          label={t.studentLink}
          hint={t.studentLinkHint}
          control={
            <div className="flex max-w-full min-w-0 items-center gap-1">
              <bdi dir="ltr" className="min-w-0 truncate text-sm text-ink-soft">
                {link}
              </bdi>
              <CopyButton value={link} label={t.copy} className="min-h-11 shrink-0" labelClassName="sr-only" />
            </div>
          }
        />
      </SettingsGroup>
    </div>
  );
}
