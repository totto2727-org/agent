// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer the standalone tool's native object check, including null.
export const hasObjectType = (value: unknown) => typeof value === "object";

// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer a native type guard for the standalone skill.
export const isString = (value: unknown) => typeof value === "string";

// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer a native number guard in the standalone tool without loading Effect.
export const isNumber = (value: unknown) => typeof value === "number";

// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer an exact native sentinel guard for the standalone skill.
export const matchesNull = (value: unknown) => value === null;

// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer an exact native sentinel guard for the standalone skill.
export const matchesUndefined = (value: unknown) => value === undefined;

// oxlint-disable-next-line rules/no-type-predicate -- Keep the standalone view guard's structural record narrowing without loading Effect.
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  hasObjectType(value) && !matchesNull(value) && !Array.isArray(value);

// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer the standalone input guard's string-array narrowing.
export const isStrings = (value: unknown) => Array.isArray(value) && value.every((item) => isString(item));

export const visitItems = <Item>(source: Iterable<Item>, visit: (item: Item) => void): void => {
  // oxlint-disable-next-line rules/no-for-loops -- The standalone wrapper supports Bun 1.1.5, which lacks iterator helpers.
  for (const item of source) {visit(item);}
};

const PRECEDES = -1;
const SAME_POSITION = 0;
const FOLLOWS = 1;
export const FIRST_INDEX = 0;
export const NEXT_INDEX = 1;

type TextOrder = typeof PRECEDES | typeof SAME_POSITION | typeof FOLLOWS;

export const byText = (left: string, right: string): TextOrder => {
  if (left < right) {return PRECEDES;}
  if (left > right) {return FOLLOWS;}
  return SAME_POSITION;
};
