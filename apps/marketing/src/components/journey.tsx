import type { CSSProperties } from "react";
import type { Dictionary, JourneyStep } from "@/i18n/dictionary";
import { ColorIcon, type ColorIconName } from "./color-icon";

const STEP_ICON: Record<JourneyStep["id"], ColorIconName> = {
  template: "apps",
  customize: "edit",
  publish: "send",
  confirm: "verified",
  ship: "delivery",
};

/**
 * Five steps, each with who does it; the ones ZIMOS runs get the solid tile.
 * Under them a progress line with a pin per step: a store marker travels from
 * one to the next and the line fills behind it (it stands still at the end
 * without motion). On phones the steps become a vertical timeline.
 */
export function Journey({ copy }: { copy: Dictionary["journey"] }) {
  return (
    <section className="lz-sec lz-sec--tint" id="how" aria-labelledby="lz-how">
      <div className="lz-in">
        <header className="lz-head lz-head--center lz-r">
          <span className="lz-eye">{copy.kicker}</span>
          <h2 className="lz-h" id="lz-how">
            {copy.heading}
          </h2>
          <p className="lz-lede">{copy.intro}</p>
        </header>

        <div className="lz-journey lz-r">
          <ol className="lz-steps">
            {copy.steps.map((step, i) => {
              return (
                <li key={step.id}>
                  <span className={step.by === "zimos" ? "lz-step__n lz-step__n--run" : "lz-step__n"}>
                    <ColorIcon name={STEP_ICON[step.id]} size={28} />
                    <em className="ltr" aria-hidden>
                      {i + 1}
                    </em>
                  </span>
                  <span className={`lz-step__by lz-step__by--${step.by}`}>{copy.by[step.by]}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              );
            })}
          </ol>

          <div className="lz-track" aria-hidden>
            <span className="lz-track__line">
              <i />
            </span>
            {copy.steps.map((step, i) => (
              <span key={step.id} className="lz-track__pin" style={{ "--p": i + 1 } as CSSProperties} />
            ))}
            <span className="lz-track__marker">
              <ColorIcon name="store" size={24} />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
