import { matchesUndefined } from "#statechart/ir.ts";

const BLANK = /\p{White_Space}/u;
const SAFE = /^[\p{L}\p{N} !'()+,\-./=?[\]"_|@{}:\\^%<>]$/u;
const HAZARD =
  /:(?=:|$|\S*#)|\\(?=n)|%(?=%)|<(?=[\p{L}/!?])|_(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])_/giu;
const DIRECTION = /(?<command>direction)\s+(?=LR|RL|TB|BT)/giu;
const DOUBLE_BRACKET = /\[(?=\[)/gu;
const C4 = /C4(?=Container|Component|Dynamic|Deployment)/gu;
const UNDRAWN = /[\0\u0080-\u009F]/u;
const REWRITTEN = ["ﬂ°", "¶ß"];
const MARKER = /(?<=marker-end=)"/gu;
const FIRST_CODE_UNIT = 0;
const ASCII_LIMIT = 128;
const FIRST_SURROGATE = 0xD8_00;
const LAST_SURROGATE = 0xDF_FF;
const REPLACEMENT = 0xFF_FD;
const WORD_JOINER = 0x20_60;
const NO_PREVIOUS_CHARACTER = -1;

const firstOf = new Map<number, number>(
  REWRITTEN.map((pair) => {
    const [first, second] = Array.from(pair, (character) => character.codePointAt(FIRST_CODE_UNIT) ?? FIRST_CODE_UNIT);
    return [second, first];
  }),
);

const KEPT = 0;
const BLANKED = 1;
const DROPPED = 2;
const CODED = 3;

const kindOf = (codePoint: number): number => {
  const character = String.fromCodePoint(codePoint);
  if (character === " ") {
    return KEPT;
  }
  if (BLANK.test(character)) {
    return BLANKED;
  }
  if (UNDRAWN.test(character)) {
    return DROPPED;
  }
  return SAFE.test(character) ? KEPT : CODED;
};

const ASCII = Uint8Array.from({ length: ASCII_LIMIT }, (_unused, codePoint) => kindOf(codePoint));
const wide = new Map<number, number>();
const kindAt = (codePoint: number): number => {
  if (codePoint < ASCII_LIMIT) {
    return ASCII[codePoint];
  }
  const cached = wide.get(codePoint);
  if (!matchesUndefined(cached)) {
    return cached;
  }
  const kind = kindOf(codePoint);
  wide.set(codePoint, kind);
  return kind;
};

const scalar = (character: string): number => {
  const codePoint = character.codePointAt(FIRST_CODE_UNIT) ?? FIRST_CODE_UNIT;
  return codePoint >= FIRST_SURROGATE && codePoint <= LAST_SURROGATE ? REPLACEMENT : codePoint;
};

const encode = (text: string, ref: (codePoint: number) => string): string => {
  const position = {
    end: FIRST_CODE_UNIT,
    last: NO_PREVIOUS_CHARACTER,
    output: "",
    spanStart: FIRST_CODE_UNIT,
  };
  // oxlint-disable-next-line rules/no-for-loops -- Iterate Unicode characters without copying potentially long labels or losing their UTF-16 offsets.
  for (const character of text) {
    const offset = position.end;
    position.end += character.length;
    const codePoint = scalar(character);
    const kind = kindAt(codePoint);
    if (kind === DROPPED) {
      position.output += text.slice(position.spanStart, offset);
      position.spanStart = position.end;
    } else {
      const joined = firstOf.get(codePoint) === position.last;
      if (joined || kind !== KEPT) {
        position.output += text.slice(position.spanStart, offset);
        if (joined) {
          position.output += ref(WORD_JOINER);
        }
        if (kind === KEPT) {
          position.spanStart = offset;
        } else {
          position.output += kind === BLANKED ? " " : ref(codePoint);
          position.spanStart = position.end;
        }
      }
      position.last = codePoint;
    }
  }
  return position.output + text.slice(position.spanStart);
};

const code = (text: string, ref: (codePoint: number) => string): string =>
  encode(text, ref)
    .replaceAll(MARKER, `${ref(WORD_JOINER)}"`)
    .replaceAll(HAZARD, (character) => ref(scalar(character)));

export const escapeLabel = (text: string, quoted = false): string => {
  const plain = code(text, (codePoint) => `#${codePoint};`);
  const out = quoted ? plain.replaceAll('"', "#34;") : plain;
  if (!out.trim()) {
    return "#32;";
  }
  const turned = out.replaceAll(DIRECTION, "$<command>#32;");
  const opened = turned.includes("[[") ? turned.replaceAll(DOUBLE_BRACKET, "#91;") : turned;
  return opened.includes("C4") ? opened.replaceAll(C4, "C#52;") : opened;
};

export const escapeTitle = (title: string): string =>
  code(title, (codePoint) => `ﬂ°°${codePoint}¶ß`).replaceAll("<", "ﬂ°°60¶ß");
