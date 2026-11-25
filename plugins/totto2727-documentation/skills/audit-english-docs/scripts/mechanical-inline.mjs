/** @typedef {import("./mechanical-source.mjs").Exclusion} Exclusion */
/** @typedef {import("./mechanical-source.mjs").RecordExclusion} RecordExclusion */

const FIRST_RUN = 0;
const NEXT_RUN = 1;
const NO_CLOSING_RUN = -1;

/** @type {(markdown: string, exclusions: Exclusion[]) => () => string} */
export const masking = (markdown, exclusions) => {
  const lineBreaks = [...markdown.matchAll(/[\r\n]/gu)];
  return () => {
    const characters = markdown.split("");
    exclusions.forEach(({ start, end }) => {
      characters.fill(" ", start, end);
    });
    lineBreaks.forEach((lineBreak) => {
      const [character] = lineBreak;
      characters[lineBreak.index] = character;
    });
    return characters.join("");
  };
};

/** @type {(visible: string, exclude: RecordExclusion) => void} */
export const excludeCodeSpans = (visible, exclude) => {
  // Code spans close at the next run of the same delimiter width, across newlines.
  const runs = [...visible.matchAll(/`+/gu)];
  const cursor = { index: FIRST_RUN };
  while (cursor.index < runs.length) {
    const { index } = cursor;
    const opening = runs[index];
    const closing = runs.findIndex(
      (other, position) => position > index && other[0].length === opening[0].length,
    );
    cursor.index = (closing === NO_CLOSING_RUN ? index : closing) + NEXT_RUN;
    if (closing !== NO_CLOSING_RUN) {
      const end = runs[closing];
      exclude(opening.index, end.index + end[0].length, "inline-code");
    }
  }
};

/** @type {[pattern: RegExp, kind: string][]} */
const MARKUP_PHASES = [
  [
    // oxlint-disable-next-line eslint/require-unicode-regexp -- Keep ASCII case folding for HTML tag names and their closing backreferences.
    /<(?<tag>script|pre|style|textarea)\b[^>]*>[\s\S]*?(?:<\/\k<tag>\s*>|$)/gi,
    "html-block",
  ],
  [
    // oxlint-disable-next-line eslint/require-unicode-regexp -- Unicode case folding would accept extra characters in this fixed HTML block name list.
    /^ {0,3}<\/?(?:address|article|aside|blockquote|details|div|dl|fieldset|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|section|table|ul)\b[^\n]*[\s\S]*?(?=\n[ \t]*\r?\n|(?![\s\S]))/gim,
    "html-block",
  ],
  [
    // Paired HTML and comments are excluded with their contents.
    /<!--[\s\S]*?(?:-->|$)|<(?<tag>[A-Za-z][\w:-]*)\b[^>]*>[\s\S]*?<\/\k<tag>\s*>|<[^>\n]+>/gu,
    "html",
  ],
  [
    /(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/|mailto:|www\.)[^\s<>]+|\]\([^\n]*?\)|^ {0,3}\[[^\]\n]+\]:[^\n]*|\{#[^}\n]+\}\s*$/gmu,
    "url-or-markup",
  ],
  [/^ {4}[^\n]+|^\t[^\n]+/gmu, "indented-code"],
];

/** @type {(mask: () => string, exclude: RecordExclusion) => void} */
export const excludeMarkup = (mask, exclude) => {
  MARKUP_PHASES.forEach(([pattern, kind]) => {
    // Mask each phase before the next one considers overlapping source.
    [...mask().matchAll(pattern)].forEach((match) => {
      exclude(match.index, match.index + match[0].length, kind);
    });
  });
};
