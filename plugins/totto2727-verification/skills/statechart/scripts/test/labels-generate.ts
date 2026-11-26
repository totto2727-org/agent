import { BAD_COLORS, OTHER, SPACE, SYNTAX, WORDS } from "./labels-fragments.ts";

export const THEME = ["blue", "orange", "purple", "yellow", "teal", "tan", "pink"];
// Mulberry32 mixes a 32-bit state. Keep the step and shifts stable for replayable failures.
const UINT32_SHIFT = 0;
const UINT32_RANGE = 4_294_967_296;
const STATE_INCREMENT = 0x6D_2B_79_F5;
const FIRST_MIX_SHIFT = 15;
const FIRST_MIX_MASK = 1;
const SECOND_MIX_SHIFT = 7;
const SECOND_MIX_MASK = 61;
const FINAL_MIX_SHIFT = 14;
const INCLUSIVE_RANGE = 1;

interface Random {
  chance: (probability: number) => boolean;
  int: (upperBound: number) => number;
  pick: <Item>(items: Readonly<Item[]>) => Item;
  range: (lower: number, upper: number) => number;
}

export const random = (seed: number): Random => {
  // oxlint-disable-next-line eslint/no-bitwise -- Mulberry32 starts with the unsigned 32-bit seed.
  const cursor = { state: seed >>> UINT32_SHIFT };
  const next = (): number => {
    /* oxlint-disable eslint/no-bitwise -- Mulberry32 uses these fixed unsigned 32-bit operations to reproduce the existing fixtures. */
    cursor.state = (cursor.state + STATE_INCREMENT) >>> UINT32_SHIFT;
    const { state } = cursor;
    const firstMix = Math.imul(state ^ (state >>> FIRST_MIX_SHIFT), state | FIRST_MIX_MASK);
    const secondMix = firstMix ^ (firstMix + Math.imul(firstMix ^ (firstMix >>> SECOND_MIX_SHIFT), firstMix | SECOND_MIX_MASK));
    return ((secondMix ^ (secondMix >>> FINAL_MIX_SHIFT)) >>> UINT32_SHIFT) / UINT32_RANGE;
    /* oxlint-enable eslint/no-bitwise */
  };
  const int = (upperBound: number): number => Math.floor(next() * upperBound);
  return {
    chance: (probability: number) => next() < probability,
    int,
    pick: <Item>(items: Readonly<Item[]>) => items[int(items.length)],
    range: (lower: number, upper: number) => lower + int(upper - lower + INCLUSIVE_RANGE),
  };
};

const FRAGMENTS_MIN = 1;
const FRAGMENTS_MAX = 4;
const LABEL_CHOICES = 13;
const WORD_BOUND = 4;
const SYNTAX_BOUND = 7;
const SPACE_BOUND = 9;
const OTHER_BOUND = 11;
const FIRST_PRINTABLE_ASCII = 32;
const PRINTABLE_ASCII_COUNT = 95;

const labelFragment = (randomizer: Random): string | undefined => {
  const choice = randomizer.int(LABEL_CHOICES);
  if (choice < WORD_BOUND) {return randomizer.pick(WORDS);}
  if (choice < SYNTAX_BOUND) {return randomizer.pick(SYNTAX);}
  if (choice < SPACE_BOUND) {return randomizer.pick(SPACE);}
  if (choice < OTHER_BOUND) {return randomizer.pick(OTHER);}
  return String.fromCodePoint(FIRST_PRINTABLE_ASCII + randomizer.int(PRINTABLE_ASCII_COUNT));
};

const several = <Item>(count: number, make: () => Item): Item[] =>
  Array.from({ length: count }, () => make());

const label = (randomizer: Random): string => {
  const count = randomizer.range(FRAGMENTS_MIN, FRAGMENTS_MAX);
  return several(count, () => String(labelFragment(randomizer))).join("");
};

const THEME_CHANCE = 0.85;
const OTHER_COLOR_CHOICES = 3;
const INVALID_COLOR_CHOICE = 0;
const COMPOSITE_COLOR_CHOICE = 1;

const color = (randomizer: Random): unknown => {
  if (randomizer.chance(THEME_CHANCE)) {return randomizer.pick(THEME);}
  const choice = randomizer.int(OTHER_COLOR_CHOICES);
  if (choice === INVALID_COLOR_CHOICE) {return randomizer.pick(BAD_COLORS);}
  if (choice === COMPOSITE_COLOR_CHOICE) {return randomizer.pick(THEME) + randomizer.pick(SPACE) + label(randomizer);}
  return label(randomizer);
};

