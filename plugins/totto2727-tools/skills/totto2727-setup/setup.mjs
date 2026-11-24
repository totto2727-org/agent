import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    scope: { type: "string" },
    ref: { type: "string" },
    agent: { type: "string", default: "universal" },
    "required-only": { type: "boolean" },
    keep: { type: "string", multiple: true, default: [] },
  },
});
const [action] = positionals;
const requireThat = function (ok, message) {
  if (!ok) {
    throw new Error(message);
  }
};
requireThat(
  positionals.length === 1 &&
    ["plan", "install", "uninstall"].includes(action) &&
    ["project", "global"].includes(values.scope),
  "Usage: setup.mjs plan|install|uninstall --scope project|global [--ref REF] [--agent universal|codex|jcode] [--required-only] [--keep NAME]",
);
requireThat(
  ["universal", "codex", "jcode"].includes(values.agent),
  "This setup manages the shared .agents/skills directory only.",
);
const global = values.scope === "global";
const root = realpathSync(global ? homedir() : process.cwd());
requireThat(
  global || root !== realpathSync(homedir()),
  "The home directory is not a project scope. Select a project root or pass --scope global.",
);
const metadata = join(root, ".agents");
const dest = join(metadata, "skills");
const lockPath = global ? join(metadata, ".skill-lock.json") : join(root, "skills-lock.json");
const journal = join(metadata, "totto2727-setup.json");
const firstParty = "totto2727-org/agent";
const self = "totto2727-setup";
const readJson = (file, fallback) =>
  existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback;
