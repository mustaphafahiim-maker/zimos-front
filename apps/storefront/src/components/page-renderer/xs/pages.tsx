import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n";
import { VideoElement } from "../elements";
import { type Props, items, safeUrl, str } from "../showcase/shared";
import { xsBackground, xsFocal } from "@/lib/xsPicture";
import { xsBox } from "@/lib/xsImages";
import { XsBackgroundPreload, XsPicture, pictureSize } from "@/components/xs/XsPicture";
import { XsContactForm } from "../lazy";
import { listed } from "./listed";

/**
 * The bands an imported template's inner pages are made of (About, Contact):
 *
 *   xs_title · xs_story · xs_contact · xs_team · xs_video
 *
 * Plain server components — only the contact form's sending is a client part
 * (XsContactForm). Styles: app/xs-sections.css.
 */

export interface XsPageProps {
  props: Props;
  look: string;
  workspaceId: string;
  locale: Locale;
  editable: boolean;
  elementId: string;
  /** In the page's opening section: its pictures are fetched first. */
  eager: boolean;
}

/** `xs_title` — the page's name over a wide picture. */
export function XsTitleElement({ props, look, eager }: XsPageProps): ReactNode {
  const heading = str(props, "heading");
  const image = safeUrl(str(props, "image"));
  if (!heading && !image) return null;
  return (
    <div className="xs-title" data-xs-look={look} style={image ? xsBackground(image, xsFocal(props.imagePosition)) : undefined} data-xs-bg={image ? "image" : undefined} data-xs-bg-src={image ?? undefined}>
      {image && eager ? <XsBackgroundPreload src={image} /> : null}
      {heading ? <h2 className="xs-title__heading">{heading}</h2> : null}
    </div>
  );
}

