// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer a native type guard for the standalone skill.
export const isString = (value: unknown) => typeof value === "string";

// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer an exact native sentinel guard for the standalone skill.
export const matchesNull = (value: unknown) => value === null;

// oxlint-disable-next-line rules/force-predicate, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer an exact native sentinel guard for the standalone skill.
export const matchesUndefined = (value: unknown) => value === undefined;
