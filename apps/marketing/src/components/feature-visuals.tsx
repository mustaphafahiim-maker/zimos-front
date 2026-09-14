import type { ReactNode } from "react";
import type { FeatureArea, FeatureAreaId } from "@/i18n/pages/features-page";
import {
  ChatIcon,
  CheckIcon,
  LayersIcon,
  PhoneIcon,
  ShieldIcon,
  StorefrontIcon,
  TruckIcon,
  UsersIcon,
  WorkflowIcon,
} from "./icons";

/**
 * CSS/HTML illustrations for the features page. Generic UI labels and shapes
 * only — no figures, names, or data. Labels come from the dictionary in order.
 */
export function FeatureVisual({ area }: { area: FeatureArea }) {
  const Visual = VISUALS[area.id];
  return (
    <div
      role="img"
      aria-label={area.visual.aria}
      className="relative isolate overflow-hidden rounded-3xl border border-line bg-linear-to-br from-primary-soft to-paper-raised p-4 sm:p-8 rtl:bg-linear-to-bl"
    >
      <span
        aria-hidden
        className="absolute -end-16 -bottom-10 -z-10 h-16 w-72 -rotate-[24deg] rounded-full bg-linear-to-r from-zimos-sky/0 to-zimos-sky/25"
      />
      <Visual l={area.visual.labels} />
    </div>
  );
}

const card = "rounded-2xl border border-line bg-paper-raised p-4 shadow-card";
const bar = "block h-2 rounded-full bg-line";
const pill = "rounded-full px-2 py-0.5 text-[11px] font-semibold";

type V = (props: { l: string[] }) => ReactNode;

