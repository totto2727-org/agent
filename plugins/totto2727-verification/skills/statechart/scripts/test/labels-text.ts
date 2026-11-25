import { matchesUndefined } from "#statechart/ir.ts";

export const visible = (text: string): string =>
  text
    .toWellFormed()
    .replaceAll(/(?![\t-\r\u0085])[\p{Cc}\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/gu, "")
    .replaceAll(/\p{White_Space}+/gu, " ")
    .trim();
export const wrapped = (text: string): string => visible(text).replaceAll(" ", "");
// oxlint-disable-next-line eslint/no-control-regex -- Match the existing control-code exclusions when checking for a drawable title.
export const titled = (title: string | undefined): boolean => /[^\u0000\u0080-\u0084\u0086-\u009F]/u.test(title ?? "");
const NAMED: Record<string, string | undefined> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: "\u00A0",
  quot: '"',
};
const WINDOWS_1252 = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ";
const NUL = 0;
const MAX_CODE_POINT = 0x10_FF_FF;
const FIRST_SURROGATE = 0xD8_00;
const LAST_SURROGATE = 0xDF_FF;
const FIRST_C1_CONTROL = 0x80;
const LAST_C1_CONTROL = 0x9F;
const HEX_RADIX = 16;

const fromRef = (codePoint: number): string => {
  if (codePoint === NUL || codePoint > MAX_CODE_POINT || (codePoint >= FIRST_SURROGATE && codePoint <= LAST_SURROGATE)) {return "\uFFFD";}
  if (codePoint >= FIRST_C1_CONTROL && codePoint <= LAST_C1_CONTROL) {return WINDOWS_1252[codePoint - FIRST_C1_CONTROL];}
  return String.fromCodePoint(codePoint);
};
const mermaidReference = (_match: string, decimal: string | undefined, named = ""): string => {
  if (matchesUndefined(decimal)) {return NAMED[named] ?? `&${named};`;}
  return fromRef(Number(decimal));
};

export const fromMermaid = (text: string): string =>
  text.replaceAll(/ﬂ°°(?<decimal>\d+)¶ß|ﬂ°(?<named>\w+)¶ß/gu, mermaidReference);
export const decoded = (text: string): string =>
  text
    .replaceAll('ﬂ°°', "&#")
    .replaceAll('ﬂ°', "&")
    .replaceAll('¶ß', ";");
const MARKER_END = /marker-end="url\([\d+./:=?A-Za-z-]*?#/gu;
export const rewritten = (text: string): boolean =>
  /ﬂ°|¶ß/u.test(text) || text.replaceAll(MARKER_END, 'marker-end="url(#') !== text;
export const fromSvg = (text: string): string =>
  text
    .replaceAll(/<\/tspan>\s*<tspan[^>]*>/gu, " ")
    .replaceAll(/<[^>]*>/gu, "")
    .replaceAll(/&#x(?<hex>[0-9a-f]+);/giu, (_match: string, hex: string) => fromRef(Number.parseInt(hex, HEX_RADIX)))
    .replaceAll(/&#(?<decimal>\d+);/gu, (_match: string, decimal: string) => fromRef(Number(decimal)))
    .replaceAll(/&(?<named>quot|lt|gt|apos|nbsp);/gu, (_match: string, named: string) => NAMED[named] ?? "")
    .replaceAll('&amp;', "&");
