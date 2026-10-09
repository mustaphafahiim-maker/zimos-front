import { useEffect, useState } from "react";
import { accountInvites } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useEmailConfirmState } from "@/lib/emailConfirm";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { AuthLink } from "@/pages/AuthShell";

const STRINGS = {
  en: { invitations: "Invitations", waiting: "You have {n} team invitations waiting", waitingOne: "You have a team invitation waiting", see: "See them" },
  ar: { invitations: "الدعوات", waiting: "عندك {n} دعوات لفرق مستنياك", waitingOne: "عندك دعوة لفريق مستنياك", see: "شوفها" },
} satisfies Messages;

/** How many team invitations wait for this account (0 while unknown, or when the call fails). */
export function useInviteCount(): number {
  const { user } = useAuth();
  const { confirmedVersion } = useEmailConfirmState();
  const [count, setCount] = useState(0);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    accountInvites(apiClient)
      .then((answer) => live && setCount(answer.invites.length))
      .catch(() => {
        // No badge on a guess.
      });
    return () => {
      live = false;
    };
  }, [userId, confirmedVersion]);
  return count;
}

/** The label of the store switcher's line, with its count. */
export function useInvitesLabel() {
  return useT(STRINGS).invitations;
}

/** The count on the switcher: a small pill in the brand colour. */
export function InviteCountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={`inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] leading-5 font-semibold text-primary-foreground tabular-nums ${className ?? ""}`}>
      {fmt("{n}", { n: count })}
    </span>
  );
}

/** On the store picker: one line when invitations wait, nothing otherwise. */
export function InvitesWaitingLine() {
  const t = useT(STRINGS);
  const count = useInviteCount();
  if (count <= 0) return null;
  return (
    <p role="status" data-slot="auth-well" className="mt-4 flex flex-wrap items-center justify-between gap-x-3 rounded-[1.25rem] border border-line bg-paper-raised px-4 py-1.5 text-sm text-ink">
      {count === 1 ? t.waitingOne : fmt(t.waiting, { n: count })}
      <AuthLink to="/invites">{t.see}</AuthLink>
    </p>
  );
}
