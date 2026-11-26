/** @typedef {new (message: string) => Error} ErrorConstructor */
/** @typedef {(message: string) => never} Reject */

export const MAXIMUM_LITERAL_LENGTH = 512;
const MAXIMUM_CONTEXT_ENTRIES = 1000;

/** @type {(value: unknown, valid: (entry: unknown) => boolean) => boolean} */
export const validContextEntries = (value, valid) =>
  Array.isArray(value) &&
  value.length <= MAXIMUM_CONTEXT_ENTRIES &&
  value.every((entry) => valid(entry));

/** @type {(label: string, ErrorType: ErrorConstructor) => Reject} */
export const rejectWith = (label, ErrorType) => (message) => {
  throw new ErrorType(`${label}: ${message}`);
};
