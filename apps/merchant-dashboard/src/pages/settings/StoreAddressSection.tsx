import { useId, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@store-builder/ui";
import { ApiError, storeAddressChange, storeAddressPrevious } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { storeHost } from "@/lib/storeAddress";
import { useSlugCheck } from "@/lib/useSlugCheck";
import { formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { StoreAddressField } from "@/components/StoreAddressField";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";

/** System roles holding workspace.manage, which moving the address needs. */
const EDITOR_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager"]);

const STRINGS = {
  en: {
    title: "Store address",
    description: "The free address your store is served on. Your own domain, if you connected one, is not affected.",
    current: "Your store is at",
    change: "Change address",
    cancel: "Cancel",
    save: "Use this address",
    saving: "Saving…",
    confirmTitle: "Move your store to the new address?",
    confirmBody:
      "Links to {old} keep working: visitors are sent on to {address}. {old} stays yours — no other store can take it — and you can come back to it later.",
    confirm: "Move the store",
    moved: "Your store is now at {address}.",
    previous: "Previous addresses (they send visitors here)",
    since: "until {date}",
    forbidden: "Only the store owner or a manager can change the store address.",
  },
  ar: {
    title: "عنوان المتجر",
    description: "العنوان المجاني اللي متجرك شغّال عليه. الدومين الخاص بيك، لو ربطت واحد، مش بيتأثر.",
    current: "متجرك على",
    change: "غيّر العنوان",
    cancel: "إلغاء",
    save: "استخدم العنوان ده",
    saving: "جارٍ الحفظ…",
    confirmTitle: "تنقل متجرك للعنوان الجديد؟",
    confirmBody:
      "اللينكات القديمة على {old} هتفضل شغّالة وبتودّي الزوار لـ {address}. و{old} هيفضل بتاعك — محدش تاني يقدر ياخده — وتقدر ترجعله بعدين.",
    confirm: "انقل المتجر",
    moved: "متجرك دلوقتي على {address}.",
    previous: "عناوين قديمة (بتودّي الزوار هنا)",
    since: "لحد {date}",
    forbidden: "صاحب المتجر أو المدير بس اللي يقدر يغيّر عنوان المتجر.",
  },
} satisfies Messages;

/**
 * SPEC §17.3 account settings → the subdomain: see the store's address, move
 * it (checked live as it is typed), and the previous ones that still send
 * visitors here (backend workspaces/slugHistory.js).
 */
export function StoreAddressSection() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const fieldId = useId();
  const { currentWorkspace, refresh } = useWorkspace();
  const current = currentWorkspace?.slug ?? "";
  const [forbidden, setForbidden] = useState(false);
  const canEdit = EDITOR_ROLES.has(currentWorkspace?.role ?? "") && !forbidden;

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const check = useSlugCheck(editing && value !== current ? value : "", workspaceId);
  const previous = useAsync(() => (canEdit ? storeAddressPrevious(apiClient, workspaceId) : Promise.resolve([])), [workspaceId, canEdit, current]);

  const ready = editing && value !== "" && value !== current && check.status === "available";

  async function move() {
    setMoving(true);
    setMoveError(null);
    try {
      const { slug } = await storeAddressChange(apiClient, workspaceId, value);
      toast.success(fmt(t.moved, { address: storeHost(slug) }));
      setEditing(false);
      setConfirming(false);
      await refresh({ silent: true });
      void previous.refresh({ silent: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        setEditing(false);
        setConfirming(false);
        setError(t.forbidden);
        return;
      }
      setMoveError(errorMessage(err));
    } finally {
      setMoving(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>

      <div className="mt-4 max-w-2xl space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        {!editing ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink">
              {t.current}{" "}
              <bdi dir="ltr" className="font-medium">
                {current ? storeHost(current) : "—"}
              </bdi>
            </p>
            {canEdit && current && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={() => {
                  setValue(current);
                  setError(null);
                  setEditing(true);
                }}
              >
                {t.change}
              </Button>
            )}
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready) setConfirming(true);
            }}
          >
            <StoreAddressField id={fieldId} value={value} onChange={setValue} state={value === current ? { status: "empty" } : check} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="min-h-11" disabled={!ready}>
                {t.save}
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditing(false)}>
                {t.cancel}
              </Button>
            </div>
          </form>
        )}

        {(previous.data?.length ?? 0) > 0 && (
          <div>
            <h3 className="text-sm font-medium text-ink">{t.previous}</h3>
            <ul className="mt-1 space-y-1 text-sm text-ink-soft">
              {previous.data!.map((p) => (
                <li key={p.slug}>
                  <bdi dir="ltr">{storeHost(p.slug)}</bdi> · {fmt(t.since, { date: formatDateTime(p.retiredAt) })}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Dialog open={confirming} onOpenChange={(open) => !moving && setConfirming(open)}>
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.confirmTitle}</DialogTitle>
            <p className="font-medium text-ink">
              <bdi dir="ltr">{storeHost(value)}</bdi>
            </p>
            <DialogDescription>{fmt(t.confirmBody, { address: storeHost(value), old: storeHost(current) })}</DialogDescription>
          </DialogHeader>
          {moveError && <Alert variant="danger">{moveError}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" className="min-h-11" />} disabled={moving}>
              {t.cancel}
            </DialogClose>
            <Button type="button" className="min-h-11" disabled={moving} onClick={() => void move()}>
              {moving ? t.saving : t.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
