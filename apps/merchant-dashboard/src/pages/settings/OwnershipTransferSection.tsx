import { useEffect, useId, useState, type FormEvent } from "react";
import { IconLock } from "@/components/icons";
import { Alert, Button } from "@store-builder/ui";
import {
  ApiError,
  apiErrorDetails,
  apiFieldProblems,
  isApiErrorCode,
  securityTwoFactorStatus,
  storeTransferCandidates,
  storeTransferOfferSend,
  type StoreTransferCandidate,
  type StoreTransferKeepAs,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { SettingsCard } from "./sections/SettingsCard";
import { OwnershipOfferPanel, useOwnershipOfferTexts } from "./OwnershipOfferPanel";

/**
 * Settings → Team → «نقل ملكية المتجر» (frontend-handoff 252): the store's
 * owner hands it to an active member of the team, with their password. They
 * choose what they become afterwards — store manager, an owner beside the new
 * one, or out of the team. The plan and the subscription stay with the store.
 *
 * Owner only. The store's owner is the account in `ownerUserId` — one store
 * can have several people with the Owner role, and only that one may transfer
 * it. A co-owner is told so; other roles don't see the block at all. The
 * server decides in the end (403 NOT_STORE_OWNER), and that answer draws the
 * same no-permission note, not an error.
 *
 * There is no undo: only the new owner can hand the store back.
 */

const STRINGS = {
  en: {
    title: "Transfer ownership",
    description: "Hand this store to someone on your team. Its plan, team and settings go with it, and only they can hand it back.",
    open: "Transfer ownership",
    noCandidates: "Nobody on your team can take the store yet. Invite the person first: they show here once they've joined and their account is active.",
    notOwnerTitle: "Only the store's owner can transfer it",
    notOwnerBody: "This store belongs to another account on the team. Ask them to transfer it from here.",
    dialogTitle: "Transfer {store}",
    dialogDescription: "The new owner gets the Owner role. The plan and subscription stay with the store, and you both get an email.",
    newOwner: "New owner",
    pickMember: "Choose a team member",
    memberOption: "{name} — {email}",
    afterTitle: "After the transfer",
    keep_workspace_manager: "Stay as store manager",
    keep_workspace_manager_hint: "You keep running the store, without the owner's rights.",
    keep_owner: "Stay as an owner too",
    keep_owner_hint: "You keep the Owner role beside them. The store is still theirs.",
    keep_leave: "Leave the store",
    keep_leave_hint: "You lose access to this store at once.",
    password: "Your password",
    passwordHint: "To confirm it is you.",
    passwordWrong: "That password is not right.",
    noPassword: "Set a password on your account first",
    noPasswordHint: "Your account has no password yet (it signs in with Google). Add one from “Forgot password?” on the sign-in page, then come back.",
    confirmText: "The store will belong to {name} — plan, team and settings. Only they can hand it back",
    confirm: "Transfer the store",
    transferring: "Transferring…",
    cancel: "Cancel",
    done: "{name} now owns the store",
    pickSomeoneElse: "Pick someone else: the store is already yours.",
    memberGone: "This person is no longer an active member of the team. Pick someone else.",
    planFull: "{name} already has as many stores as their plan allows ({used} of {max}). They need a bigger plan before they can take this one.",
  },
  ar: {
    title: "نقل ملكية المتجر",
    description: "سلّم المتجر ده لحد من فريقك. الخطة والفريق والإعدادات بتروح معاه، ومينفعش ترجّعه غير لو هو رجّعهولك.",
    open: "نقل ملكية المتجر",
    noCandidates: "مفيش حد في فريقك ينفع ياخد المتجر لسه. ادعي الشخص الأول: هيظهر هنا أول ما ينضم وحسابه يبقى مفعّل.",
    notOwnerTitle: "نقل الملكية لصاحب المتجر بس",
    notOwnerBody: "المتجر ده ملك حساب تاني في الفريق. اطلب منه ينقله من هنا.",
    dialogTitle: "نقل ملكية {store}",
    dialogDescription: "المالك الجديد بياخد دور المالك. الخطة والاشتراك بيفضلوا مع المتجر، وإنتو الاتنين هيوصلكم إيميل.",
    newOwner: "المالك الجديد",
    pickMember: "اختار عضو من الفريق",
    memberOption: "{name} — {email}",
    afterTitle: "بعد النقل",
    keep_workspace_manager: "أفضل في المتجر كمدير",
    keep_workspace_manager_hint: "هتفضل تدير المتجر، من غير صلاحيات المالك.",
    keep_owner: "أفضل مالك معاه",
    keep_owner_hint: "هتفضل بدور المالك جنبه. بس المتجر بيبقى ملكه هو.",
    keep_leave: "أخرج من المتجر",
    keep_leave_hint: "مش هتقدر تدخل المتجر ده تاني من دلوقتي.",
    password: "كلمة السر",
    passwordHint: "عشان نتأكد إنه إنت.",
    passwordWrong: "كلمة السر دي مش صح.",
    noPassword: "اعمل باسورد لحسابك الأول",
    noPasswordHint: "حسابك لسه مالوش باسورد (بتدخل بجوجل). اعمل واحد من «نسيت كلمة المرور؟» في صفحة الدخول، وبعدين ارجع هنا.",
    confirmText: "المتجر هيبقى ملك {name} — الخطة والفريق والإعدادات معاه. مينفعش ترجّعه غير لو هو رجّعهولك",
    confirm: "انقل المتجر",
    transferring: "بننقل…",
    cancel: "إلغاء",
    done: "المتجر بقى ملك {name}",
    pickSomeoneElse: "اختار حد تاني: المتجر ملكك إنت أصلًا.",
    memberGone: "الشخص ده مبقاش عضو مفعّل في الفريق. اختار حد تاني.",
    planFull: "{name} عنده أقصى عدد متاجر في خطته ({used} من {max}). لازم يرقّي خطته الأول عشان ياخد المتجر ده.",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

const KEEP_AS: StoreTransferKeepAs[] = ["workspace_manager", "owner", "leave"];

const nameOf = (person: { fullName: string | null; email: string }) => person.fullName?.trim() || person.email;

export function OwnershipTransferSection() {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  if (!currentWorkspace || !user) return null;
  const isOwner = currentWorkspace.ownerUserId === user.id;
  // Someone with the Owner role who is not the store's owner: told why the button is not theirs.
  const coOwner = !isOwner && currentWorkspace.role === "owner";
  if (!isOwner && !coOwner) return null;

  return (
    <SettingsCard tone="danger" title={t.title} description={t.description}>
      {isOwner ? <OwnerControls t={t} storeName={currentWorkspace.name} /> : <NotOwnerNote t={t} />}
    </SettingsCard>
  );
}

/** The no-permission state: said plainly, with nothing to press. */
function NotOwnerNote({ t }: { t: T }) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius)] bg-paper-sunken px-3 py-3">
      <IconLock className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{t.notOwnerTitle}</p>
        <p className="text-xs text-ink-soft">{t.notOwnerBody}</p>
      </div>
    </div>
  );
}

