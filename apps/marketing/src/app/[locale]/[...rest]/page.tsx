import { notFound } from "next/navigation";

/**
 * Any unknown path below a valid locale (`/ar/does-not-exist`) lands here and
 * renders the localized `[locale]/not-found.tsx` inside the locale layout.
 */
export const dynamicParams = true;

export default function UnknownLocalePath() {
  notFound();
}
