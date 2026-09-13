import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/CartProvider";
import { fontVariables } from "./fonts";

export const metadata: Metadata = {
  title: "ZIMOS Store",
  description: "Storefront powered by ZIMOS",
};

/** Set the theme class before first paint — no flash of the wrong theme. */
const themeScript = `(function(){try{var e=document.documentElement,s=null;try{s=localStorage.getItem("theme")}catch(_){}var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(_){}})();`;

/**
 * The root layout can't know which store (or which locale) a request is for,
 * so `lang`/`dir` here are only the neutral default. Store routes set the real
 * values on their own wrapper and sync them onto <html> (see DocumentLocale).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={`h-full antialiased ${fontVariables}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
