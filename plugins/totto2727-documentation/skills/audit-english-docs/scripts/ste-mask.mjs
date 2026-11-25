/** @typedef {import("./ste.mjs").ProseContext} ProseContext */
/** @typedef {(reason: string, start?: number, end?: number) => void} Warn */

const START = 0;
const STEP = 1;
const PREVIOUS = 1;
const NOT_FOUND = -1;
const LINE_BREAK = /[\r\n]/u;
const PROCEDURAL_LABEL = /^\s*(?:WARNING|CAUTION|DANGER):[ \t]*/u;
const DESCRIPTIVE_LABEL = /^\s*(?:NOTE|NOTES):[ \t]*/u;
const NUMBERED_STEP = /^(?:\(\d+\)|[A-Z][.)])\s+/gmu;

// The index is a UTF-16 source offset, including whitespace preserved for line ranges.
/** @type {(characters: string[], span: { end: number, start: number }, first: string) => void} */
const maskSpan = (characters, { end, start }, first) => {
  const cursor = { index: start };
  while (cursor.index < end) {
    const { index } = cursor;
    if (!LINE_BREAK.test(characters[index])) {
      characters[index] = index === start ? first : " ";
    }
    cursor.index += STEP;
  }
};

/** @type {(characters: string[], start: number, end: number) => void} */
export const collapseWord = (characters, start, end) => {
  maskSpan(characters, { end, start }, "x");
};

/** @type {(text: string, index: number) => boolean} */
export const boundary = (text, index) =>
  index < START || index >= text.length || !/[\p{L}\p{N}_]/u.test(text[index]);

/** @type {(text: string, characters: string[], writingMode: ProseContext["writingMode"]) => void} */
const maskLabels = (text, characters, writingMode) => {
  const label = (writingMode === "procedural" ? PROCEDURAL_LABEL : DESCRIPTIVE_LABEL).exec(text);
  if (label) {
    maskSpan(characters, { end: label[0].length, start: START }, " ");
  }
  // Rule 8.6 excludes documented work-step numbering.
  if (writingMode === "procedural") {
    Iterator.from(text.matchAll(NUMBERED_STEP)).forEach((match) => {
      maskSpan(characters, { end: match.index + match[0].length, start: match.index }, " ");
    });
  }
};

/** @type {(text: string, characters: string[], group: string) => void} */
const maskGroup = (text, characters, group) => {
  const cursor = { index: characters.join("").indexOf(group, START) };
  while (cursor.index !== NOT_FOUND) {
    const { index } = cursor;
    const end = index + group.length;
    if (boundary(text, index - PREVIOUS) && boundary(text, end)) {
      collapseWord(characters, index, end);
    }
    cursor.index = characters.join("").indexOf(group, end);
  }
};

/** @type {(text: string, context: ProseContext, warn: Warn) => string[]} */
export const maskProse = (text, { wordGroups, writingMode }, warn) => {
  const characters = text.split("");
  maskLabels(text, characters, writingMode);
  const groups = (wordGroups ?? []).toSorted((left, right) => right.text.length - left.text.length);
  Iterator.from(groups).forEach((group) => {
    maskGroup(text, characters, group.text);
  });
  // Quoted punctuation belongs to the single quoted word for counting.
  Iterator.from(characters.join("").matchAll(/"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’/gu)).forEach(
    (match) => {
      collapseWord(characters, match.index, match.index + match[0].length);
    },
  );
  if (/["“”‘’]/u.test(characters.join(""))) {
    warn("Unbalanced quotation marks require contextual parsing.");
  }
  return characters;
};
