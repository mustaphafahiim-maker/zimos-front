/** The account's «حسابي الآجل» page (handoff 229), as a store-relative path. */
export const ON_ACCOUNT_PATH = "/account/on-account";

/** Whether an account path is that page (the shell's own tabs then stand unselected). */
export function isAccountOnAccountPath(pathname: string): boolean {
  return pathname.endsWith(ON_ACCOUNT_PATH);
}
