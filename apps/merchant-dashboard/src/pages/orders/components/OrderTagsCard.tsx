import { useId, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button, Input } from "@store-builder/ui";
import { ordersListTags, ordersMeta, ordersUpdateMeta, type Order } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { Section } from "@/components/Section";
import { useOrderErrorMessage } from "../orderErrors";

const STRINGS = {
  en: {
    title: "Tags",
    description: "Labels to find and group orders. Filter the orders list by any of them.",
    placeholder: "Add a tag",
    label: "New tag",
    add: "Add",
    remove: "Remove tag {tag}",
    empty: "No tags on this order.",
    suggestions: "Used before",
  },
  ar: {
    title: "التاجز",
    description: "تسميات لتنظيم الأوردرات والبحث عنها. يمكنك تصفية قائمة الأوردرات بأي منها.",
    placeholder: "أضف تاج",
    label: "تاج جديد",
    add: "إضافة",
    remove: "حذف التاج {tag}",
    empty: "لا توجد تاجز على هذا الأوردر.",
    suggestions: "مستخدمة من قبل",
  },
} satisfies Messages;

export function OrderTagsCard({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useOrderErrorMessage();
  const inputId = useId();
  const { tags } = ordersMeta(order);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const known = useAsync(() => ordersListTags(apiClient, workspaceId), [workspaceId]);

  const have = new Set(tags.map((tag) => tag.toLowerCase()));
  const suggestions = (known.data ?? []).filter((k) => !have.has(k.tag.toLowerCase())).slice(0, 8);

  async function change(patch: { addTags?: string[]; removeTags?: string[] }) {
    setBusy(true);
    try {
      await ordersUpdateMeta(apiClient, workspaceId, order.id, patch);
      setDraft("");
      onChanged();
      known.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const tag = draft.trim();
    if (tag) change({ addTags: [tag] });
  }

  return (
    <Section title={t.title} description={t.description}>
      {tags.length === 0 ? (
        <p className="text-sm text-ink-soft">{t.empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft py-0.5 ps-2.5 pe-1 text-sm text-primary-dark dark:text-primary"
            >
              {tag}
              <button
                type="button"
                disabled={busy}
                onClick={() => change({ removeTags: [tag] })}
                aria-label={fmt(t.remove, { tag })}
                className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-paper-raised focus-visible:outline-2 focus-visible:outline-primary"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t.label}
        </label>
        <Input
          id={inputId}
          value={draft}
          maxLength={40}
          placeholder={t.placeholder}
          onChange={(e) => setDraft(e.target.value)}
          className="h-11"
        />
        <Button type="submit" variant="outline" className="min-h-11" disabled={busy || !draft.trim()}>
          {t.add}
        </Button>
      </form>

      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-soft">{t.suggestions}:</span>
          {suggestions.map((s) => (
            <button
              key={s.tag}
              type="button"
              disabled={busy}
              onClick={() => change({ addTags: [s.tag] })}
              className="min-h-8 cursor-pointer rounded-full border border-line bg-paper px-2.5 text-xs text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
            >
              + {s.tag}
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}
