const KEYWORDS =
  "CONSTANT CONSTANTS CONSTRAINT CONSTRAINTS ACTION_CONSTRAINT ACTION_CONSTRAINTS INVARIANT INVARIANTS PROPERTY PROPERTIES INIT NEXT SPECIFICATION VIEW SYMMETRY TYPE TYPE_CONSTRAINT CHECK_DEADLOCK".split(
    " ",
  );
const ONE_NAME = new Set(["INIT", "NEXT", "SPECIFICATION", "VIEW", "SYMMETRY", "TYPE", "TYPE_CONSTRAINT"]);
const NAMES = [
  "Init",
  "Next",
  "Spec",
  "Inv",
  "TypeOK",
  "Live",
  "V",
  "x1",
  "_a",
  "INIT2",
  "Next_INIT",
];
const VALUES = [
  "0",
  "7",
  "TRUE",
  "m1",
  '"a b"',
  '"INVARIANT (* x"',
  String.raw`"\\* y *)"`,
  String.raw`"\""`,
  "{}",
  "{1, 2}",
  '{"p", "q"}',
  "{m1, m2}",
];
const SPACES = [" ", " ", "\t", "  "];
const BREAKS = ["\n", "\n", "\r\n", "\r", "\n\n"];
const GAPS = [...SPACES, ...BREAKS, ""];
const ODD_SPACES = ["", "\u00A0", "\u2028", "\u2029", "\u0085"];
const COMMENTS = [
  "\\* CHECK_DEADLOCK FALSE\n",
  "\\* CHECK_DEADLOCK FALSE\r",
  "\\* CHECK_DEADLOCK FALSE\r\n",
  "(* CHECK_DEADLOCK FALSE *)",
  "(* (* INVARIANT Hidden *) CHECK_DEADLOCK FALSE *)",
  "(**)",
  '(* " *)',
];
const INSERTS = [
  "(* CHECK_DEADLOCK FALSE",
  "*)",
  '"open',
  ",",
  "=",
  "<-",
  "{",
  "1",
  "foo",
  "invariant",
  "ALIAS",
  "POSTCONDITION",
  "\\",
  String.raw`"a\qb"`,
];
const EMPTY_INDEX = 0;
const FIRST_ITEM = 0;
const ONE_ITEM = 1;
const CONSTANT_FORMS = ["=", "<-", "<-[M]"];
const CONSTANT_NAMES = ["N", "K", "S"];
const BOOLEANS = ["TRUE", "FALSE"];
const SECTION_COUNT = 4;
const COMMENT_COUNT = 3;
const MUTATION_COUNT = 4;
const CONSTANT_COUNT = 2;
const NAME_COUNT = 3;
const OPERATOR_WIDTH = 2;

const SEED_STEP = 0x6D_2B_79_F5;
const FIRST_MIX_SHIFT = 15;
const SECOND_MIX_SHIFT = 7;
const OUTPUT_SHIFT = 14;
const FIRST_MIX_OR = 1;
const SECOND_MIX_OR = 61;
const UNSIGNED_SHIFT = 0;
const UINT32_RANGE = 4_294_967_296;

// oxlint-disable eslint/no-bitwise -- Mulberry32 uses defined signed and unsigned 32-bit operations to reproduce the existing config corpus.
export const mulberry32 = function (seed: number): () => number {
  const state = { seed };
  return () => {
    // oxlint-disable-next-line unicorn/prefer-math-trunc, eslint/no-magic-numbers -- Mulberry32 needs wrapping to a signed 32-bit word after adding the seed step.
    state.seed = (state.seed + SEED_STEP) | 0;
    // oxlint-disable-next-line oxc/bad-bitwise-operator -- Mulberry32 sets the low bit of the seed word with a bitwise OR.
    const first = Math.imul(state.seed ^ (state.seed >>> FIRST_MIX_SHIFT), FIRST_MIX_OR | state.seed);
    const mixed = (first + Math.imul(first ^ (first >>> SECOND_MIX_SHIFT), SECOND_MIX_OR | first)) ^ first;
    return ((mixed ^ (mixed >>> OUTPUT_SHIFT)) >>> UNSIGNED_SHIFT) / UINT32_RANGE;
  };
};
// oxlint-enable eslint/no-bitwise

interface Draw {
  int: (limit: number) => number;
  pick: <Item>(list: Readonly<Item[]>) => Item;
}

