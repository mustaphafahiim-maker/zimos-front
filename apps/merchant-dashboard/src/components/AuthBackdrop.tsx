import { ZimosLogo } from "@/components/ZimosLogo";

/**
 * What sits behind the sign-in pages: three slow, blurred shapes in the brand
 * colours and the logo at the top. The page's own content is laid over it as
 * one Glass card (`.auth-glass` in index.css). Decorative only — the shapes
 * stop moving for reduced motion.
 */
export function AuthBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <span className="auth-blob" data-n="1" />
        <span className="auth-blob" data-n="2" />
        <span className="auth-blob" data-n="3" />
      </div>
      <header className="absolute inset-x-0 top-6 z-10 flex justify-center">
        <ZimosLogo height={30} />
      </header>
    </>
  );
}
