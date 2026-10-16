/**
 * Text colours some templates draw lighter than the 4.5:1 contrast easy reading needs
 * against their own ground (their body text, small grey lines, the footer's words), each
 * with the nearest shade of the same hue that passes. Worked out once from each look's own
 * tokens (app/xs-look-NN.css); a store turns them on with the Template look's "easier to
 * read" switch (lib/xsTokens.ts `readable`).
 */
export const XS_READABLE: Record<string, Record<string, string>> = {
  "10": {
    "--xs-footer-ink": "#6f747e"
  },
  "13": {
    "--xs-ink-soft": "#757575",
    "--xs-muted": "#757575",
    "--xs-footer-ink": "#717171"
  },
  "14": {
    "--xs-muted": "#747474"
  },
  "15": {
    "--xs-muted": "#6b7484"
  },
  "18": {
    "--xs-muted": "#747474"
  },
  "21": {
    "--xs-footer-ink": "#777777"
  },
  "03": {
    "--xs-ink-soft": "#747474",
    "--xs-muted": "#747474",
    "--xs-footer-ink": "#747474"
  },
  "05": {
    "--xs-muted": "#737373"
  },
  "07": {
    "--xs-ink-soft": "#6d7680",
    "--xs-muted": "#6d7680"
  },
  "08": {
    "--xs-ink-soft": "#757575",
    "--xs-muted": "#757575",
    "--xs-footer-ink": "#8a8a8a"
  }
};
