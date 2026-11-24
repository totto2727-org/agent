// oxlint-disable-next-line rules/no-node-imports -- Run the pinned Git and skills tools from the standalone setup CLI.
import { spawnSync } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Check ownership with the existing SHA-256 receipt format.
import { createHash } from "node:crypto";
// oxlint-disable-next-line rules/no-node-imports -- Manage skill files directly in the chosen standalone scope.
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Select the intended host home and a disposable repository directory.
import { homedir, tmpdir } from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Resolve management paths using the host's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Parse the public CLI options without requiring a package installation.
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    agent: { default: "universal", type: "string" },
    keep: { default: [], multiple: true, type: "string" },
    ref: { type: "string" },
    "required-only": { type: "boolean" },
    scope: { type: "string" },
  },
});
const [action] = positionals;
const { agent, keep, ref: requestedRef, scope } = values;
/** @type {(condition: unknown, message: string) => asserts condition} */
const requireThat = function (ok, message) {
  const accepted = Boolean(ok);
  if (!accepted) {
    // oxlint-disable-next-line rules/require-tagged-error -- Preserve native validation failures from the dependency-free CLI.
    throw new Error(message);
  }
};
const SINGLE_ACTION = 1;
requireThat(
  positionals.length === SINGLE_ACTION &&
    (action === "plan" || action === "install" || action === "uninstall") &&
    (scope === "project" || scope === "global"),
  "Usage: setup.mjs plan|install|uninstall --scope project|global [--ref REF] [--agent universal|codex|jcode] [--required-only] [--keep NAME]",
);
requireThat(
  ["universal", "codex", "jcode"].includes(agent),
  "This setup manages the shared .agents/skills directory only.",
);
const global = scope === "global";
const root = await realpath(global ? homedir() : process.cwd());
requireThat(
  global || root !== (await realpath(homedir())),
  "The home directory is not a project scope. Select a project root or pass --scope global.",
);
const metadata = path.join(root, ".agents");
const dest = path.join(metadata, "skills");
const lockPath = global
  ? path.join(metadata, ".skill-lock.json")
  : path.join(root, "skills-lock.json");
const journal = path.join(metadata, "totto2727-setup.json");
const firstParty = "totto2727-org/agent";
const self = "totto2727-setup";
const RECEIPT_VERSION = 1;
const PRIVATE_FILE_MODE = 0o600;
const EXECUTABLE_BITS = 0o111;
const EMPTY = 0;
const INDENT = 2;
const COMES_BEFORE = -1;
const COMES_AFTER = 1;
const GIT_COMMIT = /^[a-f0-9]{40}$/u;
const CONTENT_DIGEST = /^[a-f0-9]{64}$/u;
const HOST_REPOSITORY = /^[\w.-]+\/[\w.-]+$/u;

/** @typedef {{ commit: string | undefined, source: string | undefined }} LockFields */
/** @typedef {{ hash: string | null, lock: unknown }} Ownership */
/** @typedef {{ owned: Partial<Record<string, Ownership>>, root: string, scope: string, version: number }} Receipt */
/** @typedef {{ names: string[], optional?: boolean, pin: string, repo: string }} DependencyGroup */
/** @typedef {{ names: string[], pin: string, repo: string, source: string }} InstallGroup */

/** @type {(value: unknown) => value is Record<string, unknown>} */
// oxlint-disable-next-line rules/force-predicate -- The standalone CLI narrows parsed JSON without repository dependencies.
const hasJsonProperties = (value) => value !== null && typeof value === "object";

/** @type {(value: unknown) => value is string} */
// oxlint-disable-next-line rules/force-predicate -- Confirm a JSON string without loading a package in the bootstrap.
const isText = (value) => typeof value === "string";

/** @type {(value: unknown) => LockFields} */
const lockFields = (value) => {
  if (!hasJsonProperties(value)) {
    return { commit: undefined, source: undefined };
  }
  const { commit, source } = value;
  return {
    commit: isText(commit) ? commit : undefined,
    source: isText(source) ? source : undefined,
  };
};

