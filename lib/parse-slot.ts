// Parse an original filename into a canonical { slotName, subjectKey, viewLabel }.
//
// Examples:
//   LOOK_03_A.jpg              → slot=LOOK_03_A,   subject=LOOK_03,   view=A
//   LOOK_03_FRONT.jpg          → slot=LOOK_03_FRONT, subject=LOOK_03, view=FRONT
//   SKU-1234-front.png         → slot=SKU-1234-front, subject=SKU-1234, view=front
//   PROD123_01.webp            → slot=PROD123_01, subject=PROD123, view=01
//   IMG_4523.jpg               → slot=IMG_4523, subject=null, view=null  (numeric-only trailing token is ambiguous; treated as part of the slot)
//   HERO.jpg                   → slot=HERO, subject=null, view=null
//
// Heuristic: strip extension; if the last `_`- or `-`-separated token is a known
// view tag, split it off. Otherwise the whole stem is the slot with no grouping.

const SINGLE_LETTER = /^[A-F]$/i; // A..F covers most lookbook conventions
const NAMED_VIEW = new Set([
  "front",
  "back",
  "side",
  "left",
  "right",
  "top",
  "bottom",
  "detail",
  "hero",
  "alt",
  "closeup",
  "macro",
  "lifestyle",
  "flat",
  "ghost",
  "model",
  "ondemodel",
  "onmodel",
  "offmodel",
]);
const NUMERIC_VIEW = /^0[1-9]$|^[1-9]\d?$/; // 01..09 or 1..99 — but only when paired with a non-numeric subject (handled below)

function stripExt(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

export function parseSlot(filename: string): {
  slotName: string;
  subjectKey: string | null;
  viewLabel: string | null;
} {
  const stem = stripExt(filename);
  const slotName = stem;

  // Split on _ or - keeping separators so we can rebuild safely
  const parts = stem.split(/[_-]/);
  if (parts.length < 2) {
    return { slotName, subjectKey: null, viewLabel: null };
  }

  const last = parts[parts.length - 1];
  const head = parts.slice(0, -1);
  const headStr = stem.slice(0, stem.length - last.length - 1); // includes original separator stripped

  const isLetter = SINGLE_LETTER.test(last);
  const isNamed = NAMED_VIEW.has(last.toLowerCase());
  const isNumeric = NUMERIC_VIEW.test(last);

  // Reject "all-numeric" subjects (e.g. IMG_4523) — without a meaningful subject
  // prefix, the numeric tail is just part of the name, not a view.
  const subjectIsNumericOnly = head.every((p) => /^\d+$/.test(p));

  if (isLetter || isNamed || (isNumeric && !subjectIsNumericOnly && head.length >= 1)) {
    return {
      slotName,
      subjectKey: headStr,
      viewLabel: last.toUpperCase(),
    };
  }

  return { slotName, subjectKey: null, viewLabel: null };
}
