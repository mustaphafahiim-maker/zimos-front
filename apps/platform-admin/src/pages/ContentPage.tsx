import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@store-builder/ui";
import { SelectField, TextAreaField, TextField } from "@/components/forms";
import { Panel } from "@/components/Panel";
import { StatusBadge, humanize } from "@/components/StatusBadge";
import { Toggle } from "@store-builder/ui";
import { useAction } from "@/components/controls";
import { useAsync } from "@store-builder/ui";
import { getErrorMessage } from "@/lib/errors";
import { formatRelative } from "@/lib/format";
import { adminApi } from "@/mock/adminApi";
import { controlApi } from "@/mock/controlApi";
import type { ChangelogPost, CmsContent, FaqEntry } from "@/mock/controlTypes";

const TABS = ["homepage", "pricing", "faq", "changelog"] as const;
type Tab = (typeof TABS)[number];

export function ContentPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "homepage";
  return (
    <div>
      <PageHeader title="Content" description="Marketing site CMS — announcement bar, hero, pricing display, FAQ and changelog." />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: String(v) }, { replace: true })}>
        <div className="scroll-thin overflow-x-auto border-b border-line">
          <TabsList variant="line" className="h-10">
            {TABS.map((t) => <TabsTrigger key={t} value={t} className="px-3">{t === "faq" ? "FAQ" : humanize(t)}</TabsTrigger>)}
          </TabsList>
        </div>
        <TabsContent value="homepage" className="pt-4"><HomepageTab /></TabsContent>
        <TabsContent value="pricing" className="pt-4"><PricingTab /></TabsContent>
        <TabsContent value="faq" className="pt-4"><FaqTab /></TabsContent>
        <TabsContent value="changelog" className="pt-4"><ChangelogTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function HomepageTab() {
  const { data, loading, error, refresh } = useAsync(() => controlApi.getCms(), []);
  const [draft, setDraft] = useState<CmsContent | null>(null);
  const { busy, run } = useAction();
  useEffect(() => setDraft(data), [data]);

  return (
    <DataState loading={loading} error={error} onRetry={() => void refresh()}>
      {draft && (
        <div className="space-y-4">
          <Panel title="Announcement bar" actions={<Toggle label="Show announcement bar" hideLabel checked={draft.announcementBar.enabled} onChange={(v) => setDraft({ ...draft, announcementBar: { ...draft.announcementBar, enabled: v } })} />}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextField label="Text (English)" value={draft.announcementBar.textEn} onChange={(e) => setDraft({ ...draft, announcementBar: { ...draft.announcementBar, textEn: e.target.value } })} />
              <TextField label="النص (العربية)" dir="rtl" value={draft.announcementBar.textAr} onChange={(e) => setDraft({ ...draft, announcementBar: { ...draft.announcementBar, textAr: e.target.value } })} />
              <TextField label="Link" value={draft.announcementBar.link} onChange={(e) => setDraft({ ...draft, announcementBar: { ...draft.announcementBar, link: e.target.value } })} />
            </div>
          </Panel>
          <Panel title="Homepage hero">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextField label="Title (English)" value={draft.hero.titleEn} onChange={(e) => setDraft({ ...draft, hero: { ...draft.hero, titleEn: e.target.value } })} />
              <TextField label="العنوان (العربية)" dir="rtl" value={draft.hero.titleAr} onChange={(e) => setDraft({ ...draft, hero: { ...draft.hero, titleAr: e.target.value } })} />
              <TextAreaField label="Subtitle (English)" value={draft.hero.subtitleEn} onChange={(e) => setDraft({ ...draft, hero: { ...draft.hero, subtitleEn: e.target.value } })} />
              <TextAreaField label="الوصف (العربية)" dir="rtl" value={draft.hero.subtitleAr} onChange={(e) => setDraft({ ...draft, hero: { ...draft.hero, subtitleAr: e.target.value } })} />
              <TextField label="Button (English)" value={draft.hero.ctaEn} onChange={(e) => setDraft({ ...draft, hero: { ...draft.hero, ctaEn: e.target.value } })} />
              <TextField label="الزر (العربية)" dir="rtl" value={draft.hero.ctaAr} onChange={(e) => setDraft({ ...draft, hero: { ...draft.hero, ctaAr: e.target.value } })} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {(["en", "ar"] as const).map((l) => (
                <div key={l} dir={l === "ar" ? "rtl" : "ltr"} className="rounded-[12px] border border-line bg-zimos-navy p-5 text-white">
                  {draft.announcementBar.enabled && <p className="mb-3 rounded-md bg-white/10 px-2 py-1 text-xs">{l === "ar" ? draft.announcementBar.textAr : draft.announcementBar.textEn}</p>}
                  <p className="text-lg font-semibold">{l === "ar" ? draft.hero.titleAr : draft.hero.titleEn}</p>
                  <p className="mt-1 text-sm text-white/75">{l === "ar" ? draft.hero.subtitleAr : draft.hero.subtitleEn}</p>
                  <span className="mt-3 inline-block rounded-md bg-primary px-3 py-1.5 text-sm font-medium">{l === "ar" ? draft.hero.ctaAr : draft.hero.ctaEn}</span>
                </div>
              ))}
            </div>
          </Panel>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDraft(data)}>Discard</Button>
            <Button disabled={busy === "save"} onClick={() => void run("save", () => controlApi.saveCms(draft, "homepage"), "Homepage content published.")}>{busy === "save" ? "Publishing…" : "Publish"}</Button>
          </div>
        </div>
      )}
    </DataState>
  );
}

