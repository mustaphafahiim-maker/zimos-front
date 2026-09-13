import type { ReactNode } from "react";
import type {
  ConfirmVisual as ConfirmCopy,
  DeepDive,
  Dictionary,
  FunnelVisual as FunnelCopy,
  ProfitVisual as ProfitCopy,
} from "@/i18n/dictionary";
import { ChatIcon, CheckIcon, PhoneIcon } from "./icons";
import { SectionHeading } from "./section-heading";
import { container } from "./ui";

/**
 * Three alternating deep-dive rows, each with a CSS UI illustration.
 * Illustrations carry no real figures — relative shapes and "—" only.
 */
export function DeepDives({ copy }: { copy: Dictionary["deepDives"] }) {
  const rows: { key: string; dive: DeepDive; visual: ReactNode }[] = [
    { key: "confirm", dive: copy.confirm, visual: <ConfirmVisual copy={copy.confirm.visual} /> },
    { key: "profit", dive: copy.profit, visual: <ProfitVisual copy={copy.profit.visual} /> },
    { key: "funnels", dive: copy.funnels, visual: <FunnelVisual copy={copy.funnels.visual} /> },
  ];

  return (
    <section id="solutions" aria-labelledby="solutions-heading" className="bg-paper py-20 sm:py-28">
      <div className={container}>
        <SectionHeading
          id="solutions-heading"
          kicker={copy.kicker}
          heading={copy.heading}
          intro={copy.intro}
        />

        <div className="mt-14 space-y-20 lg:mt-20 lg:space-y-28">
          {rows.map(({ key, dive, visual }, i) => {
            const flip = i % 2 === 1;
            return (
              <article
                key={key}
                aria-labelledby={`dive-${key}`}
                className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
              >
                <div className={flip ? "lg:order-2" : undefined}>
                  <p className="text-sm font-semibold text-primary">{dive.kicker}</p>
                  <h3 id={`dive-${key}`} className="mt-3 text-2xl font-bold text-ink sm:text-3xl">
                    {dive.heading}
                  </h3>
                  <p className="mt-4 text-lg leading-relaxed text-pretty text-ink-soft">{dive.body}</p>
                  <ul className="mt-6 space-y-3">
                    {dive.points.map((point) => (
                      <li key={point} className="flex gap-3 text-ink-soft">
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                          <CheckIcon width="0.9rem" height="0.9rem" />
                        </span>
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={flip ? "lg:order-1" : undefined}>{visual}</div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="relative isolate overflow-hidden rounded-3xl border border-line bg-linear-to-br from-primary-soft to-paper-raised p-4 sm:p-8 rtl:bg-linear-to-bl"
    >
      <span
        aria-hidden
        className="absolute -end-16 -bottom-10 -z-10 h-16 w-72 -rotate-[24deg] rounded-full bg-linear-to-r from-zimos-sky/0 to-zimos-sky/25"
      />
      {children}
    </div>
  );
}

const cardClass = "rounded-2xl border border-line bg-paper-raised p-4 shadow-card";

/* ------------------------------------------------------------------ */

type QueueStatus = "calling" | "confirmed" | "waiting";

function ConfirmVisual({ copy }: { copy: ConfirmCopy }) {
  const rows: { n: number; city: string; status: QueueStatus }[] = [
    { n: 1031, city: copy.cities[0], status: "calling" },
    { n: 1032, city: copy.cities[1], status: "confirmed" },
    { n: 1033, city: copy.cities[2], status: "waiting" },
  ];
  const pill: Record<QueueStatus, { className: string; label: string }> = {
    calling: { className: "bg-primary-soft text-primary-dark", label: copy.statusCalling },
    confirmed: {
      className: "bg-success-soft text-emerald-800 dark:text-success",
      label: copy.statusConfirmed,
    },
    waiting: { className: "bg-warning-soft text-warning", label: copy.statusWaiting },
  };

  return (
    <Frame label={copy.aria}>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:items-start">
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{copy.queueTitle}</p>
            <PhoneIcon width="1rem" height="1rem" className="text-primary" />
          </div>
          <ul className="mt-2 divide-y divide-line">
            {rows.map((row) => (
              <li key={row.n} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {copy.order} #{row.n}
                  </p>
                  <p className="text-xs text-ink-soft">{row.city}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill[row.status].className}`}
                >
                  {pill[row.status].label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className={`${cardClass} sm:mt-10`}>
          <div className="flex items-center gap-2 border-b border-line pb-2.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-zimos-blue text-white">
              <ChatIcon width="0.9rem" height="0.9rem" />
            </span>
            <p className="text-sm font-semibold text-ink">{copy.chatTitle}</p>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <p className="me-6 rounded-2xl rounded-ss-sm bg-primary-soft px-3 py-2 leading-relaxed text-ink">
              {copy.storeMessage}
            </p>
            <p className="ms-auto w-fit rounded-2xl rounded-se-sm bg-zimos-blue px-4 py-2 font-semibold text-white">
              {copy.customerReply}
            </p>
            <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs font-medium text-ink-soft">
              <CheckIcon width="0.85rem" height="0.85rem" className="shrink-0 text-primary" />
              {copy.systemMessage}
            </p>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */

type BarTone = "total" | "cost" | "net";

// Relative, illustrative proportions only — not data.
const WATERFALL: { start: number; size: number; tone: BarTone }[] = [
  { start: 0, size: 100, tone: "total" },
  { start: 70, size: 30, tone: "cost" },
  { start: 56, size: 14, tone: "cost" },
  { start: 32, size: 24, tone: "cost" },
  { start: 24, size: 8, tone: "cost" },
  { start: 0, size: 24, tone: "net" },
];

const TONE: Record<BarTone, string> = {
  total: "bg-zimos-navy dark:bg-zimos-ice",
  cost: "bg-zimos-sky/70",
  net: "bg-zimos-blue",
};

function ProfitVisual({ copy }: { copy: ProfitCopy }) {
  return (
    <Frame label={copy.aria}>
      <div className={`${cardClass} sm:p-5`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">{copy.title}</p>
          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-ink-soft">
            {copy.illustrative}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-6 gap-1.5 sm:gap-3">
          {WATERFALL.map((bar, i) => (
            <div key={copy.bars[i]} className="flex min-w-0 flex-col items-center gap-2">
              <div className="relative h-40 w-full border-b border-line-strong sm:h-48">
                <span
                  className={`absolute inset-x-0.5 rounded-md sm:inset-x-1 ${TONE[bar.tone]}`}
                  style={{ insetBlockEnd: `${bar.start}%`, blockSize: `${bar.size}%` }}
                />
              </div>
              <p className="w-full text-center text-[10px] leading-tight text-ink-soft sm:text-xs">
                {copy.bars[i]}
              </p>
            </div>
          ))}
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4">
          {copy.metrics.map((metric) => (
            <div key={metric} className="rounded-xl bg-paper p-2.5">
              <dt className="text-[11px] leading-tight text-ink-soft">{metric}</dt>
              <dd className="mt-1 text-lg font-semibold text-ink">—</dd>
            </div>
          ))}
        </dl>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */

function FlowNode({
  children,
  tone = "default",
  className = "",
}: {
  children: ReactNode;
  tone?: "default" | "primary" | "soft";
  className?: string;
}) {
  const toneClass =
    tone === "primary"
      ? "border-zimos-blue bg-zimos-blue text-white"
      : tone === "soft"
        ? "border-zimos-blue/30 bg-primary-soft text-ink"
        : "border-line bg-paper-raised text-ink";
  return (
    <div
      className={`mx-auto flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-center text-sm font-medium shadow-card ${toneClass} ${className}`}
    >
      {children}
    </div>
  );
}

const vLine = "mx-auto block w-0.5 bg-line-strong";

function FunnelVisual({ copy }: { copy: FunnelCopy }) {
  return (
    <Frame label={copy.aria}>
      <div className={`${cardClass} sm:p-6`}>
        <p className="text-sm font-semibold text-ink">{copy.title}</p>

        <div className="mx-auto mt-5 flex max-w-[20rem] flex-col">
          <FlowNode className="max-w-[13rem]">{copy.landing}</FlowNode>
          <span className={`${vLine} h-5`} />

          <div className="relative mx-auto w-full max-w-[13rem]">
            <FlowNode>{copy.checkout}</FlowNode>
            <span className="absolute -top-2.5 -end-3 rounded-full border border-zimos-sky/60 bg-paper-raised px-2 py-0.5 text-[10px] font-semibold text-primary">
              + {copy.bump}
            </span>
          </div>
          <span className={`${vLine} h-5`} />

          <FlowNode tone="primary" className="max-w-[13rem]">
            {copy.upsell}
          </FlowNode>
          <span className={`${vLine} h-4`} />

          {/* Branch: accept → thank you, decline → downsell → thank you */}
          <div className="relative grid grid-cols-2">
            <span className="absolute start-1/4 end-1/4 top-0 h-0.5 bg-line-strong" />
            <div className="flex flex-col items-center">
              <span className={`${vLine} h-4`} />
              <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-semibold text-primary-dark">
                {copy.accept}
              </span>
              <span className={`${vLine} min-h-4 flex-1`} />
            </div>
            <div className="flex flex-col items-center">
              <span className={`${vLine} h-4`} />
              <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft">
                {copy.decline}
              </span>
              <span className={`${vLine} h-3`} />
              <FlowNode className="w-[90%]">{copy.downsell}</FlowNode>
              <span className={`${vLine} h-4`} />
            </div>
          </div>

          <div className="relative">
            <span className="absolute start-1/4 end-1/4 top-0 h-0.5 bg-line-strong" />
            <span className={`${vLine} h-5`} />
          </div>

          <FlowNode tone="soft" className="max-w-[13rem]">
            <CheckIcon width="1rem" height="1rem" className="shrink-0 text-primary" />
            {copy.thankYou}
          </FlowNode>
        </div>
      </div>
    </Frame>
  );
}