/** `xs_story` — text beside a framed picture, the sides swapping from one part to the next. */
export function XsStoryElement({ props, look }: XsPageProps): ReactNode {
  const parts = listed(props, "items", 6).filter(({ item: part }) => str(part, "title") || str(part, "body") || str(part, "image"));
  if (parts.length === 0) return null;
  return (
    <div className="xs-story" data-xs-look={look}>
      {parts.map(({ item: part, at }, index) => {
        const image = safeUrl(str(part, "image"));
        const quote = str(part, "quote");
        const paragraphs = str(part, "body")
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean);
        return (
          <div key={at} className="xs-story__part" data-flip={index % 2 === 1 ? "" : undefined} data-xs-item={`items.${at}`}>
            <div className="xs-story__text">
              {str(part, "title") ? <h3 className="xs-story__title">{str(part, "title")}</h3> : null}
              {paragraphs.map((paragraph, i) => (
                <p key={i} className="xs-story__body">
                  {paragraph}
                </p>
              ))}
              {quote ? (
                <blockquote className="xs-story__quote">
                  <p>{quote}</p>
                  {str(part, "quoteAuthor") ? <cite>- {str(part, "quoteAuthor")}</cite> : null}
                </blockquote>
              ) : null}
            </div>
            {image ? (
              <div className="xs-story__frame">
                <div className="xs-story__zoom">
                  <XsPicture src={image} alt={str(part, "title")} box={xsBox(image)} pic={`items.${at}.image`} size={pictureSize(part, "image")} />
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const ICONS: Record<string, ReactNode> = {
  address: (
    <>
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  phone: <path d="M5 4h3l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
};

const contactCopy = (locale: Locale) =>
  locale === "ar"
    ? { sending: "جارٍ الإرسال…", sent: "وصلتنا رسالتك، وسنرد عليك قريبًا.", error: "تعذّر الإرسال. حاول مرة أخرى.", needContact: "اكتب بريدك الإلكتروني أو رقم هاتفك.", invalidPhone: "رقم الهاتف غير صحيح." }
    : { sending: "Sending…", sent: "Your message reached us. We will get back to you soon.", error: "Could not send. Please try again.", needContact: "Enter your email address or phone number.", invalidPhone: "That phone number is not valid." };

/** `xs_contact` — a message form beside the store's address, phone and email. */
export function XsContactElement({ props, look, workspaceId, locale, editable, elementId }: XsPageProps): ReactNode {
  const info = items(props, "info", 4).filter((row) => str(row, "title") || str(row, "text"));
  return (
    <div className="xs-contact" data-xs-look={look}>
      <div className="xs-contact__grid">
        <div className="xs-contact__box">
          <XsContactForm
            workspaceId={workspaceId}
            elementId={elementId}
            heading={str(props, "heading")}
            contactPlaceholder={str(props, "contactPlaceholder") || (locale === "ar" ? "بريدك الإلكتروني أو هاتفك" : "Your Email Address")}
            messagePlaceholder={str(props, "messagePlaceholder") || (locale === "ar" ? "كيف نساعدك؟" : "How Can We Help?")}
            buttonLabel={str(props, "buttonLabel") || (locale === "ar" ? "إرسال" : "Submit")}
            disabled={editable}
            copy={{ ...contactCopy(locale), ...(str(props, "successMessage") ? { sent: str(props, "successMessage") } : {}) }}
          />
        </div>
        {info.length > 0 ? (
          <div className="xs-contact__box xs-contact__info">
            {info.map((row, index) => {
              const icon = str(row, "icon");
              return (
                <div key={index} className="xs-contact__row">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {ICONS[icon] ?? ICONS.address}
                  </svg>
                  <div>
                    <span className="xs-contact__label">{str(row, "title")}</span>
                    <p className="xs-contact__value" data-accent={icon === "address" ? undefined : ""}>
                      {str(row, "text")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** `xs_team` — the people behind the store in a row: a picture, a name, a role and a line each. */
export function XsTeamElement({ props, look }: XsPageProps): ReactNode {
  const people = listed(props, "items", 8).filter(({ item: person }) => str(person, "name") || str(person, "image"));
  if (people.length === 0) return null;
  const heading = str(props, "heading");
  return (
    <div className="xs-team" data-xs-look={look}>
      {heading || str(props, "text") ? (
        <div className="xs-team__intro">
          {heading ? <h2 className="xs-heading">{heading}</h2> : null}
          {str(props, "text") ? <p>{str(props, "text")}</p> : null}
        </div>
      ) : null}
      <div className="xs-team__grid">
        {people.map(({ item: person, at }) => {
          const image = safeUrl(str(person, "image"));
          return (
            <div key={at} className="xs-team__person" data-xs-item={`items.${at}`}>
              {image ? <XsPicture src={image} alt={str(person, "name")} box={xsBox(image)} pic={`items.${at}.image`} size={pictureSize(person, "image")} /> : null}
              {str(person, "name") ? <h3>{str(person, "name")}</h3> : null}
              {str(person, "role") ? <span className="xs-team__role">{str(person, "role")}</span> : null}
              {str(person, "text") ? <p>{str(person, "text")}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** `xs_video` — a film under an optional heading and line, played by the page builder's own video element. */
export function XsVideoElement({ props, look, locale, editable }: XsPageProps): ReactNode {
  if (!safeUrl(str(props, "url"))) {
    // Nothing to play yet: a note in the editor's preview so the block can be found and filled in; nothing on the live store.
    return editable ? (
      <div className="xs-video" data-xs-look={look}>
        <p className="xs-video__empty">{locale === "ar" ? "أضف رابط الفيديو ليظهر هنا." : "Add the video's address and it will play here."}</p>
      </div>
    ) : null;
  }
  const heading = str(props, "heading");
  return (
    <div className="xs-video" data-xs-look={look}>
      {heading || str(props, "text") ? (
        <div className="xs-video__intro">
          {heading ? <h2 className="xs-heading">{heading}</h2> : null}
          {str(props, "text") ? <p>{str(props, "text")}</p> : null}
        </div>
      ) : null}
      <div className="xs-video__frame">
        <VideoElement props={{ url: str(props, "url") }} t={getDictionary(locale)} />
      </div>
    </div>
  );
}