function PricingTab() {
  const { data, loading, error, refresh, setData } = useAsync(async () => ({ cms: await controlApi.getCms(), plans: await adminApi.listPlans() }), []);
  const { busy, run } = useAction();
  if (!data) return <DataState loading={loading} error={error} onRetry={() => void refresh()}>{null}</DataState>;
  const list = data.cms.planDisplay;
  const save = (planDisplay: CmsContent["planDisplay"]) =>
    void run("pricing", () => controlApi.saveCms({ ...data.cms, planDisplay }, "pricing"), "Pricing display updated.").then((cms) => cms && setData({ ...data, cms }));
  const move = (i: number, d: -1 | 1) => {
    const next = [...list];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  return (
    <Panel flush title="Pricing page" description="Order, visibility and the highlighted plan on the public pricing page.">
      {list.length === 0 ? <div className="p-4"><EmptyBlock message="No plans." /></div> : (
        <ul className="divide-y divide-line">
          {list.map((row, i) => {
            const plan = data.plans.find((p) => p.id === row.planId);
            return (
              <li key={row.planId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="tabular w-6 text-sm text-ink-soft">{i + 1}</span>
                <span className="min-w-0 flex-1 text-sm font-medium text-ink">{plan?.name ?? row.planId}{plan && !plan.active && <StatusBadge tone="neutral" className="ms-2">inactive</StatusBadge>}</span>
                <Button size="icon-sm" variant="ghost" aria-label="Move up" disabled={i === 0 || !!busy} onClick={() => move(i, -1)}><ArrowUp /></Button>
                <Button size="icon-sm" variant="ghost" aria-label="Move down" disabled={i === list.length - 1 || !!busy} onClick={() => move(i, 1)}><ArrowDown /></Button>
                <label className="flex items-center gap-2 text-xs text-ink-soft">
                  <input type="radio" name="highlight" className="accent-[var(--color-primary)]" checked={row.highlighted} onChange={() => save(list.map((x) => ({ ...x, highlighted: x.planId === row.planId })))} /> Highlight
                </label>
                <Toggle label={`Show ${plan?.name ?? "plan"}`} hideLabel checked={row.visible} onChange={(v) => save(list.map((x) => (x.planId === row.planId ? { ...x, visible: v } : x)))} />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

const EMPTY_FAQ: Omit<FaqEntry, "id"> = { questionAr: "", questionEn: "", answerAr: "", answerEn: "", published: true, order: 99 };

function FaqTab() {
  const { data, loading, error, refresh } = useAsync(() => controlApi.listFaq(), []);
  const [editing, setEditing] = useState<(Omit<FaqEntry, "id"> & { id?: string }) | null>(null);
  const [deleting, setDeleting] = useState<FaqEntry | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { busy, run } = useAction();

  return (
    <DataState loading={loading} error={error} onRetry={() => void refresh()}>
      <div className="mb-4 flex justify-end"><Button onClick={() => { setFormError(null); setEditing({ ...EMPTY_FAQ, order: (data?.length ?? 0) + 1 }); }}><Plus /> Add FAQ</Button></div>
      {(data ?? []).length === 0 ? <EmptyBlock message="No FAQ entries." /> : (
        <Panel flush>
          <ul className="divide-y divide-line">
            {(data ?? []).map((f) => (
              <li key={f.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-start">
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2">
                  <div><p className="text-sm font-medium text-ink">{f.questionEn}</p><p className="text-xs text-ink-soft">{f.answerEn}</p></div>
                  <div dir="rtl"><p className="text-sm font-medium text-ink">{f.questionAr}</p><p className="text-xs text-ink-soft">{f.answerAr}</p></div>
                </div>
                <div className="flex items-center gap-1.5">
                  {!f.published && <StatusBadge tone="neutral">Draft</StatusBadge>}
                  <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => { setFormError(null); setEditing(f); }}><Pencil /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Delete" className="text-danger" onClick={() => setDeleting(f)}><Trash2 /></Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit FAQ" : "Add FAQ"} className="max-w-2xl"
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={busy === "faq"} onClick={async () => {
          if (!editing) return;
          setFormError(null);
          try { await controlApi.saveFaq(editing); setEditing(null); void refresh({ silent: true }); } catch (err) { setFormError(getErrorMessage(err)); }
        }}>Save</Button></>}>
        {editing && (
          <div className="space-y-3">
            {formError && <Alert variant="danger">{formError}</Alert>}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextField label="Question (English)" required value={editing.questionEn} onChange={(e) => setEditing({ ...editing, questionEn: e.target.value })} />
              <TextField label="السؤال (العربية)" dir="rtl" required value={editing.questionAr} onChange={(e) => setEditing({ ...editing, questionAr: e.target.value })} />
              <TextAreaField label="Answer (English)" required value={editing.answerEn} onChange={(e) => setEditing({ ...editing, answerEn: e.target.value })} />
              <TextAreaField label="الإجابة (العربية)" dir="rtl" required value={editing.answerAr} onChange={(e) => setEditing({ ...editing, answerAr: e.target.value })} />
              <TextField label="Order" type="number" value={editing.order} onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })} />
            </div>
            <Toggle label="Published" checked={editing.published} onChange={(v) => setEditing({ ...editing, published: v })} />
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!deleting} title="Delete FAQ entry?" description={deleting?.questionEn} confirmLabel="Delete" destructive onCancel={() => setDeleting(null)}
        onConfirm={async () => { if (!deleting) return; await run("del", () => controlApi.deleteFaq(deleting.id), "FAQ deleted."); setDeleting(null); void refresh({ silent: true }); }} />
    </DataState>
  );
}

function ChangelogTab() {
  const { data, loading, error, refresh } = useAsync(() => controlApi.listChangelog(), []);
  const [editing, setEditing] = useState<(Omit<ChangelogPost, "id" | "createdAt" | "publishedAt"> & { id?: string }) | null>(null);
  const [deleting, setDeleting] = useState<ChangelogPost | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <DataState loading={loading} error={error} onRetry={() => void refresh()}>
      <div className="mb-4 flex justify-end"><Button onClick={() => { setFormError(null); setEditing({ title: "", body: "", tag: "feature", published: false }); }}><Plus /> New post</Button></div>
      {(data ?? []).length === 0 ? <EmptyBlock message="No changelog posts." /> : (
        <div className="space-y-3">
          {(data ?? []).map((p) => (
            <Panel key={p.id} title={p.title} description={p.published ? `Published ${formatRelative(p.publishedAt)}` : "Draft"}
              actions={<><StatusBadge tone="primary">{p.tag}</StatusBadge><Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => { setFormError(null); setEditing(p); }}><Pencil /></Button><Button size="icon-sm" variant="ghost" aria-label="Delete" className="text-danger" onClick={() => setDeleting(p)}><Trash2 /></Button></>}>
              <p className="whitespace-pre-line text-sm text-ink-soft">{p.body}</p>
            </Panel>
          ))}
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit post" : "New post"}
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={async () => {
          if (!editing) return;
          setFormError(null);
          try { await controlApi.saveChangelog(editing); setEditing(null); void refresh({ silent: true }); } catch (err) { setFormError(getErrorMessage(err)); }
        }}>Save</Button></>}>
        {editing && (
          <div className="space-y-3">
            {formError && <Alert variant="danger">{formError}</Alert>}
            <TextField label="Title" required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <SelectField label="Tag" value={editing.tag} onChange={(e) => setEditing({ ...editing, tag: e.target.value as ChangelogPost["tag"] })}>
              {(["feature", "improvement", "fix", "news"] as const).map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </SelectField>
            <TextAreaField label="Body" required rows={6} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            <Toggle label="Published" checked={editing.published} onChange={(v) => setEditing({ ...editing, published: v })} />
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!deleting} title="Delete post?" description={deleting?.title} confirmLabel="Delete" destructive onCancel={() => setDeleting(null)}
        onConfirm={async () => { if (!deleting) return; await controlApi.deleteChangelog(deleting.id); setDeleting(null); void refresh({ silent: true }); }} />
    </DataState>
  );
}
