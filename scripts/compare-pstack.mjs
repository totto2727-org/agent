// oxlint-disable-next-line rules/no-node-imports -- Compare the Git mirror without installing dependencies in it.
import { execFile } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Compare repo files with Git's SHA-1 blob IDs.
import { createHash } from "node:crypto";
// oxlint-disable-next-line rules/no-node-imports -- Read both checkouts without a project installation.
import { access, readFile, readdir, stat } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Locate the checkouts using the host path conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Resolve the repository root relative to the script.
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line rules/no-node-imports -- The dependency-free CLI awaits each native Git command.
import { promisify } from "node:util";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const FIRST_ARGUMENT = 2;
const MAX_ARGUMENTS = 4;
const EXECUTABLE_BITS = 0o111;
const EMPTY_LENGTH = 0;
// oxlint-disable-next-line typescript/strict-void-return -- Node's execFile provides a custom promisify implementation that owns its ChildProcess.
const runCommand = promisify(execFile);

/** @type {(message: string) => never} */
const fail = (message) => {
  // oxlint-disable-next-line rules/require-tagged-error -- Keep validation failures native so the script works in an uninstalled checkout.
  throw new Error(message);
};

/** @type {(value: string) => boolean} */
const isEmpty = (value) => value.length === EMPTY_LENGTH;

/** @type {(file: string) => Promise<boolean>} */
const exists = async (file) => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};

/** @type {(dir: string) => Promise<string[]>} */
const skillNames = async (dir) => ((await exists(dir)) ? readdir(dir) : []);

/** @type {(folder: string) => Promise<Map<string, string>>} */
const skillOwners = async (folder) => {
  const owners = new Map();
  // oxlint-disable-next-line rules/no-for-loops -- Visit packages in the native directory order to retain the first duplicate-owner diagnostic.
  for (const plugin of await readdir(folder)) {
    const dir = path.join(folder, plugin, "skills");
    // oxlint-disable-next-line rules/no-for-loops, eslint/no-await-in-loop -- Check each skill in directory order before recording its owner.
    for (const skill of await skillNames(dir)) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- The SKILL.md file is what registers this name.
      if (await exists(path.join(dir, skill, "SKILL.md"))) {
        if (owners.has(skill)) {
          fail(`Ambiguous skill name: ${skill}`);
        }
        owners.set(skill, path.join(dir, skill));
      }
    }
  }
  return owners;
};

/** @type {(stderr: unknown) => void} */
const forwardGitStderr = (stderr) => {
  // oxlint-disable-next-line rules/force-predicate -- Check native Git errors without loading dependencies in this CLI.
  if (typeof stderr === "string" && !isEmpty(stderr)) {
    process.stderr.write(stderr);
  }
};

/** @type {(checkout: string, args: string[]) => Promise<string>} */
const queryGit = async (checkout, args) => {
  try {
    const { stdout, stderr } = await runCommand("git", ["-C", checkout, ...args], {
      encoding: "utf8",
    });
    forwardGitStderr(stderr);
    return stdout;
  } catch (error) {
    forwardGitStderr(Object.getOwnPropertyDescriptor(error ?? {}, "stderr")?.value);
    throw error;
  }
};

/** @type {(text: string, pattern: RegExp) => Set<string>} */
const documentedNames = (text, pattern) =>
  new Set(
    [...text.matchAll(pattern)].flatMap(({ groups }) => {
      const name = groups?.name ?? "";
      return isEmpty(name) ? [] : [name];
    }),
  );

/** @typedef {{ blob: string, executable: boolean, file: string, skill: string, tail: string[] }} MirrorEntry */

/** @type {(row: string) => MirrorEntry} */
const readEntry = (row) => {
  const [header, file] = row.split("\t");
  const [mode, , blob] = header.split(" ");
  const [, skill, ...tail] = file.split("/");
  return { blob, executable: mode === "100755", file, skill, tail };
};

/** @type {(file: string, entry: MirrorEntry) => Promise<boolean>} */
const matchesBlob = async (file, entry) => {
  const bytes = await readFile(file);
  const hash = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  const { mode } = await stat(file);
  // oxlint-disable-next-line eslint/no-bitwise -- Git stores whether any POSIX executable mode bit is set.
  const executable = Boolean(mode & EXECUTABLE_BITS);
  return hash === entry.blob && executable === entry.executable;
};

/** @typedef {{ changed: number, identical: number, missing: string[], removed: number, skills: Set<string> }} Comparison */
/** @typedef {{ owners: Map<string, string>, retired: Set<string>, retiredSkills: Set<string> }} Inventory */

/** @type {(owner: string, relative: string[]) => Promise<string>} */
const shippedFile = async (owner, relative) => {
  if (isEmpty(owner)) {
    return "";
  }
  const file = path.join(owner, ...relative);
  return (await exists(file)) ? file : "";
};

