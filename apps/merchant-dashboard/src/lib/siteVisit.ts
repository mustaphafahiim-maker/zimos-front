/**
 * The marketing-site visit a sign-up came from (handoff 339). The site adds
 * `?sv={sessionId}` to its sign-up links; sign-up passes it on as
 * `siteSessionId` so the console can show where the account came from.
 * Nothing is shown to the visitor, and the server ignores it while site
 * analytics is off. Google sign-up does not carry it.
 */

const KEY = "zimos:site-visit";
const VALID = /^[A-Za-z0-9-]{8,64}$/;

function read(): string | null {
  try {
    const fromAddress = new URLSearchParams(window.location.search).get("sv");
    if (fromAddress && VALID.test(fromAddress)) {
      // Kept for the tab, so moving between the sign-up steps does not lose it.
      window.sessionStorage.setItem(KEY, fromAddress);
      return fromAddress;
    }
    const kept = window.sessionStorage.getItem(KEY);
    return kept && VALID.test(kept) ? kept : null;
  } catch {
    return null;
  }
}

// The sign-up page imports this as it opens, while `?sv=` is still in the address.
read();

/** Spread into the POST /auth/register payload: `{ siteSessionId }`, or nothing. */
export function siteVisitForSignup(): { siteSessionId?: string } {
  const id = read();
  return id ? { siteSessionId: id } : {};
}