/** @type {(file: string) => Promise<boolean>} */
const exists = async (file) => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};
/** @type {(file: string) => Promise<import("node:fs").Stats | undefined>} */
const entryStatus = async (file) => {
  try {
    return await lstat(file);
  } catch (error) {
    /** @type {unknown} */
    const code = Object.getOwnPropertyDescriptor(error ?? {}, "code")?.value;
    if (code !== "ENOENT") {
      throw error;
    }
    // oxlint-disable-next-line typescript/consistent-return -- An absent path has no native filesystem status.
    return;
  }
};
/** @type {(file: string, fallback: unknown) => Promise<unknown>} */
const readJson = async (file, fallback) => {
  if (!(await exists(file))) {
    return fallback;
  }
  /** @type {unknown} */
  const parsed = JSON.parse(await readFile(file, "utf8"));
  return parsed;
};
/** @type {() => Promise<Record<string, unknown>>} */
const lock = async () => {
  const data = await readJson(lockPath, { skills: {} });
  requireThat(hasJsonProperties(data) && hasJsonProperties(data.skills), "Invalid skills lock.");
  return data.skills;
};
/** @type {(file: string) => Promise<boolean>} */
const present = async (file) => Boolean(await entryStatus(file));

/**
 * @template Item
 * @param {Iterable<Item>} items - The items in receipt or dependency order.
 * @param {(item: Item) => Promise<void>} step - The operation to finish before advancing.
 * @returns {Promise<void>} Completion of the ordered steps.
 */
const forEachInOrder = async (items, step) => {
  // oxlint-disable-next-line rules/no-for-loops -- The native installer advances after each ordered dependency or receipt operation.
  for (const item of items) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Later operations depend on earlier filesystem state and error order.
    await step(item);
  }
};

/** @type {(line: string) => void} */
const print = (line) => {
  process.stdout.write(`${line}\n`);
};

/** @type {(name: unknown) => boolean} */
const safeName = (name) => isText(name) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name);
/** @type {(value: unknown) => value is Ownership} */
const ownership = (value) => {
  if (!hasJsonProperties(value)) {
    return false;
  }
  const { commit, source } = lockFields(value.lock);
  return (
    isText(source) &&
    isText(commit) &&
    GIT_COMMIT.test(commit) &&
    isText(value.hash) &&
    CONTENT_DIGEST.test(value.hash)
  );
};

/** @type {(value: unknown) => value is Receipt} */
const isReceipt = (value) =>
  hasJsonProperties(value) &&
  value.version === RECEIPT_VERSION &&
  value.root === root &&
  value.scope === scope &&
  hasJsonProperties(value.owned) &&
  Object.entries(value.owned).every(([name, record]) => safeName(name) && ownership(record));

await forEachInOrder([metadata, dest, lockPath, journal], async (file) => {
  const status = await entryStatus(file);
  requireThat(status?.isSymbolicLink() !== true, `Refusing symlinked management path: ${file}`);
});
// oxlint-disable-next-line eslint/sort-keys -- Preserve the receipt's existing serialized field order.
const readLedger = async () =>
  readJson(journal, { version: RECEIPT_VERSION, root, scope, owned: {} });
const ledger = await readLedger();
requireThat(isReceipt(ledger), "Receipt is invalid or belongs to another scope.");
const save = async () => {
  await mkdir(metadata, { recursive: true });
  const temporaryReceipt = `${journal}.tmp`;
  // oxlint-disable-next-line unicorn/no-null -- JSON.stringify expects null for its empty replacer when specifying indentation.
  const json = JSON.stringify(ledger, null, INDENT);
  await writeFile(temporaryReceipt, `${json}\n`, { flag: "wx", mode: PRIVATE_FILE_MODE });
  await rename(temporaryReceipt, journal);
};
const PROCESS_SUCCESS = 0;
/** @type {(command: string, args: string[], quiet?: boolean) => string | undefined} */
const run = function (command, args, quiet = false) {
  /** @type {{ status: number | null, stdout: string | null, stderr: string | null, error?: Error }} */
  // oxlint-disable-next-line node/no-sync -- Preserve the CLI's native subprocess status, inherited terminal, and spawnSync startup errors.
  const child = spawnSync(command, args, {
    encoding: "utf8",
    stdio: quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],
  });
  if (child.error) {
    throw child.error;
  }
  const [operation = ""] = args;
  requireThat(
    child.status === PROCESS_SUCCESS,
    `${command} ${operation} failed (${String(child.status)}): ${child.stderr ?? ""}`,
  );
  return child.stdout?.trim();
};
/** @type {(...args: string[]) => string} */
const git = (...args) => run("git", args, true) ?? "";

