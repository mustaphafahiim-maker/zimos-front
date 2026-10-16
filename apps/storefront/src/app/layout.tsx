import type { Metadata } from "next";
import "./globals.css";
// The original look's Fraunces, Plus Jakarta Sans and Tajawal, self-hosted (baseFonts.ts).
import "./baseFonts";
import { CartProvider } from "@/lib/CartProvider";
import { documentLocale } from "@/lib/documentLocale";

export const metadata: Metadata = {
  title: "Zimos Store",
  description: "Storefront powered by Zimos",
};

/** Set the theme class before first paint — no flash of the wrong theme. */
const themeScript = `(function(){try{var e=document.documentElement,s=null;try{s=localStorage.getItem("theme")}catch(_){}var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(_){}})();`;

/**
 * `lang`/`dir` on <html> are the store's language for this shopper, in the
 * server's own HTML (lib/documentLocale.ts, from the store the proxy named):
 * search engines and screen readers read them from the first response. A
 * request for no store gets the neutral default, and store routes still sync
 * them after a language switch (DocumentLocale).
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, dir } = await documentLocale();
  return (
    <html lang={lang} dir={dir} suppressHydrationWarning className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