function OwnerControls({ t, storeName }: { t: T; storeName: string }) {
  const workspaceId = useWorkspaceId();
  const candidates = useAsync(() => storeTransferCandidates(apiClient, workspaceId), [workspaceId]);
  const [open, setOpen] = useState(false);
  // The server said this account is not the owner after all (the list in hand was stale).
  const [refused, setRefused] = useState(false);
  // The transfer is an offer the new owner accepts (handoff 379): the pending one is shown above the button.
  const [offerVersion, setOfferVersion] = useState(0);
  const notOwner = refused || (candidates.error instanceof ApiError && candidates.error.status === 403);
  if (notOwner) return <NotOwnerNote t={t} />;

  const list = candidates.data ?? [];
  return (
    <DataState loading={candidates.loading} error={candidates.error} onRetry={() => void candidates.refresh()}>
      <OwnershipOfferPanel version={offerVersion} />
      <div className="space-y-3">
        {list.length === 0 && <p className="text-sm text-ink-soft">{t.noCandidates}</p>}
        <Button variant="danger" className="min-h-11" disabled={list.length === 0} onClick={() => setOpen(true)}>
          {t.open}
        </Button>
      </div>
      {open && (
        <TransferDialog
          t={t}
          storeName={storeName}
          candidates={list}
          onClose={() => setOpen(false)}
          onSent={() => setOfferVersion((v) => v + 1)}
          onNotOwner={() => {
            setOpen(false);
            setRefused(true);
          }}
          onStale={() => void candidates.refresh({ silent: true })}
        />
      )}
    </DataState>
  );
}

