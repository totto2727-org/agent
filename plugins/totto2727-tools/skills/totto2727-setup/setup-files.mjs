// oxlint-disable-next-line rules/no-node-imports -- Hash installed skills with the existing SHA-256 receipt format.
import { createHash } from "node:crypto";
// oxlint-disable-next-line rules/no-node-imports -- Inspect receipts and installed skill files in the selected native scope.
import { access, lstat, readFile, readdir } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Walk own skill directories using the host filesystem's paths.
import path from "node:path";

const EXECUTABLE_BITS = 0o111;
const COMES_BEFORE = -1;
const COMES_AFTER = 1;

/** @type {(condition: unknown, message: string) => asserts condition} */
export const requireThat = function (ok, message) {
  const accepted = Boolean(ok);
  if (!accepted) {
    // oxlint-disable-next-line rules/require-tagged-error -- Preserve native validation failures from the dependency-free CLI.
    throw new Error(message);
  }
};
/** @type {(value: unknown) => value is Record<string, unknown>} */
// oxlint-disable-next-line rules/force-predicate -- The standalone CLI narrows parsed JSON without repository dependencies.
export const hasJsonProperties = (value) => value !== null && typeof value === "object";

/** @type {(value: unknown) => value is string} */
// oxlint-disable-next-line rules/force-predicate -- Confirm a JSON string without loading a package in the bootstrap.
export const isText = (value) => typeof value === "string";

/** @type {(file: string) => Promise<boolean>} */
export const exists = async (file) => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};
/** @type {(file: string) => Promise<import("node:fs").Stats | undefined>} */
export const entryStatus = async (file) => {
  try {
    return await lstat(file);
  } catch (error) {
    /** @type {unknown} */
    const code = Object.getOwnPropertyDescriptor(error ?? {}, "code")?.value;
    if (code === "ENOENT") {
      // oxlint-disable-next-line typescript/consistent-return -- An absent path has no native filesystem status.
      return;
    }
    throw error;
  }
};
/** @type {(file: string, fallback: unknown) => Promise<unknown>} */
export const readJson = async (file, fallback) => {
  if (!(await exists(file))) {
    return fallback;
  }
  /** @type {unknown} */
  const parsed = JSON.parse(await readFile(file, "utf8"));
  return parsed;
};
/** @type {(file: string) => Promise<boolean>} */
export const present = async (file) => Boolean(await entryStatus(file));

/**
 * @template Item
 * @param {Iterable<Item>} items - The items in receipt or dependency order.
 * @param {(item: Item) => Promise<void>} step - The operation to finish before advancing.
 * @returns {Promise<void>} Completion of the ordered steps.
 */
export const forEachInOrder = async (items, step) => {
  // oxlint-disable-next-line rules/no-for-loops -- The native installer advances after each ordered dependency or receipt operation.
  for (const item of items) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Later operations depend on earlier filesystem state and error order.
    await step(item);
  }
};

/** @type {(dir: string) => Promise<string | null>} */
export const fingerprint = async function (dir) {
  const status = await entryStatus(dir);
  if (status?.isDirectory() !== true) {
    // oxlint-disable-next-line unicorn/no-null -- Missing directories use the receipt format's existing null digest.
    return null;
  }
  const hash = createHash("sha256");
  /** @type {(directory: string, relativePath: string) => Promise<void>} */
  const walk = async function (directory, relativePath) {
    const children = await readdir(directory, { withFileTypes: true });
    const ordered = children.toSorted((left, right) =>
      left.name < right.name ? COMES_BEFORE : COMES_AFTER,
    );
    await forEachInOrder(ordered, async (entry) => {
      const file = path.join(directory, entry.name);
      const key = `${relativePath}/${entry.name}`;
      if (entry.isDirectory()) {
        hash.update(JSON.stringify([key, "directory"]));
        await walk(file, key);
      } else if (entry.isFile()) {
        const data = await readFile(file);
        const fileStatus = await lstat(file);
        // oxlint-disable-next-line eslint/no-bitwise -- Hash the POSIX executable permission bits used by existing receipts.
        hash.update(JSON.stringify([key, fileStatus.mode & EXECUTABLE_BITS, data.length]));
        hash.update(data);
      } else {
        hash.update(JSON.stringify([key, "non-regular"]));
      }
    });
  };
  await walk(dir, "");
  return hash.digest("hex");
};

/** @typedef {{ commit: string | undefined, source: string | undefined }} LockFields */
/** @type {(value: unknown) => LockFields} */
export const lockFields = (value) => {
  if (!hasJsonProperties(value)) {
    return { commit: undefined, source: undefined };
  }
  const { commit, source } = value;
  return {
    commit: isText(commit) ? commit : undefined,
    source: isText(source) ? source : undefined,
  };
};

/** @type {(name: unknown) => boolean} */
export const safeName = (name) => isText(name) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name);
