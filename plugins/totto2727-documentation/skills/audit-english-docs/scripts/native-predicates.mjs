/** @param {unknown} value - The input to check. */
// oxlint-disable-next-line rules/force-predicate, jsdoc/require-returns -- Infer the native type guard for an installed skill that runs without repository dependencies.
export const matchesBoolean = (value) => typeof value === "boolean";

/** @param {unknown} value - The input to check. */
// oxlint-disable-next-line rules/force-predicate, jsdoc/require-returns -- Infer the native type guard for an installed skill that runs without repository dependencies.
export const matchesString = (value) => typeof value === "string";

/** @param {unknown} value - The input to check. */
// oxlint-disable-next-line rules/force-predicate, jsdoc/require-returns -- Infer the exact native sentinel guard without repository dependencies.
export const matchesNull = (value) => value === null;

/** @param {unknown} value - The input to check. */
// oxlint-disable-next-line rules/force-predicate, jsdoc/require-returns -- Infer the exact native sentinel guard without repository dependencies.
export const matchesUndefined = (value) => value === undefined;

/** @param {unknown} value - The input to check. */
// oxlint-disable-next-line rules/force-predicate, jsdoc/require-returns -- Infer the native type guard without repository dependencies.
export const hasObjectType = (value) => typeof value === "object";

/**
 * @param {unknown} value - The input to check.
 * @returns {value is Record<string, unknown>} Whether named properties can be read as unknown values.
 */
export const isRecord = (value) =>
  hasObjectType(value) && !matchesNull(value) && !Array.isArray(value);
