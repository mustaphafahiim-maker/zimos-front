import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { ColorIcon, type ColorIconName } from "./color-icon";

/** A clear subscription, start free, your data, the payment — in that order. */
const POINT_ICON: ColorIconName[] = ["receipt", "gift", "lock", "vault"];

/**
 * "What should reassure you": what ZIMOS sells and what it doesn't, what a
 * plan costs and how it is paid, and whose data it is. The payment point
 * ends with the refund policy link.
 */
export function Trust({ copy, locale }: { copy: Dictionary["trust"]; locale: Locale }) {
  const last = copy.points.length - 1;

  return (
    <section className="lz-sec lz-sec--tint" id="trust" aria-labelledby="lz-trust">
      <div className="lz-in">
        <header className="lz-head lz-head--center lz-r">
          <span className="lz-eye">{copy.kicker}</span>
          <h2 className="lz-h" id="lz-trust">
            {copy.heading}
          </h2>
          <p className="lz-lede">{copy.intro}</p>
        </header>

        <div className="lz-trust lz-r">
          {copy.points.map((point, i) => {
            return (
              <article key={point.title}>
                <span className="lz-ico">
                  <ColorIcon name={POINT_ICON[i]} size={28} />
                </span>
                <h3>{point.title}</h3>
                <p>
                  {point.body}
                  {i === last ? (
                    <>
                      {" "}
                      <Link href={`/${locale}/refund-policy`}>{copy.refundLink}</Link>.
                    </>
                  ) : null}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
