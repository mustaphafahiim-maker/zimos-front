import { getDictionary } from "@/lib/i18n";

/** Outside any store (e.g. an unknown workspace id) — bilingual, neutral. */
export default function NotFound() {
  const ar = getDictionary("ar");
  const en = getDictionary("en");
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-paper px-6 py-24 text-center font-sans">
      <p className="text-6xl font-bold tracking-tight text-primary">404</p>
      <div lang="ar" dir="rtl" className="mt-6">
        <h1 className="text-2xl font-bold text-ink">{ar.notFound.title}</h1>
        <p className="mt-2 max-w-md text-sm text-ink-soft">{ar.notFound.body}</p>
      </div>
      <div lang="en" dir="ltr" className="mt-6">
        <p className="text-lg font-semibold text-ink">{en.notFound.title}</p>
        <p className="mt-1 max-w-md text-sm text-ink-soft">{en.notFound.body}</p>
      </div>
    </main>
  );
}
