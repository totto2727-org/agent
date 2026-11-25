import { WatcherQueryError } from "./github-error.ts";
import { isBoolean, isString, matchesNull, matchesUndefined } from "./native-predicates.ts";

// oxlint-disable-next-line unicorn/no-null -- The GitHub wire protocol uses JSON null for missing nullable fields.
export const WIRE_NULL = null;

const raw = function (value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};
export const missing = function (path: string, value?: unknown): never {
  const detail = matchesUndefined(value) ? `missing ${path}` : `invalid ${path}: ${raw(value)}`;
  // oxlint-disable-next-line eslint/sort-keys -- Preserve the existing serialized decoded-field error order.
  throw new WatcherQueryError({ kind: "missing-key", retryable: true, detail, ...(matchesUndefined(value) ? {} : { rawValue: raw(value) }) });
};
// oxlint-disable-next-line rules/no-type-predicate -- The standalone GitHub decoder narrows native JSON records without loading Effect.
const isRecord = function (value: unknown): value is Record<string, unknown> {
  // oxlint-disable-next-line rules/force-predicate -- This native JSON record check keeps GitHub parsing independent of Effect in the standalone Bun watcher.
  return typeof value === "object" && !matchesNull(value) && !Array.isArray(value);
};
export const record = (value: unknown, path: string): Record<string, unknown> =>
  isRecord(value) ? value : missing(path, value);
export const list = (value: unknown, path: string): Readonly<unknown[]> =>
  Array.isArray(value) ? value : missing(path, value);
export const at = function (value: unknown, path: Readonly<string[]>): unknown {
  const label = path.join(".");
  const descend = (current: unknown, [key, ...rest]: Readonly<string[]>): unknown => {
    if (matchesUndefined(key)) {return current;}
    const object = record(current, label);
    if (!(key in object)) {missing(label);}
    return descend(object[key], rest);
  };
  return descend(value, path);
};
export const string = (value: unknown, path: string): string =>
  isString(value) ? value : missing(path, value);
export const boolean = (value: unknown, path: string): boolean =>
  isBoolean(value) ? value : missing(path, value);
export const optionalString = (value: unknown, path: string): string | null =>
  matchesNull(value) ? WIRE_NULL : string(value, path);
export const enumValue = function <const Member extends string>(
  value: unknown,
  values: Readonly<Member[]>,
  path: string
): Member {
  const match = isString(value) ? values.find((candidate) => candidate === value) : undefined;
  return match ?? missing(path, value);
};
export const nullableEnum = <const Member extends string>(
  value: unknown,
  values: Readonly<Member[]>,
  path: string
): Member | null => (matchesNull(value) ? WIRE_NULL : enumValue(value, values, path));
