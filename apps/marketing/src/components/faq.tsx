import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { Plus } from "./duo-icons";

/** The questions as native disclosures: each opens on its own, no script. */
export function Faq({ copy, locale }: { copy: Dictionary["faq"]; locale: Locale }) {
  return (
    <section className="lz-sec lz-sec--line" id="faq" aria-labelledby="faq-heading">
      <div className="lz-in lz-faqwrap">
        <header className="lz-head lz-r">
          <span className="lz-eye">{copy.kicker}</span>
          <h2 className="lz-h" id="faq-heading">
            {copy.heading}
          </h2>
          <p className="lz-faq__more">
            <Link className="lz-link" href={`/${locale}/contact`}>
              {copy.contactLink}
            </Link>
          </p>
        </header>

        <div className="lz-faq lz-r">
          {copy.items.map((item) => (
            <details key={item.question}>
              <summary>
                <span>{item.question}</span>
                <i aria-hidden>
                  <Plus size={16} />
                </i>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
