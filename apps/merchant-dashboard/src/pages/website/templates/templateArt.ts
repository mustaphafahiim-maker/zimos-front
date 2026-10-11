/**
 * The stand-in pictures the store templates ship with: flat drawings made
 * here, of plain shapes, in the colours of the theme a template wears. They
 * are ours from the first line — nothing is traced, copied or downloaded — and
 * a merchant replaces each one with a photo of their own.
 *
 * A drawing is an SVG file under the storefront's `public/template-art/`, so a
 * template names it by a path on the store's own host (`/template-art/…`),
 * which the page renderer and the server both accept as a picture's address.
 * The files are written by storeTemplates.test.ts (`npm run templates:build`)
 * and that test fails when one no longer matches what this file draws.
 *
 * Every drawing has a size of its own (so a browser lays it out like a photo)
 * and its subject in the middle, with calm ground around it: whatever box it is
 * cropped into, the subject stays in view. A slide's drawing is the exception:
 * its subject stands to one side, or high up on the phone's own drawing, and
 * leaves the rest of the ground calm for the slide's words.
 */

export interface ArtPalette {
  /** The lighter and the deeper end of the ground. */
  ground: string;
  groundDeep: string;
  /** A soft shape lying on the ground. */
  soft: string;
  /** The subject's main colour and its second one. */
  accent: string;
  second: string;
  /** Lines and small dark parts. */
  ink: string;
}

/** The light palette of each theme a template wears (the storefront's store-themes.css). */
export const ART_PALETTES = {
  classic: { ground: "#F7F4EE", groundDeep: "#E6DDCC", soft: "#FFFFFF", accent: "#1F3A5F", second: "#B7793D", ink: "#1B2433" },
  warm: { ground: "#FBF5EC", groundDeep: "#F1DCC0", soft: "#FFFDF9", accent: "#A64A24", second: "#E3A857", ink: "#3B2A20" },
  bold: { ground: "#F4F4F5", groundDeep: "#DEDEE3", soft: "#FFFFFF", accent: "#D7261E", second: "#FFD60A", ink: "#0B0B0C" },
  glass: { ground: "#EEF1FA", groundDeep: "#D3DAF3", soft: "#FFFFFF", accent: "#6242F5", second: "#22B8CF", ink: "#0F172A" },
} satisfies Record<string, ArtPalette>;

export type ArtTheme = keyof typeof ART_PALETTES;

type Draw = (p: ArtPalette) => string;

