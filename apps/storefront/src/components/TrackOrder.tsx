"use client";

import { useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { isEgyptianMobile, normalizePhone } from "@/lib/egypt";
import { trackOrder, type TrackResult } from "@/lib/mockCommerce";
import { useStore } from "@/lib/StoreContext";
import { SearchIcon } from "./Icons";
import { StatusTimeline } from "./StatusTimeline";
import { btnPrimaryLg, card, container, input, label } from "./ui";

export function TrackOrder() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { t, intlLocale } = useStore();

  const [phone, setPhone] = useState("");
  const [number, setNumber] = useState("");
  const [errors, setErrors] = useState<{ phone?: string; number?: string }>({});
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<TrackResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!isEgyptianMobile(phone)) next.phone = t.form.errors.phone;
    if (!number.trim()) next.number = t.track.errors.orderNumber;
    setErrors(next);
    if (next.phone) return document.getElementById("track-phone")?.focus();
    if (next.number) return document.getElementById("track-number")?.focus();

    setStatus("loading");
    setResult(await trackOrder(workspaceId, normalizePhone(phone), number));
    setStatus("done");
  }

  return (
    <main className={`${container} flex-1 py-10 sm:py-14`}>
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <SearchIcon size={28} />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-ink sm:text-3xl">{t.track.title}</h1>
          <p className="mt-2 text-sm text-ink-soft">{t.track.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className={`${card} mt-8 space-y-4 p-5 sm:p-6`}>
          <div>
            <label htmlFor="track-phone" className={label}>
              {t.form.phone}
            </label>
            <input
              id="track-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              dir="ltr"
              placeholder={t.form.phonePlaceholder}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? "track-phone-error" : undefined}
              className={`${input} text-start rtl:text-end`}
            />
            {errors.phone && (
              <p id="track-phone-error" className="mt-1 text-xs font-medium text-danger">
                {errors.phone}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="track-number" className={label}>
              {t.track.orderNumber}
            </label>
            <input
              id="track-number"
              type="text"
              inputMode="text"
              autoComplete="off"
              dir="ltr"
              placeholder={t.track.orderNumberPlaceholder}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              aria-invalid={errors.number ? true : undefined}
              aria-describedby={errors.number ? "track-number-error" : undefined}
              className={`${input} text-start rtl:text-end`}
            />
            {errors.number && (
              <p id="track-number-error" className="mt-1 text-xs font-medium text-danger">
                {errors.number}
              </p>
            )}
          </div>
          <button type="submit" disabled={status === "loading"} className={btnPrimaryLg}>
            {status === "loading" ? t.track.searching : t.track.submit}
          </button>
        </form>

        <div aria-live="polite" className="mt-6">
          {status === "done" && !result && (
            <p className="rounded-2xl bg-danger-soft px-5 py-4 text-sm text-danger">{t.track.notFound}</p>
          )}
          {status === "done" && result && (
            <section className={`${card} p-5 sm:p-6`} aria-labelledby="track-status-title">
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="track-status-title" className="text-lg font-semibold text-ink">
                  {t.track.status}
                </h2>
                <span dir="ltr" className="text-sm font-bold text-ink">
                  #{result.orderNumber}
                </span>
              </div>
              <StatusTimeline stage={result.stage} />
              {result.updatedAt && (
                <p className="mt-5 text-xs text-ink-muted">
                  {t.track.lastUpdate}:{" "}
                  {new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" }).format(
                    new Date(result.updatedAt)
                  )}
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
