import { useId, useMemo, useState } from "react";
import { apiFieldProblems, isApiErrorCode } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/context/AuthContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";

/**
 * Who an order email's "Send test" goes to (handoff item 298). The server
 * sends a test only to the signed-in person or an active member of the store's
 * team, and 50 a day at most — so there is no free-text address: the test goes
 * to you unless you pick a teammate here.
 *
 * The team list needs users.manage. Without it (or when it cannot be read) the
 * picker is not shown and the test goes to the signed-in person, as before.
 */

const STRINGS = {
  en: {
    label: "Send the test to",
    me: "Me — {email}",
    member: "{name} — {email}",
    notTeam: "Test emails go to you or a member of your team",
  },
  ar: {
    label: "ابعت التجربة لـ",
    me: "أنا — {email}",
    member: "{name} — {email}",
    notTeam: "الإيميل التجريبي بيروح لك أو لحد من فريق المتجر بس",
  },
} satisfies Messages;

export interface OrderEmailTestRecipient {
  /** The signed-in person first, then the store's active members. */
  options: { email: string; label: string }[];
  /** The address picked (the signed-in person's until another is chosen). */
  value: string;
  pick: (email: string) => void;
  /** What to send as `to`: a teammate's address, or undefined for the signed-in person (the server's default). */
  to: string | undefined;
  /**
   * A refusal that is about the test itself, not about the email being edited,
   * in the reader's words: `to` is not on the team (422 on `to`), or the day's
   * tests are used up (429 TOO_MANY_TEST_EMAILS). Null for anything else.
   */
  refusal: (err: unknown) => string | null;
}

export function useOrderEmailTestRecipient(): OrderEmailTestRecipient {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const { user } = useAuth();
  const own = user?.email ?? "";
  const team = useAsync(() => apiClient.listWorkspaceMembers(workspaceId).catch(() => []), [workspaceId]);
  const [picked, setPicked] = useState("");

  const options = useMemo(() => {
    const out = own ? [{ email: own, label: fmt(t.me, { email: own }) }] : [];
    const seen = new Set([own.toLowerCase()]);
    for (const member of team.data ?? []) {
      const email = member.user?.email;
      if (member.status !== "active" || !email || seen.has(email.toLowerCase())) continue;
      seen.add(email.toLowerCase());
      out.push({ email, label: member.user?.fullName ? fmt(t.member, { name: member.user.fullName, email }) : email });
    }
    return out;
  }, [own, team.data, t]);

  const value = options.some((o) => o.email === picked) ? picked : own;

  return {
    options,
    value,
    pick: setPicked,
    to: value && value !== own ? value : undefined,
    refusal: (err) => {
      if (apiFieldProblems(err).some((p) => p.field === "to")) return t.notTeam;
      if (isApiErrorCode(err, "TOO_MANY_TEST_EMAILS")) return errorMessage(err);
      return null;
    },
  };
}

/** The picker beside "Send test". Nothing to pick from with only yourself on the list. */
export function OrderEmailTestRecipientField({ state, disabled }: { state: OrderEmailTestRecipient; disabled?: boolean }) {
  const t = useT(STRINGS);
  const id = useId();
  if (state.options.length < 2) return null;
  return (
    <div className="flex min-w-0 max-w-full items-center gap-2">
      <label htmlFor={id} className="shrink-0 text-xs text-ink-soft">
        {t.label}
      </label>
      <Select
        id={id}
        value={state.value}
        disabled={disabled}
        className="h-11 min-w-0 max-w-64 sm:h-9 sm:max-w-80"
        // Choosing who gets the test is not an edit to the email: it must not make the dialog ask «تسيب التعديلات؟».
        onInput={(e) => e.stopPropagation()}
        onChange={(e) => {
          e.stopPropagation();
          state.pick(e.target.value);
        }}
      >
        {state.options.map((option) => (
          <option key={option.email} value={option.email}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
