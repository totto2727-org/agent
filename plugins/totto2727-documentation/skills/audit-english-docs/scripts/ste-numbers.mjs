import { boundary, collapseWord } from "./ste-mask.mjs";
import { isEmptyString, matchesUndefined } from "./native-predicates.mjs";

/** @typedef {import("./ste.mjs").ProseContext} ProseContext */
/** @typedef {import("./ste-mask.mjs").Warn} Warn */
/** @typedef {{ characters: string[], current: string, units: string[] }} NumberContext */
/** @typedef {{ paragraph: boolean, warn: Warn }} NumberOptions */

const LAST_CHARACTER = 1;
const NO_MEASUREMENT = 0;
const DEFAULT_UNITS = ["mm", "mA", "°C", "degrees Celsius", "kg", "kilograms", "ohms", "Ω"];

/** @type {(characters: string[]) => void} */
const collapseAbbreviations = (characters) => {
  const current = characters.join("");
  Iterator.from(
    current.matchAll(/\b(?:No\.\s+\d[\w-]*|\d+(?:\.\d+)?\s+(?:a\.m\.|p\.m\.))(?=\s|[,.!?]|$)/gu),
  ).forEach((match) => {
    const [source] = match;
    const end = match.index + source.length;
    collapseWord(characters, match.index, end);
    if (source.endsWith(".") && !current.slice(end).trim()) {
      characters[end - LAST_CHARACTER] = ".";
    }
  });
};

/** @type {(tail: string, gap: string, units: string[]) => number} */
const measurementWidth = (tail, gap, units) => {
  const unit = units.find(
    (candidate) =>
      tail.slice(gap.length).startsWith(candidate) && boundary(tail, gap.length + candidate.length),
  );
  if (matchesUndefined(unit) || isEmptyString(unit) || isEmptyString(gap)) {
    return NO_MEASUREMENT;
  }
  return gap.length + unit.length;
};

/** @type {(input: NumberContext, match: RegExpExecArray, options: NumberOptions) => void} */
const collapseNumber = ({ characters, current, units }, match, { paragraph, warn }) => {
  const [source] = match;
  const end = match.index + source.length;
  if (!boundary(current, match.index - LAST_CHARACTER) || !boundary(current, end)) {
    return;
  }
  const tail = current.slice(end);
  const gap = /^\s+/u.exec(tail)?.[0] ?? "";
  const width = measurementWidth(tail, gap, units);
  collapseWord(characters, match.index, end + width);
  if (width === NO_MEASUREMENT && !paragraph && /^\s+[\p{L}°µμΩ%]/u.test(tail)) {
    warn(
      "A number followed by an undeclared word can be a measurement or identifier; declare the literal group or measurement unit.",
      match.index,
      end + gap.length,
    );
  }
};

/** @type {(characters: string[], declarations: ProseContext["measurementUnits"], options: NumberOptions) => string} */
export const collapseNumbers = (characters, declarations, options) => {
  collapseAbbreviations(characters);
  const units = [...new Set([...DEFAULT_UNITS, ...(declarations ?? [])])].toSorted(
    (left, right) => right.length - left.length,
  );
  const current = characters.join("");
  const input = { characters, current, units };
  Iterator.from(current.matchAll(/[+-]?\d+(?:,\d{3})*(?:\.\d+)?/gu)).forEach((match) => {
    collapseNumber(input, match, options);
  });
  return characters.join("");
};