const lock = () => readJson(lockPath, { skills: {} }).skills;
const present = (p) => lstatSync(p, { throwIfNoEntry: false }) !== undefined;
const safeName = (n) => typeof n === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(n);
for (const p of [metadata, dest, lockPath, journal]) {
  requireThat(
    !present(p) || !lstatSync(p).isSymbolicLink(),
    `Refusing symlinked management path: ${p}`,
  );
}
const readLedger = () => readJson(journal, { version: 1, root, scope: values.scope, owned: {} });
const ledger = readLedger();
requireThat(
  ledger.version === 1 &&
    ledger.root === root &&
    ledger.scope === values.scope &&
    typeof ledger.owned === "object" &&
    ledger.owned !== null &&
    Object.entries(ledger.owned).every(
      ([name, record]) =>
        safeName(name) &&
        typeof record?.lock?.source === "string" &&
        /^[a-f0-9]{40}$/u.test(record.lock.commit) &&
        /^[a-f0-9]{64}$/u.test(record.hash),
    ),
  "Receipt is invalid or belongs to another scope.",
);
const save = () => {
  mkdirSync(metadata, { recursive: true });
  const p = `${journal}.tmp`;
  writeFileSync(p, `${JSON.stringify(ledger, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  renameSync(p, journal);
};
const run = function (command, args, quiet = false) {
  const r = spawnSync(command, args, {
    encoding: "utf8",
    stdio: quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],
  });
  if (r.error) {
    throw r.error;
  }
  requireThat(r.status === 0, `${command} ${args[0]} failed (${r.status}): ${r.stderr ?? ""}`);
  return r.stdout?.trim();
};
const cli = (args) =>
  run("vpx", [
    "skills@1.9.0",
    ...args,
    "--agent",
    values.agent === "codex" ? "codex" : "universal",
    "--yes",
    ...(global ? ["--global"] : []),
  ]);
const fingerprint = function (name) {
  const dir = join(dest, name);
  if (!present(dir) || !lstatSync(dir).isDirectory()) {
    return null;
  }
  const hash = createHash("sha256");
  const walk = function (p, rel) {
    for (const entry of readdirSync(p, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const f = join(p, entry.name);
      const key = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        hash.update(JSON.stringify([key, "directory"]));
        walk(f, key);
      } else if (entry.isFile()) {
        const data = readFileSync(f);
        hash.update(JSON.stringify([key, lstatSync(f).mode & 0o111, data.length]));
        hash.update(data);
      } else {
        hash.update(JSON.stringify([key, "non-regular"]));
      }
    }
  };
  walk(dir, "");
  return hash.digest("hex");
};
const uninstall = function () {
  const entries = lock();
  const names = [];
  for (const n of values.keep) {
    requireThat(
      safeName(n) && (ledger.owned[n] || present(join(dest, n))),
      `Unknown skill to keep: ${n}`,
    );
  }
  for (const [name, record] of Object.entries(ledger.owned)) {
    if (values.keep.includes(name) || name === "orca-cli" || name === "orchestration") {
      delete ledger.owned[name];
      console.log(`Released ownership: ${name}`);
      continue;
    }
    const auxiliary = global
      ? join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "agents", "skills", name)
      : null;
    if (
      (auxiliary && resolve(auxiliary) !== join(dest, name) && present(auxiliary)) ||
      JSON.stringify(entries[name]) !== JSON.stringify(record.lock) ||
      fingerprint(name) !== record.hash
    ) {
      console.log(`Retained changed, missing, or shared skill: ${name}`);
      continue;
    }
    names.push(name);
  }
  if (names.length) {
    cli(["remove", ...names]);
  }
  const after = lock();
  for (const currentName of names) {
    if (!present(join(dest, currentName)) && !after[currentName]) {
      delete ledger.owned[currentName];
    } else {
      console.log(`Retained by skills CLI: ${currentName}`);
    }
  }
  if (Object.keys(ledger.owned).length) {
    save();
  } else if (existsSync(journal)) {
    rmSync(journal);
  }
};
const ownNames = function (ref) {
  requireThat(
    typeof ref === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/u.test(ref),
    "Select a branch, tag, or commit with --ref, or install the bootstrap from a pinned source first.",
  );
  const dir = mkdtempSync(join(tmpdir(), "totto2727-setup-"));
  try {
    run("git", ["init", "-q", dir], true);
    run(
      "git",
      ["-C", dir, "fetch", "-q", "--depth=1", `https://github.com/${firstParty}.git`, ref],
      true,
    );
    const pin = run("git", ["-C", dir, "rev-parse", "FETCH_HEAD^{commit}"], true);
    const paths = run(
      "git",
      ["-C", dir, "ls-tree", "-r", "--name-only", pin, "--", "plugins"],
      true,
    ).split("\n");
    const names = paths.flatMap(
      (path) =>
        path.match(/^plugins\/totto2727-[^/]+\/skills\/([^/]+)\/SKILL\.md$/)?.slice(1) ?? [],
    );
    requireThat(
      names.length > 0 && names.every(safeName) && new Set(names).size === names.length,
      "Invalid first-party skill inventory.",
    );
    return { repo: firstParty, pin, names };
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
};
const install = function () {
  const before = lock();
  const bootstrap = before[self];
  const ref = values.ref ?? (bootstrap?.source === firstParty ? bootstrap.commit : undefined);
  const own = ownNames(ref);
  const manifest = JSON.parse(
    readFileSync(new URL("./dependencies.json", import.meta.url), "utf8"),
  );
  const groups = [own, ...manifest.groups.filter((g) => !values["required-only"] || !g.optional)];
  const seen = new Set();
  const plan = [];
  for (const { repo, pin, names } of groups) {
    requireThat(
      /^[\w.-]+\/[\w.-]+$/u.test(repo) && /^[a-f0-9]{40}$/u.test(pin),
      "Invalid source pin.",
    );
    const missing = [];
    for (const currentName of names) {
      requireThat(
        safeName(currentName) && !seen.has(currentName),
        `Invalid or duplicate skill: ${currentName}`,
      );
      seen.add(currentName);
      const entry = before[currentName];
      if (entry || present(join(dest, currentName))) {
        requireThat(
          present(join(dest, currentName, "SKILL.md")),
          `Incomplete existing install: ${currentName}. Resolve it before setup.`,
        );
        console.log(
          `Keep ${currentName} (${entry?.source ?? "untracked source"} @ ${entry?.commit ?? "unverified"})`,
        );
        if (entry?.source?.toLowerCase() !== repo.toLowerCase() || entry.commit !== pin) {
          requireThat(
            values.keep.includes(currentName),
            `Unverified source or different pin for ${currentName}. No replacement made. Inspect it, then pass --keep ${currentName} only if you accept the existing copy.`,
          );
        }
        continue;
      }
      missing.push(currentName);
    }
    console.log(`${repo}#${pin}: ${missing.length} to add`, missing.join(" "));
    plan.push({ repo, pin, source: `${repo}#${pin}`, names: missing });
  }
  if (action === "plan") {
    return;
  }
  for (const { repo, pin, source, names } of plan) {
    if (!names.length) {
      continue;
    }
    try {
      cli(["add", source, "--full-depth", "--copy", "--skill", ...names]);
    } finally {
      const entries = lock();
      for (const name of names) {
        const entry = entries[name];
        if (
          entry?.source?.toLowerCase() === repo.toLowerCase() &&
          entry.commit === pin &&
          existsSync(join(dest, name, "SKILL.md"))
        ) {
          ledger.owned[name] = { lock: entry, hash: fingerprint(name) };
        }
      }
      save();
    }
    requireThat(
      names.every((currentName) => ledger.owned[currentName]),
      `Incomplete install from ${repo}. Inspect the output and receipt before retrying.`,
    );
  }
};
if (action === "plan") {
  install();
} else if (action === "install" || existsSync(journal)) {
  mkdirSync(metadata, { recursive: true });
  const mutex = `${journal}.lock`;
  writeFileSync(mutex, String(process.pid), { flag: "wx", mode: 0o600 });
  try {
    requireThat(
      JSON.stringify(ledger) === JSON.stringify(readLedger()),
      "Receipt changed before acquisition. Retry with the current receipt.",
    );
    if (action === "uninstall") {
      uninstall();
    } else {
      install();
    }
  } finally {
    rmSync(mutex);
  }
}