interface Token {
  gap: string;
  text: string;
}

export interface Sample {
  mutated: boolean;
  text: string;
}

const repeat = (count: number, run: () => void): void => {
  const remaining = { count };
  while (remaining.count > EMPTY_INDEX) {
    run();
    remaining.count -= ONE_ITEM;
  }
};

const fillConstant = (draw: Draw, add: (text: string) => void): void => {
  const form = draw.pick(CONSTANT_FORMS);
  add(draw.pick(CONSTANT_NAMES));
  add(form.slice(FIRST_ITEM, OPERATOR_WIDTH));
  if (form === "<-[M]") {add("[M]");}
  add(form === "=" ? draw.pick(VALUES) : draw.pick(NAMES));
};

const section = (key: string, draw: Draw): Token[] => {
  const tokens = [{ gap: draw.pick(BREAKS), text: key }];
  const add = (text: string): void => {tokens.push({ gap: draw.pick(SPACES), text });};
  if (key === "CHECK_DEADLOCK") {add(draw.pick(BOOLEANS));}
  else if (ONE_NAME.has(key)) {add(draw.pick(NAMES));}
  else if (key.startsWith("CONSTANT")) {
    repeat(ONE_ITEM + draw.int(CONSTANT_COUNT), () => {fillConstant(draw, add);});
  } else {
    repeat(ONE_ITEM + draw.int(NAME_COUNT), () => {add(draw.pick(NAMES));});
  }
  return tokens;
};

interface Mutation {
  at: number;
  draw: Draw;
  token: Token;
  tokens: Token[];
}

type Edit = "typo" | "case" | "space" | "insert" | "drop" | "section";
const EDITS: Readonly<Edit[]> = ["typo", "case", "space", "insert", "drop", "section"];

const apply: Readonly<Record<Edit, (action: Mutation) => void>> = {
  case: ({ draw, token }) => {
    token.text = draw.pick([token.text.toLowerCase(), token.text[FIRST_ITEM] + token.text.slice(ONE_ITEM).toLowerCase()]);
  },
  drop: ({ at, tokens }) => {
    if (tokens.length > ONE_ITEM) {tokens.splice(at % tokens.length, ONE_ITEM);}
  },
  insert: ({ at, draw, tokens }) => {
    tokens.splice(at, EMPTY_INDEX, { gap: draw.pick(GAPS), text: draw.pick(draw.pick([INSERTS, KEYWORDS])) });
  },
  section: ({ at, draw, tokens }) => {
    tokens.splice(at, EMPTY_INDEX, ...section(draw.pick(KEYWORDS), draw));
  },
  space: ({ draw, token }) => {
    token.gap = draw.pick(ODD_SPACES);
  },
  typo: ({ draw, token }) => {
    const index = draw.int(token.text.length);
    const character = token.text[index];
    const replacement = draw.pick(["", "E", "_", "0", ",", character + character]);
    token.text = token.text.slice(FIRST_ITEM, index) + replacement + token.text.slice(index + ONE_ITEM);
  },
};

const mutate = (tokens: Token[], draw: Draw): void => {
  const kind = draw.pick(EDITS);
  const token = tokens[draw.int(tokens.length)];
  const at = draw.int(tokens.length + ONE_ITEM);
  apply[kind]({ at, draw, token, tokens });
};

export const generate = function (random: () => number): Sample {
  const int = (limit: number): number => Math.floor(random() * limit);
  const draw: Draw = { int, pick: (list) => list[int(list.length)] };
  const tokens = draw.pick([["SPECIFICATION"], ["INIT", "NEXT"]]).flatMap((key) => section(key, draw));
  repeat(int(SECTION_COUNT), () => {tokens.splice(draw.pick([FIRST_ITEM, tokens.length]), EMPTY_INDEX, ...section(draw.pick(KEYWORDS), draw));});
  repeat(int(COMMENT_COUNT), () => {
    tokens.splice(int(tokens.length + ONE_ITEM), EMPTY_INDEX, { gap: draw.pick(GAPS), text: draw.pick(COMMENTS) });
  });
  const mutations = int(MUTATION_COUNT);
  repeat(mutations, () => {mutate(tokens, draw);});
  const text = tokens.map(({ gap, text: token }) => gap + token).join("");
  return { mutated: mutations > EMPTY_INDEX, text: `${text}\n` };
};
