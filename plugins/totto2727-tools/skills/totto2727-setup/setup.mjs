// oxlint-disable-next-line rules/no-node-imports -- Run the pinned Git and skills tools from the standalone setup CLI.
import { spawnSync } from "node:child_process";
// oxlint-disable-next-line rules/no-node-imports -- Manage skill files directly in the chosen standalone scope.
import { mkdir, realpath, rename, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Select the intended host home and a disposable repository directory.
import { homedir } from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Resolve management paths using the host's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Parse the public CLI options without requiring a package installation.
import { parseArgs } from "node:util";
import {
  entryStatus,
  exists,
  fingerprint,
  forEachInOrder,
  hasJsonProperties,
  isText,
  lockFields,
  present,
  readJson,
  requireThat,
  safeName,
  // oxlint-disable-next-line rules/consistent-import-extension -- The installed bootstrap runs its bundled JavaScript directly on Node.
} from "./setup-files.mjs";
// oxlint-disable-next-line rules/consistent-import-extension -- The installed bootstrap runs its bundled JavaScript directly on Node.
import { dependencies, ownNames, planGroups } from "./setup-plan.mjs";

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
const EMPTY = 0;
const INDENT = 2;
const GIT_COMMIT = /^[a-f0-9]{40}$/u;
const CONTENT_DIGEST = /^[a-f0-9]{64}$/u;

/** @typedef {{ hash: string | null, lock: unknown }} Ownership */
/** @typedef {{ owned: Partial<Record<string, Ownership>>, root: string, scope: string, version: number }} Receipt */
/** @typedef {import("./setup-plan.mjs").InstallGroup} InstallGroup */

/** @type {() => Promise<Record<string, unknown>>} */
const lock = async () => {
  const data = await readJson(lockPath, { skills: {} });
  requireThat(hasJsonProperties(data) && hasJsonProperties(data.skills), "Invalid skills lock.");
  return data.skills;
};
/** @type {(line: string) => void} */
const print = (line) => {
  process.stdout.write(`${line}\n`);
};

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
const readLedger = async () =>
  // oxlint-disable-next-line eslint/sort-keys -- Preserve a new receipt's existing serialized field order.
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
/** @type {(entries: Record<string, unknown>) => Promise<string[]>} */
const namesToRemove = async (entries) => {
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
      (isText(auxiliary) &&
        path.resolve(auxiliary) !== path.join(dest, name) &&
        (await present(auxiliary))) ||
      JSON.stringify(entries[name]) !== JSON.stringify(record?.lock) ||
      (await fingerprint(path.join(dest, name))) !== record?.hash
    ) {
      print(`Retained changed, missing, or shared skill: ${name}`);
      return;
    }
    names.push(name);
  });
  return names;
};

const uninstall = async function () {
  const names = await namesToRemove(await lock());
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
/** @type {(entry: InstallGroup) => Promise<void>} */
const installGroup = async ({ repo, pin, source, names }) => {
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
        ledger.owned[name] = { lock: entry, hash: await fingerprint(path.join(dest, name)) };
      }
    });
    await save();
  }
  requireThat(
    names.every((currentName) => Reflect.has(ledger.owned, currentName)),
    `Incomplete install from ${repo}. Inspect the output and receipt before retrying.`,
  );
};

const install = async function () {
  const before = await lock();
  const bootstrap = lockFields(before[self]);
  const ref = requestedRef ?? (bootstrap.source === firstParty ? bootstrap.commit : undefined);
  const own = await ownNames(ref, firstParty, git);
  const manifest = await dependencies();
  const groups = [
    own,
    ...manifest.filter((group) => values["required-only"] !== true || group.optional !== true),
  ];
  const plan = await planGroups(groups, { before, dest, keep, print });
  if (action === "plan") {
    return;
  }
  await forEachInOrder(plan, async (group) => installGroup(group));
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
    const operation = action === "uninstall" ? uninstall : install;
    await operation();
  } finally {
    await rm(mutex);
  }
}
