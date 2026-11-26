// oxlint-disable-next-line rules/no-node-imports -- Stage source metadata in an isolated native Git directory.
import { mkdtemp, readFile, rm } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Select the host's disposable Git directory.
import { tmpdir } from "node:os";
// oxlint-disable-next-line rules/no-node-imports -- Read the installed skill paths in the native project scope.
import path from "node:path";
import {
  forEachInOrder,
  hasJsonProperties,
  isText,
  lockFields,
  present,
  requireThat,
  safeName,
  // oxlint-disable-next-line rules/consistent-import-extension -- The installed bootstrap runs its bundled JavaScript directly on Node.
} from "./setup-files.mjs";

const EMPTY = 0;
const GIT_COMMIT = /^[a-f0-9]{40}$/u;
const HOST_REPOSITORY = /^[\w.-]+\/[\w.-]+$/u;

/** @typedef {{ names: string[], optional?: boolean, pin: string, repo: string }} DependencyGroup */
/** @typedef {{ names: string[], pin: string, repo: string, source: string }} InstallGroup */
/** @typedef {{ before: Record<string, unknown>, dest: string, keep: string[], print: (line: string) => void }} PlanningState */

/** @type {(paths: string[]) => string[]} */
const skillNames = (paths) => {
  const names = paths.flatMap((file) => {
    const name = /^plugins\/totto2727-[^/]+\/skills\/(?<name>[^/]+)\/SKILL\.md$/u.exec(file)?.groups
      ?.name;
    return isText(name) ? [name] : [];
  });
  requireThat(
    names.length > EMPTY &&
      names.every((name) => safeName(name)) &&
      new Set(names).size === names.length,
    "Invalid first-party skill inventory.",
  );
  return names;
};

/** @type {(ref: string | undefined, firstParty: string, git: (...args: string[]) => string) => Promise<DependencyGroup>} */
export const ownNames = async function (ref, firstParty, git) {
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
    return { names: skillNames(paths), pin, repo: firstParty };
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
export const dependencies = async () => {
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

/** @type {(currentName: string, group: DependencyGroup, context: PlanningState) => Promise<boolean>} */
const needsInstall = async (currentName, { repo, pin }, { before, dest, keep, print }) => {
  const entry = before[currentName];
  const existing = Boolean(entry);
  if (!existing && !(await present(path.join(dest, currentName)))) {
    return true;
  }
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
  return false;
};

/** @type {(group: DependencyGroup, seen: Set<string>, context: PlanningState) => Promise<InstallGroup>} */
const planGroup = async (group, seen, context) => {
  const { repo, pin, names } = group;
  requireThat(HOST_REPOSITORY.test(repo) && GIT_COMMIT.test(pin), "Invalid source pin.");
  /** @type {string[]} */
  const missing = [];
  await forEachInOrder(names, async (currentName) => {
    requireThat(
      safeName(currentName) && !seen.has(currentName),
      `Invalid or duplicate skill: ${currentName}`,
    );
    seen.add(currentName);
    if (await needsInstall(currentName, group, context)) {
      missing.push(currentName);
    }
  });
  context.print(`${repo}#${pin}: ${missing.length} to add ${missing.join(" ")}`);
  return { names: missing, pin, repo, source: `${repo}#${pin}` };
};

/** @type {(groups: DependencyGroup[], context: PlanningState) => Promise<InstallGroup[]>} */
export const planGroups = async (groups, context) => {
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {InstallGroup[]} */
  const plan = [];
  await forEachInOrder(groups, async (group) => {
    plan.push(await planGroup(group, seen, context));
  });
  return plan;
};