const StoreBuilder: V = ({ l }) => (
  <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
    <div className={card}>
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <LayersIcon width="1rem" height="1rem" className="text-primary" />
        {l[0]}
      </p>
      <ul className="mt-3 space-y-2 text-xs text-ink-soft">
        {l.slice(1, 4).map((s, i) => (
          <li key={s} className={`rounded-lg border px-2.5 py-2 ${i === 1 ? "border-zimos-blue bg-primary-soft text-ink" : "border-line"}`}>
            {s}
          </li>
        ))}
      </ul>
    </div>
    <div className={card}>
      <div className="flex items-center justify-between">
        <StorefrontIcon width="1.1rem" height="1.1rem" className="text-primary" />
        <span className="rounded-md bg-zimos-blue px-2.5 py-1 text-[11px] font-semibold text-white">{l[4]}</span>
      </div>
      <div className="mt-3 h-16 rounded-xl bg-linear-to-r from-zimos-blue/15 to-zimos-sky/25" />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1.5 rounded-lg border border-line p-2">
            <div className="aspect-square rounded-md bg-primary-soft" />
            <span className={`${bar} w-3/4`} />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const Funnels: V = ({ l }) => (
  <div className={`${card} space-y-2`}>
    {[l[0], l[1], l[2], l[3]].map((step, i) => (
      <div key={step} className="flex items-center gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
          {i + 1}
        </span>
        <div
          className={`flex flex-1 items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium ${
            i === 2 ? "border-zimos-blue bg-zimos-blue text-white" : "border-line text-ink"
          }`}
          style={{ marginInlineEnd: `${i * 8}%` }}
        >
          {step}
          {i === 1 ? <span className={`${pill} border border-zimos-sky/60 text-primary`}>+ {l[4]}</span> : null}
        </div>
      </div>
    ))}
  </div>
);

const Confirmation: V = ({ l }) => (
  <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
    <div className={card}>
      <p className="flex items-center justify-between text-sm font-semibold text-ink">
        {l[0]}
        <PhoneIcon width="1rem" height="1rem" className="text-primary" />
      </p>
      <ul className="mt-2 divide-y divide-line">
        {[l[1], l[2], l[1]].map((status, i) => (
          <li key={i} className="flex items-center justify-between py-2.5">
            <span className="text-sm text-ink">
              {l[4]} <span aria-hidden className={`${bar} mt-1 w-12`} />
            </span>
            <span className={`${pill} ${i === 1 ? "bg-success-soft text-emerald-800 dark:text-success" : "bg-primary-soft text-primary-dark"}`}>
              {status}
            </span>
          </li>
        ))}
      </ul>
    </div>
    <div className={`${card} sm:mt-8`}>
      <p className="flex items-center gap-2 border-b border-line pb-2 text-sm font-semibold text-ink">
        <span className="flex size-6 items-center justify-center rounded-full bg-zimos-blue text-white">
          <ChatIcon width="0.8rem" height="0.8rem" />
        </span>
        WhatsApp
      </p>
      <p className="mt-3 me-4 rounded-2xl rounded-ss-sm bg-primary-soft px-3 py-2 text-sm text-ink">{l[3]}</p>
      <p className="mt-2 ms-auto w-fit rounded-2xl rounded-se-sm bg-zimos-blue px-4 py-1.5 text-sm font-semibold text-white">1</p>
    </div>
  </div>
);

const Fraud: V = ({ l }) => (
  <div className={card}>
    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
      <ShieldIcon width="1rem" height="1rem" className="text-primary" />
      {l[0]}
    </p>
    <ul className="mt-3 space-y-2">
      {[
        { label: l[1], warn: true },
        { label: l[3], warn: false },
        { label: l[2], warn: true },
        { label: l[3], warn: false },
      ].map((row, i) => (
        <li
          key={i}
          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${row.warn ? "border-warning/40 bg-warning-soft" : "border-line"}`}
        >
          <span className={`${bar} w-1/3`} />
          <span className={`${pill} ${row.warn ? "text-warning" : "bg-primary-soft text-primary-dark"}`}>{row.label}</span>
        </li>
      ))}
    </ul>
  </div>
);

const Shipping: V = ({ l }) => (
  <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
    <div className={card}>
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <TruckIcon width="1rem" height="1rem" className="text-primary" />
        {l[0]}
      </p>
      <ol className="mt-4 space-y-4 border-s-2 border-line ps-4">
        {[l[1], l[2], l[3]].map((s, i) => (
          <li key={s} className="relative text-sm text-ink">
            <span
              aria-hidden
              className={`absolute -start-[1.4rem] top-1 size-3 rounded-full ${i < 2 ? "bg-zimos-blue" : "border-2 border-line-strong bg-paper-raised"}`}
            />
            {s}
          </li>
        ))}
      </ol>
    </div>
    <div className={card}>
      <p className="text-sm font-semibold text-ink">{l[4]}</p>
      <ul className="mt-3 space-y-2">
        {[l[5], l[5], l[6]].map((s, i) => (
          <li key={i} className="flex items-center justify-between rounded-lg bg-paper px-2.5 py-2">
            <span className={`${bar} w-10`} />
            <span className={`${pill} ${i < 2 ? "bg-primary-soft text-primary-dark" : "border border-line text-ink-soft"}`}>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const Analytics: V = ({ l }) => (
  <div className={card}>
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold text-ink">{l[0]}</p>
      <span className={`${pill} border border-line font-medium text-ink-soft`}>{l[4]}</span>
    </div>
    <dl className="mt-4 grid grid-cols-3 gap-2">
      {[l[1], l[2], l[3]].map((m) => (
        <div key={m} className="rounded-xl bg-paper p-2.5">
          <dt className="text-[11px] leading-tight text-ink-soft">{m}</dt>
          <dd className="mt-1 text-lg font-semibold text-ink">—</dd>
        </div>
      ))}
    </dl>
    <ul className="mt-4 space-y-2.5 border-t border-line pt-4">
      {[80, 55, 35].map((w) => (
        <li key={w} className="flex items-center gap-3">
          <span className={`${bar} w-16 shrink-0`} />
          <span className="h-2.5 rounded-full bg-linear-to-r from-zimos-blue to-zimos-sky rtl:bg-linear-to-l" style={{ width: `${w}%` }} />
        </li>
      ))}
    </ul>
  </div>
);

const Automations: V = ({ l }) => (
  <div className={`${card} space-y-2`}>
    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
      <WorkflowIcon width="1rem" height="1rem" className="text-primary" />
    </p>
    <div className="rounded-xl border border-line p-3">
      <p className="text-xs font-semibold text-primary">{l[0]}</p>
      <p className="mt-1 text-sm font-medium text-ink">{l[1]}</p>
    </div>
    <span aria-hidden className="mx-auto block h-4 w-0.5 bg-line-strong" />
    <div className="rounded-xl border border-zimos-blue/40 bg-primary-soft p-3">
      <p className="text-xs font-semibold text-primary">{l[2]}</p>
      <p className="mt-1 flex items-center gap-2 text-sm font-medium text-ink">
        <ChatIcon width="0.9rem" height="0.9rem" className="text-primary" /> {l[3]}
      </p>
      <p className="mt-1.5 flex items-center gap-2 text-sm font-medium text-ink">
        <UsersIcon width="0.9rem" height="0.9rem" className="text-primary" /> {l[4]}
      </p>
    </div>
  </div>
);

const Teams: V = ({ l }) => (
  <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
    <div className={card}>
      <p className="text-sm font-semibold text-ink">{l[0]}</p>
      <ul className="mt-3 space-y-2">
        {[0, 1, 2].map((i) => (
          <li key={i} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${i === 0 ? "border-zimos-blue bg-primary-soft" : "border-line"}`}>
            <StorefrontIcon width="0.95rem" height="0.95rem" className="text-primary" />
            <span className={`${bar} w-20`} />
          </li>
        ))}
      </ul>
    </div>
    <div className={card}>
      <p className="text-sm font-semibold text-ink">{l[1]}</p>
      <ul className="mt-3 space-y-2">
        {[l[2], l[3], l[4]].map((role) => (
          <li key={role} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="size-6 rounded-full bg-primary-soft" />
              <span className={`${bar} w-10`} />
            </span>
            <span className={`${pill} bg-primary-soft text-primary-dark`}>{role}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const LandingGenerator: V = ({ l }) => (
  <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
    <div className={card}>
      <p className="text-xs font-semibold text-ink">{l[0]}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-1">
        {[0, 1].map((i) => (
          <div key={i} className={`h-14 rounded-lg border p-1.5 ${i === 0 ? "border-zimos-blue ring-2 ring-zimos-sky/40" : "border-line"}`}>
            <span className="block h-3 rounded bg-primary-soft" />
            <span className={`${bar} mt-1.5 w-2/3`} />
          </div>
        ))}
      </div>
    </div>
    <div className={card}>
      <div className="flex items-center justify-between">
        <span className={`${pill} border border-line font-medium text-ink-soft`}>{l[1]}</span>
        <CheckIcon width="1rem" height="1rem" className="text-primary" />
      </div>
      <ul className="mt-3 space-y-2">
        {[l[2], l[3], l[4]].map((section) => (
          <li key={section} className="flex items-center justify-between rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-sm text-ink">
            {section}
            <span className="text-xs font-semibold text-primary">{l[5]}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const VISUALS: Record<FeatureAreaId, V> = {
  "store-builder": StoreBuilder,
  funnels: Funnels,
  confirmation: Confirmation,
  fraud: Fraud,
  shipping: Shipping,
  analytics: Analytics,
  automations: Automations,
  teams: Teams,
  "landing-generator": LandingGenerator,
};
