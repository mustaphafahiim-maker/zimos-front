import { useEffect, useState, type FormEvent } from "react";
import { Clock, X } from "lucide-react";
import {
  Alert,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@store-builder/ui";
import {
  ApiError,
  LOST_ORDER_ABANDON_MINUTES_RANGE,
  LOST_ORDER_DEFAULT_ABANDON_MINUTES,
  lostOrdersSaveAbandonAfter,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";

/** System roles carrying workspace.manage, which the setting needs (fraud_rules, workspaceService.js). */
const EDITOR_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager"]);
const PRESETS = [15, 30, 60, 180] as const;
const { min: MIN, max: MAX } = LOST_ORDER_ABANDON_MINUTES_RANGE;

const STRINGS = {
  en: {
    line: "A checkout counts as left after {n} minutes without activity.",
    change: "Change",
    close: "Close",
    title: "When does a checkout count as lost?",
    description:
      "After this many minutes with nothing typed, the checkout moves to Lost orders and your recovery automations start. A shorter time reaches the shopper sooner; a longer one leaves slow typists alone.",
    minutes: "Minutes without activity",
    hint: "Between {min} and {max} minutes. The default is {def}.",
    preset: "{n} min",
    invalid: "Enter whole minutes between {min} and {max}.",
    reset: "Use the default",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    saved: "Saved. Checkouts now count as lost after {n} minutes.",
    forbidden: "Only the store owner or a manager can change this.",
  },
  ar: {
    line: "يُعتبر الطلب متروكًا بعد {n} دقيقة بدون نشاط.",
    change: "تغيير",
    close: "إغلاق",
    title: "إمتى الطلب يتحسب مفقود؟",
    description:
      "بعد عدد الدقايق ده من غير ما العميل يكتب حاجة، الطلب بينتقل للطلبات المفقودة وتبدأ أتمتة الاسترجاع. الوقت الأقصر بيوصل للعميل أسرع، والأطول بيسيب اللي بيكتب ببطء في حاله.",
    minutes: "دقايق بدون نشاط",
    hint: "من {min} لـ {max} دقيقة. الافتراضي {def}.",
    preset: "{n} دقيقة",
    invalid: "اكتب عدد دقايق صحيح من {min} لـ {max}.",
    reset: "رجّع الافتراضي",
    cancel: "إلغاء",
    save: "حفظ",
    saving: "بنحفظ…",
    saved: "تم الحفظ. الطلب هيتحسب مفقود بعد {n} دقيقة.",
    forbidden: "صاحب المتجر أو المدير بس اللي يقدر يغيّر ده.",
  },
} satisfies Messages;

/**
 * The lost-orders timing (SPEC §6.2: `abandoned_after_minutes`): the line
 * under the list, with a "Change" for the roles allowed to set it.
 */
export function LostOrderTiming({ minutes, onSaved }: { minutes: number; onSaved: (minutes: number) => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace, refresh } = useWorkspace();
  const [forbidden, setForbidden] = useState(false);
  const editable = EDITOR_ROLES.has(currentWorkspace?.role ?? "") && !forbidden;

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(minutes));
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(String(minutes));
    setShowErrors(false);
    setError(null);
  }, [open, minutes]);

  const parsed = /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  const invalid = !(parsed >= MIN && parsed <= MAX);

  async function save(next: number | null) {
    setBusy(true);
    setError(null);
    try {
      const stored = await lostOrdersSaveAbandonAfter(apiClient, workspaceId, next);
      toast.success(fmt(t.saved, { n: stored }));
      setOpen(false);
      onSaved(stored);
      void refresh({ silent: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        setOpen(false);
        toast.error(t.forbidden);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (invalid) {
      setShowErrors(true);
      return;
    }
    void save(parsed);
  }

  const form = (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextField
        label={t.minutes}
        required
        dir="ltr"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        hint={fmt(t.hint, { min: MIN, max: MAX, def: LOST_ORDER_DEFAULT_ABANDON_MINUTES })}
        error={showErrors && invalid ? fmt(t.invalid, { min: MIN, max: MAX }) : undefined}
      />
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((n) => (
          <Button
            key={n}
            type="button"
            size="sm"
            variant={parsed === n ? "default" : "outline"}
            aria-pressed={parsed === n}
            onClick={() => setValue(String(n))}
          >
            {fmt(t.preset, { n })}
          </Button>
        ))}
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Button type="button" variant="ghost" onClick={() => void save(null)} disabled={busy || minutes === LOST_ORDER_DEFAULT_ABANDON_MINUTES}>
          {t.reset}
        </Button>
        <div className="flex gap-3">
          <DialogClose render={<Button type="button" variant="outline" />} disabled={busy}>
            {t.cancel}
          </DialogClose>
          <Button type="submit" disabled={busy}>
            {busy ? t.saving : t.save}
          </Button>
        </div>
      </div>
    </form>
  );

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
      <Clock className="size-3.5 shrink-0" aria-hidden />
      <span>{fmt(t.line, { n: minutes })}</span>
      {editable && (
        <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
          <DialogTrigger render={<button type="button" className="font-medium text-primary hover:underline" />}>{t.change}</DialogTrigger>
          <DialogContent showCloseButton={false} className="sm:max-w-lg">
            <DialogHeader className="pe-8">
              <DialogTitle>{t.title}</DialogTitle>
              <DialogDescription>{t.description}</DialogDescription>
            </DialogHeader>
            <DialogClose render={<Button variant="ghost" size="icon" className="absolute end-3 top-3" />} aria-label={t.close} disabled={busy}>
              <X className="size-4" aria-hidden />
            </DialogClose>
            {form}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