type Shape =
  | { mode: "flat"; leaf: number[] }
  | { mode: "parents"; leaf: number[]; parents: number[]; parentOf: number[] }
  | { mode: "regions"; regions: number[]; pools: number[][]; values: number[][] };

type Groups =
  | { groups?: undefined; colors?: undefined; groupOf?: undefined }
  | { groups: number[]; colors: unknown[]; groupOf: number[] };

export type Case = Shape &
  Groups & { stateCount: number; labels: string[]; actions: number[]; steps: number[][]; title?: number };

const SHAPE_CHOICES = 10;
const FLAT_SHAPE_BOUND = 4;
const PARENT_SHAPE_BOUND = 7;
const MIN_STATES = 2;
const MAX_STATES = 4;
const REGION_POOL_SIZE = 2;
const TWO_PARENTS_CHANCE = 0.5;
const HAS_PARENT_CHANCE = 0.75;
const NO_PARENT = -1;
const MIN_ACTIONS = 1;
const MAX_ACTIONS = 3;
const MIN_STEPS = 1;
const MAX_STEPS = 5;
const HAS_GROUPS_CHANCE = 0.4;
const MIN_GROUPS = 1;
const MAX_GROUPS = 2;
const MEMBER_OF_GROUP_CHANCE = 0.8;
const NO_GROUP = -1;
const HAS_TITLE_CHANCE = 0.3;
const PUSHED_LABEL_POSITION = 1;

const regionsShape = (randomizer: Random, stateCount: number, slot: () => number): Shape => {
  const regions = [slot(), slot()];
  const pools = [[slot(), slot()], [slot(), slot()]];
  const values = several(stateCount, () => [randomizer.int(REGION_POOL_SIZE), randomizer.int(REGION_POOL_SIZE)]);
  return { mode: "regions", pools, regions, values };
};

const generatedShape = (
  randomizer: Random, { choice, stateCount }: { choice: number; stateCount: number }, slot: () => number,
): Shape => {
  if (choice >= PARENT_SHAPE_BOUND) {return regionsShape(randomizer, stateCount, slot);}
  const leaf = several(stateCount, slot);
  if (choice < FLAT_SHAPE_BOUND) {
    return { leaf, mode: "flat" };
  }
  const parents = randomizer.chance(TWO_PARENTS_CHANCE) ? [slot(), slot()] : [slot()];
  const parentOf = several(stateCount, () =>
    randomizer.chance(HAS_PARENT_CHANCE) ? randomizer.int(parents.length) : NO_PARENT);
  return { leaf, mode: "parents", parentOf, parents };
};

const generatedGroups = (randomizer: Random, stateCount: number, slot: () => number): Groups => {
  if (!randomizer.chance(HAS_GROUPS_CHANCE)) {return {};}
  const named = several(randomizer.range(MIN_GROUPS, MAX_GROUPS), slot);
  const colors = several(named.length, () => color(randomizer));
  const groupOf = several(stateCount, () =>
    randomizer.chance(MEMBER_OF_GROUP_CHANCE) ? randomizer.int(named.length) : NO_GROUP);
  return { colors, groupOf, groups: named };
};

export const generate = (randomizer: Random): Case => {
  const labels: string[] = [];
  const slot = (): number => labels.push(label(randomizer)) - PUSHED_LABEL_POSITION;
  const choice = randomizer.int(SHAPE_CHOICES);
  const stateCount = randomizer.range(MIN_STATES, MAX_STATES);
  const shape = generatedShape(randomizer, { choice, stateCount }, slot);
  const actions = several(randomizer.range(MIN_ACTIONS, MAX_ACTIONS), slot);
  const steps = several(randomizer.range(MIN_STEPS, MAX_STEPS), () =>
    [randomizer.int(stateCount), randomizer.int(stateCount), randomizer.int(actions.length)]);
  const groups = generatedGroups(randomizer, stateCount, slot);
  const title = randomizer.chance(HAS_TITLE_CHANCE) ? slot() : undefined;
  return { ...shape, ...groups, actions, labels, stateCount, steps, title };
};
