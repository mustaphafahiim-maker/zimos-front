"use client";

import type { TrackResult } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { useWhenInWords } from "./StatusTimeline";

/** What the store wrote for the customer on this order (order notes marked public). */
export interface TrackNote {
  body: string;
  createdAt: string;
}

const TITLE = { en: "Message from the store", ar: "رسالة من المتجر" };

export function trackNotes(result: TrackResult): TrackNote[] {
  return (result as TrackResult & { notes?: TrackNote[] }).notes ?? [];
}

export function TrackOrderNotes({ result }: { result: TrackResult }) {
  const { intlLocale } = useStore();
  const when = useWhenInWords();
  const notes = trackNotes(result);
  if (notes.length === 0) return null;
  const title = intlLocale.startsWith("ar") ? TITLE.ar : TITLE.en;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-2 space-y-2">
        {notes.map((note, i) => (
          <li key={i} className="rounded-xl border border-line bg-primary-soft px-3.5 py-3 text-sm text-ink">
            <p className="whitespace-pre-line leading-relaxed" dir="auto">
              {note.body}
            </p>
            <p className="mt-1 text-xs text-ink-soft">{when(note.createdAt)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
