import { ApiError, type WorkspaceMember, type WorkspaceRole } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";

/**
 * Nobody gives, changes or removes access above their own (handoff 346): what
 * the signed-in teammate may do to each row and role of Settings → Team,
 * worked out from their own role so the screen does not offer what the server
 * refuses (403 ROLE_ABOVE_YOURS).
 */

const STRINGS = {
  en: {
    ownerOnly: "Only an Owner can change an Owner's access",
    roleBeyond: "This role has access you don't have; ask the Owner",
    permissionBeyond: "You don't have this access yourself",
    aboveYours: "You can't give or change access above your own",
    ownerAccess: "Only an Owner can give, change or remove Owner access",
  },
  ar: {
    ownerOnly: "بس المالك يقدر يغيّر صلاحيات المالك",
    roleBeyond: "الدور ده فيه صلاحيات مش عندك، اطلبه من المالك",
    permissionBeyond: "الصلاحية دي مش عندك إنت",
    aboveYours: "مينفعش تدّي أو تغيّر صلاحيات أعلى من صلاحياتك",
    ownerAccess: "بس المالك يقدر يدّي أو يغيّر أو يشيل صلاحيات المالك",
  },
} satisfies Messages;

export function useTeamLimitTexts() {
  return useT(STRINGS);
}

export interface TeamLimits {
  /** False while the caller's own role is not known: nothing is locked on a guess. */
  known: boolean;
  /** Holds Owner access (`*`). */
  isOwner: boolean;
  /** The caller holds this permission. */
  holds: (permission: string) => boolean;
  /** An Owner's row, and the caller is not one: its role and its removal are not theirs to touch. */
  ownerRow: (member: Pick<WorkspaceMember, "role">) => boolean;
  /** Why the caller cannot give this role: it is Owner access, or it holds a permission they lack; null when they can. */
  roleBlock: (roleId: string) => "owner" | "permissions" | null;
}

const OPEN: TeamLimits = { known: false, isOwner: true, holds: () => true, ownerRow: () => false, roleBlock: () => null };

export function teamLimits(members: readonly WorkspaceMember[], roles: readonly WorkspaceRole[], userId: string | undefined): TeamLimits {
  const mine = members.find((member) => userId !== undefined && member.user?.id === userId);
  const myRole = mine ? roles.find((role) => role.id === mine.role.id) : undefined;
  if (!myRole) return OPEN;
  const own = new Set(myRole.permissions);
  const isOwner = own.has("*");
  const holds = (permission: string) => isOwner || own.has(permission);
  const ownerRoleIds = new Set(roles.filter((role) => role.key === "owner" || role.permissions.includes("*")).map((role) => role.id));
  return {
    known: true,
    isOwner,
    holds,
    ownerRow: (member) => !isOwner && (member.role.key === "owner" || ownerRoleIds.has(member.role.id)),
    roleBlock: (roleId) => {
      if (isOwner) return null;
      if (ownerRoleIds.has(roleId)) return "owner";
      const role = roles.find((r) => r.id === roleId);
      return role && role.permissions.some((permission) => !holds(permission)) ? "permissions" : null;
    },
  };
}

/** The sentence for a 403 ROLE_ABOVE_YOURS (the Owner case has its own), or null for any other error. */
export function roleAboveYoursMessage(err: unknown, t: ReturnType<typeof useTeamLimitTexts>): string | null {
  if (!(err instanceof ApiError) || (err.code as string | undefined) !== "ROLE_ABOVE_YOURS") return null;
  return /owner/i.test(err.message) ? t.ownerAccess : t.aboveYours;
}
