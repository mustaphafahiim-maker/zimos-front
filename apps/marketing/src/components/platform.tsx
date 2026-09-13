import type { Capability, Dictionary } from "@/i18n/dictionary";
import {
  ChartIcon,
  FunnelIcon,
  PhoneIcon,
  ShieldIcon,
  StorefrontIcon,
  TruckIcon,
  UsersIcon,
  WorkflowIcon,
  type IconComponent,
} from "./icons";
import { SectionHeading } from "./section-heading";
import { container } from "./ui";

const ICONS: Record<Capability["id"], IconComponent> = {
  store: StorefrontIcon,
  funnels: FunnelIcon,
  confirmation: PhoneIcon,
  shipping: TruckIcon,
  analytics: ChartIcon,
  fraud: ShieldIcon,
  automations: WorkflowIcon,
  teams: UsersIcon,
};

export function Platform({ copy }: { copy: Dictionary["platform"] }) {
  return (
    <section id="product" aria-labelledby="product-heading" className="bg-paper-raised py-20 sm:py-28">
      <div className={container}>
        <SectionHeading
          id="product-heading"
          kicker={copy.kicker}
          heading={copy.heading}
          intro={copy.intro}
        />

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {copy.items.map((item) => {
            const Icon = ICONS[item.id];
            return (
              <li
                key={item.id}
                className="group relative overflow-hidden rounded-2xl border border-line bg-paper p-6 transition-[border-color,box-shadow,translate] duration-200 hover:border-line-strong hover:shadow-card motion-safe:hover:-translate-y-0.5"
              >
                <span
                  aria-hidden
                  className="absolute -end-8 -top-6 h-5 w-28 -rotate-[24deg] rounded-full bg-linear-to-r from-zimos-blue/0 to-zimos-sky/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                />
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon width="1.35rem" height="1.35rem" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