function TransferDialog({
  t,
  storeName,
  candidates,
  onClose,
  onSent,
  onNotOwner,
  onStale,
}: {
  t: T;
  storeName: string;
  candidates: StoreTransferCandidate[];
  onClose: () => void;
  /** The offer went out: the store has not moved, it waits for the person's yes. */
  onSent: () => void;
  onNotOwner: () => void;
  /** The list no longer matches the team: read it again. */
  onStale: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const offerText = useOwnershipOfferTexts();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const groupId = useId();
  const confirmId = useId();
  const [memberId, setMemberId] = useState(candidates.length === 1 ? candidates[0].userId : "");
  const [keepAs, setKeepAs] = useState<StoreTransferKeepAs>("workspace_manager");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // An account made through Google has no password to type: said before the form is filled in.
  const [hasPassword, setHasPassword] = useState(true);
  useEffect(() => {
    let alive = true;
    securityTwoFactorStatus(apiClient)
      .then((status) => alive && setHasPassword(status.hasPassword !== false))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const member = candidates.find((c) => c.userId === memberId) ?? null;
  const labels = t as Record<string, string>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!member || busy) return;
    setBusy(true);
    setError(null);
    setPasswordError(undefined);
    try {
      // 201 with an offer: nothing changes for this account until the person accepts it.
      const offer = await storeTransferOfferSend(apiClient, workspaceId, { newOwnerUserId: member.userId, password, keepAs });
      toast.success(fmt(offerText.sent, { name: offer?.toUser ? nameOf(offer.toUser) : nameOf(member) }));
      onClose();
      onSent();
    } catch (err) {
      const problems = apiFieldProblems(err);
      const passwordProblem = problems.find((p) => p.field === "password");
      if (passwordProblem) {
        // The account has no password at all, or this one is wrong: the server tells which in its sentence.
        if (/set a password/i.test(passwordProblem.message)) setHasPassword(false);
        else setPasswordError(t.passwordWrong);
      } else if (problems.some((p) => p.field === "newOwnerUserId")) {
        setError(t.pickSomeoneElse);
      } else if (err instanceof ApiError && (err.code as string | undefined) === "NEW_OWNER_NOT_CONFIRMED") {
        setError(offerText.notConfirmed);
      } else if (isApiErrorCode(err, "NOT_STORE_OWNER")) {
        onNotOwner();
      } else if (err instanceof ApiError && err.status === 404) {
        setError(t.memberGone);
        onStale();
      } else if (isApiErrorCode(err, "PLAN_LIMIT_REACHED")) {
        const limit = apiErrorDetails<{ max?: number; used?: number }>(err);
        setError(fmt(t.planFull, { name: nameOf(member), used: limit?.used ?? "", max: limit?.max ?? "" }));
      } else {
        setError(errorMessage(err));
      }
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={fmt(t.dialogTitle, { store: storeName })} description={t.dialogDescription}>
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label={t.newOwner} required>
          {({ id, ...aria }) => (
            <Select id={id} {...aria} className="h-11" value={memberId} disabled={busy} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">{t.pickMember}</option>
              {candidates.map((candidate) => (
                <option key={candidate.userId} value={candidate.userId}>
                  {candidate.fullName?.trim() ? fmt(t.memberOption, { name: candidate.fullName.trim(), email: candidate.email }) : candidate.email}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-ink">{t.afterTitle}</legend>
          {KEEP_AS.map((option) => (
            <label key={option} className="flex min-h-11 cursor-pointer items-start gap-2 rounded-md border border-line p-3">
              <input
                type="radio"
                name={groupId}
                className="mt-1 accent-primary"
                checked={keepAs === option}
                disabled={busy}
                onChange={() => setKeepAs(option)}
              />
              <span>
                <span className="block text-sm font-medium text-ink">{labels[`keep_${option}`]}</span>
                <span className="block text-xs text-ink-soft">{labels[`keep_${option}_hint`]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {hasPassword ? (
          <TextField
            label={t.password}
            hint={t.passwordHint}
            error={passwordError}
            type="password"
            autoComplete="current-password"
            required
            disabled={busy}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError(undefined);
            }}
          />
        ) : (
          <Alert variant="danger">
            <span className="block font-medium">{t.noPassword}</span>
            <span className="block">{t.noPasswordHint}</span>
          </Alert>
        )}

        {member && (
          <p id={confirmId} className="rounded-[var(--radius)] bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
            {fmt(t.confirmText, { name: nameOf(member) })}
          </p>
        )}
        {error && <Alert variant="danger">{error}</Alert>}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button
            type="submit"
            variant="danger"
            className="min-h-11"
            aria-describedby={member ? confirmId : undefined}
            disabled={busy || !member || !hasPassword || password === ""}
          >
            {busy ? t.transferring : t.confirm}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
