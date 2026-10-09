import type { Metadata } from "next";
import "./globals.css";
import { BASE_FONT_CSS } from "./themeFonts";
import { CartProvider } from "@/lib/CartProvider";
import { documentLocale } from "@/lib/documentLocale";
import { serverHeadCode } from "@/lib/headCode";
import { HeadCode } from "@/components/HeadCode";

export const metadata: Metadata = {
  title: "Zimos Store",
  description: "Storefront powered by Zimos",
};

/** Set the theme class before first paint — no flash of the wrong theme. */
const themeScript = `(function(){try{var e=document.documentElement,s=null;try{s=localStorage.getItem("theme")}catch(_){}var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(_){}})();`;

/**
 * `lang`/`dir` come from the store the proxy named (lib/documentLocale), so
 * the server's HTML already carries the shopper's language; anything that is
 * not a store gets the neutral default. Store routes still sync them onto
 * <html> when the shopper switches language (see DocumentLocale).
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The store's language for <html>, and its own head code (custom code) for the first response
  // — domain checks read it there. Read together: each is a call to the API on a store's page,
  // and neither waits on the other.
  const [{ lang, dir }, headCode] = await Promise.all([documentLocale(), serverHeadCode()]);
  return (
    <html lang={lang} dir={dir} suppressHydrationWarning className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* The default type stacks with their metric-matched fallbacks (app/themeFonts.ts).
            The families themselves are served from this origin: no font stylesheet
            from another host stands between the shopper and the first paint. */}
        <style dangerouslySetInnerHTML={{ __html: BASE_FONT_CSS }} />
        {headCode && <HeadCode head={headCode.head} css={headCode.css} />}
      </head>
      <body className="min-h-full flex flex-col">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
