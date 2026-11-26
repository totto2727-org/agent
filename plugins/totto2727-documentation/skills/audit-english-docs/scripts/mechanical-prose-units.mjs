/** @typedef {{ end: number, reason: string, start: number }} LocalWarning */
/** @typedef {{ fragment: boolean, offset: number, text: string }} ProsePart */

const START = 0;
const NEXT_LINE = 1;
const LIST_LINES = /^ {0,3}(?:[-+*]|\d+[.)])\s+[^\n]*(?:\n|$)/gmu;
const LIST_MARKER = /^ {0,3}(?:[-+*]|\d+[.)])\s+/u;
const NUMBERED_MARKER = /^ {0,3}\d+[.)]\s+/u;

/** @type {(text: string, matches: RegExpExecArray[]) => boolean} */
const completeList = (text, matches) =>
  matches.every(
    (line, index) =>
      !text
        .slice(line.index + line[0].length, matches[index + NEXT_LINE]?.index ?? text.length)
        .trim(),
  );

/** @type {(line: RegExpExecArray, matcher: RegExp, fragment: boolean) => ProsePart} */
const listPart = (line, matcher, fragment) => {
  const [source] = line;
  const marker = matcher.exec(source)?.[START] ?? "";
  // oxlint-disable-next-line eslint/sort-keys -- Keep the word-count part fields aligned with the original projection.
  return { text: source.slice(marker.length), offset: line.index + marker.length, fragment };
};

/** @type {(text: string, rest: RegExpExecArray[]) => ProsePart[]} */
const introducedList = (text, rest) => {
  // oxlint-disable-next-line eslint/sort-keys -- Keep the prefix part shape aligned with the original projection.
  const prefix = {
    text: text.replace(/:(?<tail>\s*)$/u, ".$<tail>"),
    offset: START,
    fragment: false,
  };
  return [prefix, ...rest.map((line) => listPart(line, LIST_MARKER, true))];
};

/** @type {(text: string, list: { first: RegExpExecArray, lines: RegExpExecArray[] }, warnings: LocalWarning[]) => ProsePart[]} */
const sentenceList = (text, { first, lines }, warnings) => {
  const prefix = text.slice(START, first.index);
  if (/:\s*$/u.test(prefix) && completeList(text, lines)) {
    return introducedList(prefix, lines);
  }
  // Numbered work steps are separate units when they do not have a list introduction.
  if (
    !prefix.trim() &&
    lines.every((line) => NUMBERED_MARKER.test(line[0])) &&
    completeList(text, lines)
  ) {
    return lines.map((line) => listPart(line, NUMBERED_MARKER, false));
  }
  warnings.push({
    end: text.length,
    reason:
      "A list without a supported colon introduction or complete numbered steps needs contextual parsing.",
    start: START,
  });
  return [];
};

/** @type {(text: string, paragraph: boolean, warnings: LocalWarning[]) => ProsePart[]} */
export const proseParts = (text, paragraph, warnings) => {
  const lines = [...text.matchAll(LIST_LINES)];
  if (!lines.length) {
    return [{ fragment: false, offset: START, text }];
  }
  if (paragraph) {
    warnings.push({
      end: text.length,
      reason:
        "Vertical-list word-count units are not necessarily paragraph sentences (rules 6.6 and 8.4). Paragraph parsing requires review.",
      start: START,
    });
    return [];
  }
  const [first] = lines;
  return sentenceList(text, { first, lines }, warnings);
};
