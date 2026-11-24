import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const [checkout, candidate] = process.argv.slice(2);
if (!checkout || process.argv.length > 4)
  throw new Error("Usage: node scripts/compare-pstack.mjs <mirror-checkout> [candidate-commit]");
const record = readFileSync(join(root, "docs/upstream-differences.md"), "utf8");
const base = record.match(/backnotprop\/pstack\/commit\/([0-9a-f]{40})/u)?.[1];
if (!base) throw new Error("Missing pinned pstack mirror commit in the divergence record");
function git(...args) {
  return execFileSync("git", ["-C", checkout, ...args], { encoding: "utf8" });
}
const owners = new Map();
const renamed = new Map(
  Array.from(
    record.matchAll(/^Renamed upstream skill: `([^`]+)` → `([^`]+)`/gmu),
    ([, original, local]) => [original, local],
  ),
);
for (const pkg of readdirSync(join(root, "plugins"))) {
  const dir = join(root, "plugins", pkg, "skills");
  if (!existsSync(dir)) continue;
  for (const skill of readdirSync(dir)) {
    if (owners.has(skill)) throw new Error(`Ambiguous skill name: ${skill}`);
    owners.set(skill, join(dir, skill));
  }
}
let identical = 0;
for (const original of renamed.keys()) {
  if (owners.has(original))
    throw new Error(`Renamed upstream skill still shipped as an alias: ${original}`);
}
const localOwner = (original) => owners.get(renamed.get(original) ?? original);
let changed = 0;
const missing = [];
const retired = new Set(
  Array.from(record.matchAll(/^Retired upstream file: `([^`]+)`/gmu), (match) => match[1]),
);
let removed = 0;
const skills = new Set();
for (const row of git("ls-tree", "-rz", base, "--", "skills").split("\0").filter(Boolean)) {
  const [header, path] = row.split("\t");
  const [mode, , blob] = header.split(" ");
  const [, skill, ...tail] = path.split("/");
  skills.add(skill);
  const dir = localOwner(skill);
  const file = dir && join(dir, ...tail);
  if (retired.delete(path)) {
    if (file && existsSync(file)) throw new Error(`Documented retirement still shipped: ${path}`);
    removed++;
    continue;
  }
  if (!file || !existsSync(file)) {
    missing.push(path);
    continue;
  }
  const bytes = readFileSync(file);
  const hash = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  const executable = Boolean(statSync(file).mode & 0o111);
  if (hash === blob && executable === (mode === "100755")) identical++;
  else {
    changed++;
    console.log(`Adapted: ${path}`);
  }
}
const license = git("show", `${base}:LICENSE`);
for (const original of renamed.keys()) {
  if (!skills.has(original)) throw new Error(`Unknown renamed upstream skill: ${original}`);
}
for (const skill of skills) {
  const dir = localOwner(skill);
  const file = dir && join(dir, "LICENSE");
  if (!file || !existsSync(file) || readFileSync(file, "utf8") !== license)
    missing.push(`MIT notice: ${skill}`);
}
for (const path of missing) console.error(`Missing: ${path}`);
if (retired.size) throw new Error(`Unknown retired paths: ${[...retired].join(", ")}`);
console.log(
  `${skills.size} upstream skills: ${identical} unchanged files, ${changed} adapted, ${removed} retired, ${missing.length} missing files or notices.`,
);
if (candidate) {
  const rev = git("rev-parse", "--verify", "--end-of-options", `${candidate}^{commit}`).trim();
  console.log(`Upstream changes: ${base}..${rev}`);
  process.stdout.write(git("diff", "--name-status", base, rev, "--", "skills", "LICENSE"));
}
if (missing.length) process.exitCode = 1;
