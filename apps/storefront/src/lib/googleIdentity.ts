/**
 * Google Identity Services, as the shopper sign-in uses it (frontend-handoff
 * 217, 279): Google's own "Sign in with Google" button, which hands the
 * browser an ID token for the API to verify. The script comes from Google and
 * is asked for only by a component that already knows the store offers Google
 * sign-in — a store without it never loads anything from Google.
 */

/** The part of `google.accounts.id` this app calls. */
export interface GoogleAccountsId {
  initialize(options: {
    client_id: string;
    /** The store's sign-in nonce from GET /account/google: the API refuses a token without it. */
    nonce?: string;
    callback: (response: { credential?: string }) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    ux_mode?: "popup" | "redirect";
    use_fedcm_for_button?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      logo_alignment?: "left" | "center";
      /** Pixels, 200–400. */
      width?: number;
      locale?: string;
    }
  ): void;
  cancel(): void;
}

export const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";

type GoogleWindow = Window & { google?: { accounts?: { id?: GoogleAccountsId } } };

const ready = (): GoogleAccountsId | null => (typeof window === "undefined" ? null : ((window as GoogleWindow).google?.accounts?.id ?? null));

let loading: Promise<GoogleAccountsId> | null = null;

/**
 * Loads Google's script once for the page and answers with
 * `google.accounts.id`. A failure (blocked, offline) rejects, and the next
 * call tries again.
 */
export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  const existing = ready();
  if (existing) return Promise.resolve(existing);
  if (loading) return loading;
  loading = new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_SCRIPT;
    script.async = true;
    script.defer = true;
    const fail = () => {
      script.remove();
      loading = null;
      reject(new Error("Google Identity Services did not load"));
    };
    script.onload = () => {
      const api = ready();
      if (api) resolve(api);
      else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}
