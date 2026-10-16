import files from "@/lib/xsLookCss.json";

/**
 * The stylesheets of the imported templates ("xs" looks) a page draws: one
 * small file per look — its colours, type, faces and how it draws the shared
 * bands, header and footer — built by scripts/xs-look-css.mjs and named in
 * src/lib/xsLookCss.json. The shared base is in every page (app/xs.css); these
 * are not, so a store that wears one look loads that look and nothing of the
 * other twenty-one, and a store that wears none loads none.
 *
 * The store layout links the look the store wears (and the phone header); the
 * page renderer links every look its bands use, so a band of another look —
 * in the editor's preview, or on a page mixing two — is still drawn in its
 * own. React puts each in the document's head once, however many times it is
 * asked for, in the order of the `precedence` groups: the looks after the
 * app's own stylesheets, and the phone header after the looks, whose
 * narrow-screen answers it is.
 */

const FILES = files as { looks: Record<string, string>; phone: string };

export function XsLookStyles({ looks }: { looks: readonly string[] }) {
  return (
    <>
      {looks.map((look) =>
        Object.hasOwn(FILES.looks, look) ? <link key={look} rel="stylesheet" href={FILES.looks[look]} precedence="xs-look" /> : null
      )}
    </>
  );
}

/** The header's phone menu of every look (app/xs-phone.css); only a store that wears a look's header needs it. */
export function XsPhoneStyles() {
  return <link rel="stylesheet" href={FILES.phone} precedence="xs-phone" />;
}