/** Each subject, drawn inside a box 200 wide and 200 tall. */
const SUBJECTS = {
  cushion: (p) =>
    `<rect x="34" y="66" width="128" height="104" rx="30" fill="${p.accent}"/>` +
    `<rect x="54" y="38" width="116" height="98" rx="28" fill="${p.second}" transform="rotate(-8 112 87)"/>` +
    `<circle cx="112" cy="88" r="5" fill="${p.ink}" opacity=".35"/>`,
  lamp: (p) =>
    `<path d="M70 36h60l24 66H46z" fill="${p.accent}"/>` +
    `<rect x="96" y="102" width="8" height="60" rx="4" fill="${p.ink}" opacity=".6"/>` +
    `<ellipse cx="100" cy="166" rx="36" ry="8" fill="${p.ink}" opacity=".6"/>` +
    `<path d="M62 102h76" stroke="${p.second}" stroke-width="6" stroke-linecap="round"/>`,
  plant: (p) =>
    `<path d="M100 122c-4-42-30-56-46-60 2 32 20 54 46 60z" fill="${p.second}"/>` +
    `<path d="M100 122c4-48 30-66 48-70-2 36-20 62-48 70z" fill="${p.accent}"/>` +
    `<path d="M70 120h60l-9 52H79z" fill="${p.ink}" opacity=".7"/>`,
  blanket: (p) =>
    `<rect x="40" y="52" width="120" height="30" rx="15" fill="${p.accent}"/>` +
    `<rect x="40" y="88" width="120" height="30" rx="15" fill="${p.second}"/>` +
    `<rect x="40" y="124" width="120" height="30" rx="15" fill="${p.ink}" opacity=".6"/>`,
  cup: (p) =>
    `<path d="M80 62c-9-10 9-17 0-30M106 62c-9-10 9-17 0-30" fill="none" stroke="${p.ink}" stroke-opacity=".4" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M138 96h8a17 17 0 0 1 0 34h-12" fill="none" stroke="${p.accent}" stroke-width="10" stroke-linecap="round"/>` +
    `<path d="M50 84h88v32a44 44 0 0 1-88 0z" fill="${p.accent}"/>` +
    `<rect x="36" y="164" width="116" height="10" rx="5" fill="${p.second}"/>`,
  leaf: (p) =>
    `<path d="M98 172c-48-22-60-76-36-124 46 18 64 72 36 124z" fill="${p.accent}"/>` +
    `<path d="M106 172c50-14 68-60 54-106-42 10-66 54-54 106z" fill="${p.second}"/>` +
    `<path d="M98 172c-8-40-16-72-24-106" fill="none" stroke="${p.ink}" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>`,
  glass: (p) =>
    `<path d="M60 48h80l-10 124H70z" fill="${p.soft}" stroke="${p.ink}" stroke-opacity=".25" stroke-width="4"/>` +
    `<path d="M65 92h70l-7 76H72z" fill="${p.second}"/>` +
    `<path d="M122 18l-18 152" fill="none" stroke="${p.accent}" stroke-width="7" stroke-linecap="round"/>` +
    `<circle cx="146" cy="52" r="20" fill="${p.accent}"/>`,
  bottle: (p) =>
    `<rect x="86" y="22" width="28" height="24" rx="6" fill="${p.ink}" opacity=".6"/>` +
    `<path d="M84 46h32c0 24 18 30 18 56v54a16 16 0 0 1-16 16H82a16 16 0 0 1-16-16v-54c0-26 18-32 18-56z" fill="${p.accent}"/>` +
    `<rect x="66" y="106" width="68" height="34" fill="${p.second}"/>`,
  sprig: (p) =>
    `<path d="M100 174V46" fill="none" stroke="${p.ink}" stroke-opacity=".45" stroke-width="6" stroke-linecap="round"/>` +
    `<ellipse cx="76" cy="70" rx="26" ry="12" transform="rotate(28 76 70)" fill="${p.accent}"/>` +
    `<ellipse cx="124" cy="96" rx="26" ry="12" transform="rotate(-28 124 96)" fill="${p.second}"/>` +
    `<ellipse cx="76" cy="122" rx="26" ry="12" transform="rotate(28 76 122)" fill="${p.accent}"/>` +
    `<ellipse cx="124" cy="148" rx="26" ry="12" transform="rotate(-28 124 148)" fill="${p.second}"/>`,
  press: (p) =>
    `<rect x="92" y="26" width="8" height="42" rx="4" fill="${p.ink}" opacity=".6"/>` +
    `<rect x="74" y="22" width="44" height="10" rx="5" fill="${p.ink}" opacity=".6"/>` +
    `<path d="M128 80h12a14 14 0 0 1 14 14v36a14 14 0 0 1-14 14h-12" fill="none" stroke="${p.ink}" stroke-opacity=".6" stroke-width="9"/>` +
    `<rect x="62" y="60" width="68" height="110" rx="10" fill="${p.soft}" stroke="${p.ink}" stroke-opacity=".25" stroke-width="4"/>` +
    `<rect x="66" y="108" width="60" height="58" rx="6" fill="${p.accent}"/>`,
  shirt: (p) =>
    `<path d="M70 42l-42 24 16 30 22-10v88h68V86l22 10 16-30-42-24c-6 12-18 18-30 18s-24-6-30-18z" fill="${p.accent}"/>` +
    `<path d="M70 42c6 12 18 18 30 18s24-6 30-18" fill="none" stroke="${p.second}" stroke-width="6" stroke-linecap="round"/>`,
  dress: (p) =>
    `<path d="M82 34h36l-4 36 36 104H50l36-104z" fill="${p.accent}"/>` +
    `<path d="M82 34c6 12 30 12 36 0" fill="none" stroke="${p.second}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M84 72h32" stroke="${p.second}" stroke-width="6" stroke-linecap="round"/>`,
  shades: (p) =>
    `<path d="M36 96L16 82M164 96l20-14" fill="none" stroke="${p.ink}" stroke-opacity=".6" stroke-width="7" stroke-linecap="round"/>` +
    `<circle cx="64" cy="106" r="32" fill="${p.accent}"/>` +
    `<circle cx="136" cy="106" r="32" fill="${p.accent}"/>` +
    `<path d="M94 100c3-8 9-8 12 0" fill="none" stroke="${p.ink}" stroke-opacity=".6" stroke-width="7" stroke-linecap="round"/>` +
    `<path d="M48 96a22 22 0 0 1 22-14M120 96a22 22 0 0 1 22-14" fill="none" stroke="${p.second}" stroke-width="5" stroke-linecap="round"/>`,
  bag: (p) =>
    `<path d="M76 86V62a24 24 0 0 1 48 0v24" fill="none" stroke="${p.ink}" stroke-opacity=".6" stroke-width="8" stroke-linecap="round"/>` +
    `<path d="M52 74h96l10 98H42z" fill="${p.accent}"/>` +
    `<rect x="64" y="110" width="72" height="12" rx="6" fill="${p.second}"/>`,
  watch: (p) =>
    `<rect x="76" y="12" width="48" height="52" rx="10" fill="${p.ink}" opacity=".7"/>` +
    `<rect x="76" y="136" width="48" height="52" rx="10" fill="${p.ink}" opacity=".7"/>` +
    `<rect x="148" y="92" width="10" height="16" rx="4" fill="${p.ink}" opacity=".7"/>` +
    `<circle cx="100" cy="100" r="52" fill="${p.accent}"/>` +
    `<circle cx="100" cy="100" r="40" fill="${p.soft}"/>` +
    `<path d="M100 76v24l16 12" fill="none" stroke="${p.ink}" stroke-opacity=".75" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  dial: (p) =>
    `<circle cx="100" cy="100" r="80" fill="${p.accent}"/>` +
    `<circle cx="100" cy="100" r="64" fill="${p.soft}"/>` +
    [0, 90, 180, 270].map((turn) => `<rect x="97" y="42" width="6" height="16" rx="3" fill="${p.ink}" opacity=".6" transform="rotate(${turn} 100 100)"/>`).join("") +
    `<path d="M100 60v40l28 18" fill="none" stroke="${p.ink}" stroke-opacity=".75" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="100" cy="100" r="7" fill="${p.second}"/>`,
  pulse: (p) =>
    `<rect x="48" y="26" width="104" height="148" rx="28" fill="${p.accent}"/>` +
    `<rect x="60" y="40" width="80" height="120" rx="18" fill="${p.soft}"/>` +
    `<path d="M70 104h14l8-22 12 44 8-22h18" fill="none" stroke="${p.ink}" stroke-opacity=".75" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<rect x="78" y="56" width="44" height="8" rx="4" fill="${p.second}"/>`,
  strap: (p) =>
    `<rect x="70" y="10" width="60" height="180" rx="16" fill="${p.ink}" opacity=".7"/>` +
    [40, 62, 148, 170].map((y) => `<circle cx="100" cy="${y}" r="5" fill="${p.soft}" opacity=".7"/>`).join("") +
    `<rect x="56" y="74" width="88" height="56" rx="14" fill="${p.accent}"/>` +
    `<rect x="66" y="84" width="68" height="36" rx="8" fill="${p.soft}"/>`,
} satisfies Record<string, Draw>;

export type ArtSubject = keyof typeof SUBJECTS;

/**
 * A maker's mark for the brand strip: one flat shape in a mid grey that reads
 * on a light page and on a dark one, with nothing behind it — the way a real
 * logo usually arrives.
 */
const MARKS: string[] = [
  `<circle cx="100" cy="100" r="62" fill="none" stroke="#7C8594" stroke-width="16"/><circle cx="100" cy="100" r="20" fill="#7C8594"/>`,
  `<circle cx="78" cy="100" r="46" fill="#7C8594"/><circle cx="122" cy="100" r="46" fill="none" stroke="#7C8594" stroke-width="12"/>`,
  `<path d="M100 34l66 114H34z" fill="none" stroke="#7C8594" stroke-width="16" stroke-linejoin="round"/>`,
  `<rect x="40" y="52" width="120" height="20" rx="10" fill="#7C8594"/><rect x="40" y="90" width="84" height="20" rx="10" fill="#7C8594"/><rect x="40" y="128" width="120" height="20" rx="10" fill="#7C8594"/>`,
  `<path fill-rule="evenodd" d="M100 30l70 70-70 70-70-70zM100 78a22 22 0 1 0 0 44a22 22 0 1 0 0-44z" fill="#7C8594"/>`,
  `<path d="M42 132a58 58 0 0 1 116 0" fill="none" stroke="#7C8594" stroke-width="16" stroke-linecap="round"/><circle cx="100" cy="74" r="14" fill="#7C8594"/>`,
];

export interface ArtSpec {
  /** The file's name under `/template-art/`, without its ending. */
  name: string;
  width: number;
  height: number;
  theme: ArtTheme;
  subject: ArtSubject;
  /** Which of the four grounds: where its light falls and where its soft shapes lie. */
  ground?: 0 | 1 | 2 | 3;
  /** The subject's size, as a share of the picture's shorter side. */
  scale?: number;
  /** Lifts the subject (a share of the height), to leave the lower part calm for a slide's text. */
  lift?: number;
  /** Moves the subject sideways (a share of the width; below zero is to the left), to leave the other side calm. */
  shift?: number;
}

const GROUNDS: Array<{ from: [number, number]; to: [number, number]; blobs: Array<[number, number, number]> }> = [
  { from: [0, 0], to: [1, 1], blobs: [[0.82, 0.2, 0.34], [0.14, 0.86, 0.28]] },
  { from: [1, 0], to: [0, 1], blobs: [[0.16, 0.22, 0.32], [0.86, 0.82, 0.3]] },
  { from: [0, 1], to: [1, 0], blobs: [[0.5, 0.08, 0.36], [0.5, 0.96, 0.3]] },
  { from: [0.5, 0], to: [0.5, 1], blobs: [[0.08, 0.5, 0.3], [0.92, 0.5, 0.34]] },
];

const round = (value: number) => Math.round(value * 10) / 10;

/** One stand-in picture as an SVG document. */
export function drawArt(spec: ArtSpec): string {
  const { width: w, height: h } = spec;
  const palette = ART_PALETTES[spec.theme];
  const ground = GROUNDS[spec.ground ?? 0];
  const short = Math.min(w, h);
  const size = short * (spec.scale ?? 0.56);
  const k = round(size / 200);
  const x = round(w / 2 - size / 2 + w * (spec.shift ?? 0));
  const y = round(h / 2 - size / 2 - h * (spec.lift ?? 0));
  const blobs = ground.blobs
    .map(([cx, cy, r], i) => `<circle cx="${round(cx * w)}" cy="${round(cy * h)}" r="${round(r * short)}" fill="${i === 0 ? palette.soft : palette.second}" opacity="${i === 0 ? ".55" : ".16"}"/>`)
    .join("\n  ");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">`,
    `  <defs><linearGradient id="g" x1="${ground.from[0]}" y1="${ground.from[1]}" x2="${ground.to[0]}" y2="${ground.to[1]}"><stop offset="0" stop-color="${palette.ground}"/><stop offset="1" stop-color="${palette.groundDeep}"/></linearGradient></defs>`,
    `  <rect width="${w}" height="${h}" fill="url(#g)"/>`,
    `  ${blobs}`,
    `  <ellipse cx="${round(x + size / 2)}" cy="${round(y + size * 0.97)}" rx="${round(size * 0.42)}" ry="${round(size * 0.05)}" fill="${palette.ink}" opacity=".12"/>`,
    `  <g transform="translate(${x} ${y}) scale(${k})">${SUBJECTS[spec.subject](palette)}</g>`,
    `</svg>`,
    ``,
  ].join("\n");
}

/** One maker's mark (1 to 6) as an SVG document, on nothing. */
export function drawMark(index: number): string {
  const mark = MARKS[(index - 1) % MARKS.length];
  return [`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 200 200">`, `  ${mark}`, `</svg>`, ``].join("\n");
}

/** Where the storefront serves the drawings from. */
export const ART_BASE = "/template-art";

export function artUrl(name: string): string {
  return `${ART_BASE}/${name}.svg`;
}