/** @type {(entry: MirrorEntry, inventory: Inventory, result: Comparison) => Promise<void>} */
const compareEntry = async (entry, { owners, retired }, result) => {
  const documented = retired.delete(entry.file);
  const file = await shippedFile(owners.get(entry.skill) ?? "", entry.tail);
  if (documented) {
    if (!isEmpty(file)) {
      fail(`Documented retirement still shipped: ${entry.file}`);
    }
    result.removed += 1;
  } else if (isEmpty(file)) {
    result.missing.push(entry.file);
  } else if (await matchesBlob(file, entry)) {
    result.identical += 1;
  } else {
    result.changed += 1;
    process.stdout.write(`Adapted: ${entry.file}\n`);
  }
};

/** @type {(entries: MirrorEntry[], inventory: Inventory) => Promise<Comparison>} */
const compareFiles = async (entries, inventory) => {
  /** @type {Comparison} */
  const result = { changed: 0, identical: 0, missing: [], removed: 0, skills: new Set() };
  // oxlint-disable-next-line rules/no-for-loops -- Preserve Git tree order as the script prints adapted files and reports the first invalid retirement.
  for (const entry of entries) {
    result.skills.add(entry.skill);
    if (!inventory.retiredSkills.has(entry.skill)) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each ordered comparison completes before emitting its result.
      await compareEntry(entry, inventory, result);
    }
  }
  return result;
};

/** @type {(skills: Set<string>, inventory: Inventory, license: string) => Promise<string[]>} */
const missingNotices = async (skills, { owners, retiredSkills }, license) => {
  const missing = [];
  // oxlint-disable-next-line rules/no-for-loops -- Notice diagnostics follow the mirror's skill inventory order.
  for (const skill of skills) {
    if (!retiredSkills.has(skill)) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Complete each notice check before advancing to the next skill.
      const file = await shippedFile(owners.get(skill) ?? "", ["LICENSE"]);
      // oxlint-disable-next-line eslint/no-await-in-loop -- An existing notice must match the mirror's bytes before checking the next skill.
      if (isEmpty(file) || (await readFile(file, "utf8")) !== license) {
        missing.push(`MIT notice: ${skill}`);
      }
    }
  }
  return missing;
};

/** @type {(checkout: string, candidate: string, base: string) => Promise<void>} */
const printChanges = async (checkout, candidate, base) => {
  if (!isEmpty(candidate)) {
    const revision = await queryGit(checkout, [
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${candidate}^{commit}`,
    ]);
    const resolved = revision.trim();
    process.stdout.write(`Upstream changes: ${base}..${resolved}\n`);
    process.stdout.write(
      await queryGit(checkout, [
        "diff",
        "--name-status",
        base,
        resolved,
        "--",
        "skills",
        "LICENSE",
      ]),
    );
  }
};

const [checkout = "", candidate = ""] = process.argv.slice(FIRST_ARGUMENT);
if (isEmpty(checkout) || process.argv.length > MAX_ARGUMENTS) {
  fail("Usage: node scripts/compare-pstack.mjs <mirror-checkout> [candidate-commit]");
}
const record = await readFile(path.join(ROOT, "docs/upstream-differences.md"), "utf8");
const base = /backnotprop\/pstack\/commit\/(?<sha>[0-9a-f]{40})/u.exec(record)?.groups?.sha ?? "";
if (isEmpty(base)) {
  fail("Missing pinned pstack mirror commit in the divergence record");
}
const retiredSkills = documentedNames(record, /^Retired upstream skill: `(?<name>[^`]+)`/gmu);
const retired = documentedNames(record, /^Retired upstream file: `(?<name>[^`]+)`/gmu);
const owners = await skillOwners(path.join(ROOT, "plugins"));
retiredSkills.forEach((skill) => {
  if (owners.has(skill)) {
    fail(`Retired upstream skill still shipped: ${skill}`);
  }
});

const tree = await queryGit(checkout, ["ls-tree", "-rz", base, "--", "skills"]);
const entries = tree
  .split("\0")
  .filter(Boolean)
  .map((row) => readEntry(row));
const { changed, identical, missing, removed, skills } = await compareFiles(entries, {
  owners,
  retired,
  retiredSkills,
});
const license = await queryGit(checkout, ["show", `${base}:LICENSE`]);
retiredSkills.forEach((skill) => {
  if (!skills.has(skill)) {
    fail(`Unknown retired upstream skill: ${skill}`);
  }
});
const missingFiles = [
  ...missing,
  ...(await missingNotices(skills, { owners, retired, retiredSkills }, license)),
];
missingFiles.forEach((file) => {
  process.stderr.write(`Missing: ${file}\n`);
});
if (retired.size) {
  fail(`Unknown retired paths: ${[...retired].join(", ")}`);
}
process.stdout.write(
  `${skills.size} upstream skills (${skills.size - retiredSkills.size} distributed, ${retiredSkills.size} retired): ${identical} unchanged files, ${changed} adapted, ${removed} individual files retired, ${missingFiles.length} missing files or notices.\n`,
);
await printChanges(checkout, candidate, base);
if (missingFiles.length) {
  process.exitCode = 1;
}