/** @type {(args: string[]) => void} */
const cli = (args) => {
  run("vpx", [
    "skills@1.9.0",
    ...args,
    "--agent",
    agent === "codex" ? "codex" : "universal",
    "--yes",
    ...(global ? ["--global"] : []),
  ]);
};
/** @type {(name: string) => Promise<string | null>} */
const fingerprint = async function (name) {
  const dir = path.join(dest, name);
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
const uninstall = async function () {
  const entries = await lock();
  /** @type {string[]} */
  const names = [];
  await forEachInOrder(keep, async (name) => {
    requireThat(
      safeName(name) && (Reflect.has(ledger.owned, name) || (await present(path.join(dest, name)))),
      `Unknown skill to keep: ${name}`,
    );
  });
  await forEachInOrder(Object.entries(ledger.owned), async ([name, record]) => {
    if (keep.includes(name) || name === "orca-cli" || name === "orchestration") {
      Reflect.deleteProperty(ledger.owned, name);
      print(`Released ownership: ${name}`);
      return;
    }
    // oxlint-disable-next-line node/no-process-env -- The standalone CLI respects the host's XDG configuration directory.
    const configuredHome = global ? process.env.XDG_CONFIG_HOME : undefined;
    const auxiliary = global
      ? path.join(
          isText(configuredHome) && configuredHome.length > EMPTY
            ? configuredHome
            : path.join(homedir(), ".config"),
          "agents",
          "skills",
          name,
        )
      : undefined;
    if (
      (auxiliary !== undefined &&
        path.resolve(auxiliary) !== path.join(dest, name) &&
        (await present(auxiliary))) ||
      JSON.stringify(entries[name]) !== JSON.stringify(record?.lock) ||
      (await fingerprint(name)) !== record?.hash
    ) {
      print(`Retained changed, missing, or shared skill: ${name}`);
      return;
    }
    names.push(name);
  });
  if (names.length) {
    cli(["remove", ...names]);
  }
  const after = await lock();
  await forEachInOrder(names, async (currentName) => {
    const entryRemains = Boolean(after[currentName]);
    if (!(await present(path.join(dest, currentName))) && !entryRemains) {
      Reflect.deleteProperty(ledger.owned, currentName);
    } else {
      print(`Retained by skills CLI: ${currentName}`);
    }
  });
  if (Object.keys(ledger.owned).length > EMPTY) {
    await save();
  } else if (await exists(journal)) {
    await rm(journal);
  }
};
/** @type {(ref: string | undefined) => Promise<DependencyGroup>} */
const ownNames = async function (ref) {
  requireThat(
    isText(ref) && /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/u.test(ref),
    "Select a branch, tag, or commit with --ref, or install the bootstrap from a pinned source first.",
  );
  const dir = await mkdtemp(path.join(tmpdir(), "totto2727-setup-"));
  try {
    git("init", "-q", dir);
    git("-C", dir, "fetch", "-q", "--depth=1", `https://github.com/${firstParty}.git`, ref);
    const pin = git("-C", dir, "rev-parse", "FETCH_HEAD^{commit}");
    const paths = git("-C", dir, "ls-tree", "-r", "--name-only", pin, "--", "plugins").split("\n");
    const names = paths.flatMap((file) => {
      const name = /^plugins\/totto2727-[^/]+\/skills\/(?<name>[^/]+)\/SKILL\.md$/u.exec(file)
        ?.groups?.name;
      return isText(name) ? [name] : [];
    });
    requireThat(
      names.length > EMPTY &&
        names.every((name) => safeName(name)) &&
        new Set(names).size === names.length,
      "Invalid first-party skill inventory.",
    );
    return { names, pin, repo: firstParty };
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
};
/** @type {(value: unknown) => value is DependencyGroup} */
const dependencyGroup = (value) =>
  hasJsonProperties(value) &&
  isText(value.repo) &&
  isText(value.pin) &&
  Array.isArray(value.names) &&
  value.names.every((name) => isText(name)) &&
  (!("optional" in value) || value.optional === true || value.optional === false);

/** @type {() => Promise<DependencyGroup[]>} */
const dependencies = async () => {
  /** @type {unknown} */
  const manifest = JSON.parse(
    await readFile(new URL("dependencies.json", import.meta.url), "utf8"),
  );
  requireThat(hasJsonProperties(manifest), "Invalid dependency manifest.");
  const { groups } = manifest;
  requireThat(Array.isArray(groups), "Invalid dependency manifest.");
  /** @type {unknown[]} */
  const entries = groups;
  requireThat(
    entries.every((group) => dependencyGroup(group)),
    "Invalid dependency manifest.",
  );
  return entries;
};

const install = async function () {
  const before = await lock();
  const bootstrap = lockFields(before[self]);
  const ref = requestedRef ?? (bootstrap.source === firstParty ? bootstrap.commit : undefined);
  const own = await ownNames(ref);
  const manifest = await dependencies();
  const groups = [
    own,
    ...manifest.filter((group) => values["required-only"] !== true || group.optional !== true),
  ];
  const seen = new Set();
  /** @type {InstallGroup[]} */
  const plan = [];
  await forEachInOrder(groups, async ({ repo, pin, names }) => {
    requireThat(HOST_REPOSITORY.test(repo) && GIT_COMMIT.test(pin), "Invalid source pin.");
    /** @type {string[]} */
    const missing = [];
    await forEachInOrder(names, async (currentName) => {
      requireThat(
        safeName(currentName) && !seen.has(currentName),
        `Invalid or duplicate skill: ${currentName}`,
      );
      seen.add(currentName);
      const entry = before[currentName];
      const existing = Boolean(entry);
      if (existing || (await present(path.join(dest, currentName)))) {
        const currentPin = lockFields(entry);
        requireThat(
          await present(path.join(dest, currentName, "SKILL.md")),
          `Incomplete existing install: ${currentName}. Resolve it before setup.`,
        );
        print(
          `Keep ${currentName} (${currentPin.source ?? "untracked source"} @ ${currentPin.commit ?? "unverified"})`,
        );
        if (currentPin.source?.toLowerCase() !== repo.toLowerCase() || currentPin.commit !== pin) {
          requireThat(
            keep.includes(currentName),
            `Unverified source or different pin for ${currentName}. No replacement made. Inspect it, then pass --keep ${currentName} only if you accept the existing copy.`,
          );
        }
        return;
      }
      missing.push(currentName);
    });
    print(`${repo}#${pin}: ${missing.length} to add ${missing.join(" ")}`);
    plan.push({ names: missing, pin, repo, source: `${repo}#${pin}` });
  });
  if (action === "plan") {
    return;
  }
  await forEachInOrder(plan, async ({ repo, pin, source, names }) => {
    if (names.length === EMPTY) {
      return;
    }
    try {
      cli(["add", source, "--full-depth", "--copy", "--skill", ...names]);
    } finally {
      const entries = await lock();
      await forEachInOrder(names, async (name) => {
        const entry = entries[name];
        const installed = lockFields(entry);
        if (
          installed.source?.toLowerCase() === repo.toLowerCase() &&
          installed.commit === pin &&
          (await exists(path.join(dest, name, "SKILL.md")))
        ) {
          // oxlint-disable-next-line eslint/sort-keys -- Preserve each ownership record's key order in existing receipts.
          ledger.owned[name] = { lock: entry, hash: await fingerprint(name) };
        }
      });
      await save();
    }
    requireThat(
      names.every((currentName) => Reflect.has(ledger.owned, currentName)),
      `Incomplete install from ${repo}. Inspect the output and receipt before retrying.`,
    );
  });
};
if (action === "plan") {
  await install();
} else if (action === "install" || (await exists(journal))) {
  await mkdir(metadata, { recursive: true });
  const mutex = `${journal}.lock`;
  await writeFile(mutex, String(process.pid), { flag: "wx", mode: PRIVATE_FILE_MODE });
  try {
    requireThat(
      JSON.stringify(ledger) === JSON.stringify(await readLedger()),
      "Receipt changed before acquisition. Retry with the current receipt.",
    );
    if (action === "uninstall") {
      await uninstall();
    } else {
      await install();
    }
  } finally {
    await rm(mutex);
  }
}
