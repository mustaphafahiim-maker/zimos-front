import { Plus, Trash2 } from "lucide-react";
import { Button, Input, cn } from "@store-builder/ui";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

/**
 * The versions of a funnel split test and each one's share of the visitors
 * (SPEC §9.6: "2 or more variations, each with a distribution percentage
 * totaling 100%"). Used when a test is started and, on a running test, to
 * add a version or move the shares.
 *
 * A is always the page itself. Every other version is a page of its own,
 * starting as a copy of the original. The backend takes up to five, keyed by
 * one letter (backend funnels/splitTests.js).
 *
 * A version a running test already has is `locked`: it cannot be taken out —
 * its visitors are pinned to it and its numbers would be lost — but its share
 * can go down to 0, which stops sending new visitors to it.
 */

export const MAX_VERSIONS = 5;
export const CONTROL_KEY = "A";

export interface VersionDraft {
  key: string;
  name: string;
  weight: number;
  /** The version's own page; absent for A. */
  builderData?: unknown;
  locked?: boolean;
}

const STRINGS = {
  en: {
    versions: "Versions and shares of visitors",
    original: "A — the original page",
    copyHint: "A new version starts as a copy of the original page; edit it once the test is saved.",
    name: "Name (optional)",
    share: "Share of visitors for {key} (%)",
    remove: "Remove version {key}",
    add: "Add a version",
    even: "Split evenly",
    total: "Total: {total}%",
    totalWrong: "Total: {total}% — the shares must add up to 100%.",
    lockedHint: "A version visitors have already seen stays in the test; set its share to 0 to stop showing it to new visitors.",
  },
  ar: {
    versions: "النسخ ونسبة الزوار لكل نسخة",
    original: "A — الصفحة الأصلية",
    copyHint: "كل نسخة جديدة تبدأ كنسخة من الصفحة الأصلية؛ عدّلها بعد حفظ الاختبار.",
    name: "الاسم (اختياري)",
    share: "نسبة الزوار للنسخة {key} (%)",
    remove: "حذف النسخة {key}",
    add: "إضافة نسخة",
    even: "قسّم بالتساوي",
    total: "الإجمالي: {total}%",
    totalWrong: "الإجمالي: {total}% — لازم مجموع النسب يكون 100%.",
    lockedHint: "النسخة اللي شافها زوار بتفضل في الاختبار؛ خلّي نسبتها 0 عشان متظهرش لزوار جدد.",
  },
} satisfies Messages;

/** Shares that add up to 100, the remainder going to the first versions. */
export function evenShares(count: number): number[] {
  const base = Math.floor(100 / count);
  return Array.from({ length: count }, (_, i) => base + (i < 100 - base * count ? 1 : 0));
}

function nextKey(taken: string[]): string {
  for (let code = 65; code <= 90; code += 1) {
    const key = String.fromCharCode(code);
    if (!taken.includes(key)) return key;
  }
  return "Z";
}

export const sharesTotal = (versions: VersionDraft[]) => versions.reduce((sum, v) => sum + v.weight, 0);

export function VersionSharesEditor({
  versions,
  onChange,
  newPage,
  idPrefix,
}: {
  versions: VersionDraft[];
  onChange: (next: VersionDraft[]) => void;
  /** The page a new version starts from: the original page as it is now. */
  newPage: unknown;
  idPrefix: string;
}) {
  const t = useT(STRINGS);
  const total = sharesTotal(versions);
  const evenly = (list: VersionDraft[]) => {
    const shares = evenShares(list.length);
    return list.map((v, i) => ({ ...v, weight: shares[i] }));
  };
  const set = (key: string, patch: Partial<VersionDraft>) => onChange(versions.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">{t.versions}</legend>
      <ul className="space-y-2">
        {versions.map((v) => (
          <li key={v.key} className="flex flex-wrap items-center gap-2">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-dark dark:text-primary">
              {v.key}
            </span>
            {v.key === CONTROL_KEY ? (
              <span className="min-w-40 flex-1 text-sm text-ink-soft">{t.original}</span>
            ) : (
              <Input
                className="h-9 min-w-40 flex-1"
                maxLength={80}
                value={v.name}
                placeholder={t.name}
                aria-label={`${v.key} — ${t.name}`}
                onChange={(e) => set(v.key, { name: e.target.value })}
              />
            )}
            <div className="flex items-center gap-1">
              <Input
                id={`${idPrefix}-share-${v.key}`}
                type="number"
                min={0}
                max={100}
                className="h-9 w-20 text-end tabular-nums"
                aria-label={fmt(t.share, { key: v.key })}
                value={v.weight}
                onChange={(e) => set(v.key, { weight: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))) })}
              />
              <span className="text-sm text-ink-soft" aria-hidden>
                %
              </span>
            </div>
            {v.key !== CONTROL_KEY && !v.locked && versions.length > 2 ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={fmt(t.remove, { key: v.key })}
                title={fmt(t.remove, { key: v.key })}
                onClick={() => onChange(evenly(versions.filter((x) => x.key !== v.key)))}
              >
                <Trash2 className="size-4 text-danger" aria-hidden />
              </Button>
            ) : (
              <span className="size-8 shrink-0" aria-hidden />
            )}
          </li>
        ))}
      </ul>
      <p className={cn("text-xs", total === 100 ? "text-ink-soft" : "text-danger")} role={total === 100 ? undefined : "alert"}>
        {fmt(total === 100 ? t.total : t.totalWrong, { total })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={versions.length >= MAX_VERSIONS}
          onClick={() => onChange(evenly([...versions, { key: nextKey(versions.map((v) => v.key)), name: "", weight: 0, builderData: newPage }]))}
        >
          <Plus className="size-4" aria-hidden />
          {t.add}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange(evenly(versions))}>
          {t.even}
        </Button>
      </div>
      <p className="text-xs text-ink-soft">{versions.some((v) => v.locked) ? t.lockedHint : t.copyHint}</p>
    </fieldset>
  );
}

/** "B" or "B · Short headline". */
export function versionLabel(v: { key: string; name?: string }, control: string): string {
  if (v.key === CONTROL_KEY) return control;
  return v.name && v.name !== v.key ? `${v.key} · ${v.name}` : v.key;
}

/** The variants as the API takes them: every version but A carries its page. */
export function toPayload(versions: VersionDraft[]) {
  return versions.map((v) => ({
    key: v.key,
    name: v.name.trim() || v.key,
    weight: v.weight,
    ...(v.key === CONTROL_KEY ? {} : { builderData: v.builderData }),
  }));
}
