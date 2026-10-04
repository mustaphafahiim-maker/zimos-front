import type { Metadata } from "next";
import "./globals.css";
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
  const { lang, dir } = await documentLocale();
  // The store's own head code (custom code), in the first response: domain checks read it there.
  const headCode = await serverHeadCode();
  return (
    <html lang={lang} dir={dir} suppressHydrationWarning className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Tajawal:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        {headCode && <HeadCode head={headCode.head} css={headCode.css} />}
      </head>
      <body className="min-h-full flex flex-col">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
