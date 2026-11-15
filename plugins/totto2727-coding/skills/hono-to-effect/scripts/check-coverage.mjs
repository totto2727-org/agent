import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const baseline = "f6fbaf0299c48eea9e656e03e2ffe7ac755e8823";
const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readRows(markdown) {
  return markdown
    .split("\n")
    .filter((line) => /^\|\s*`hono(?:`|\/)/u.test(line))
    .map((line) => {
      const columns = line
        .split("|")
        .slice(1, -1)
        .map((value) => value.trim());
      assert.equal(columns.length, 4, `Expected four columns: ${line}`);
      assert.ok(columns.every(Boolean), `Empty column: ${line}`);
      const path = columns[0].match(/^`([^`]+)`$/u)?.[1];
      assert.ok(path, `Invalid import path: ${columns[0]}`);
      return { path, owner: columns[1], how: columns[2], recipe: columns[3] };
    });
}

function assertInventory(expected, rows, label) {
  const actual = rows.map((row) => row.path);
  assert.equal(new Set(actual).size, actual.length, `${label}: duplicate paths`);
  const missing = expected.filter((path) => !actual.includes(path));
  const extra = actual.filter((path) => !expected.includes(path));
  assert.deepEqual({ missing, extra }, { missing: [], extra: [] }, label);
}

function assertLinks(file) {
  const markdown = readFileSync(file, "utf8");
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/gu)) {
    const href = match[1];
    if (/^https?:\/\//u.test(href)) continue;
    const [path, fragment] = href.split("#");
    const target = path ? resolve(dirname(file), path) : file;
    assert.ok(target.startsWith(skillRoot + sep), `Link leaves skill: ${href}`);
    assert.ok(existsSync(target), `Missing local link from ${file}: ${href}`);
    if (fragment) {
      const anchors = [...readFileSync(target, "utf8").matchAll(/^#{1,6}\s+(.+)$/gmu)].map(
        (heading) =>
          heading[1]
            .replace(/`/gu, "")
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s_-]/gu, "")
            .replace(/\s/gu, "-"),
      );
      assert.ok(anchors.includes(fragment), `Missing anchor from ${file}: ${href}`);
    }
  }
}

function main() {
  const { values } = parseArgs({
    options: {
      "hono-root": { type: "string" },
      compatibility: { type: "string" },
    },
  });
  assert.ok(
    values["hono-root"] && values.compatibility,
    "Usage: node check-coverage.mjs --hono-root <pinned-checkout> --compatibility <hono-compatibility.md>",
  );
  const honoRoot = resolve(values["hono-root"]);
  assert.equal(
    execFileSync("git", ["-C", honoRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    baseline,
    "Hono checkout does not match the pinned baseline",
  );
  assert.equal(
    execFileSync(
      "git",
      ["-C", honoRoot, "status", "--porcelain", "--", "package.json", "vite.config.ts", "src"],
      { encoding: "utf8" },
    ).trim(),
    "",
    "Hono baseline source is dirty",
  );
  const manifest = JSON.parse(readFileSync(join(honoRoot, "package.json"), "utf8"));
  const build = readFileSync(join(honoRoot, "vite.config.ts"), "utf8");
  assert.match(build, /src\/\*\*\/\*\.ts/u);
  assert.match(build, /!src\/\*\*\/\*\.test\.ts/u);
  assert.match(build, /!src\/\*\*\/\*\.test\.tsx/u);
  assert.match(build, /unbundle:\s*true/u);
  const exports = Object.keys(manifest.exports);
  assert.deepEqual(
    exports.filter((key) => key.includes("*")),
    ["./utils/*"],
  );
  const fixed = exports.filter((key) => !key.includes("*"));
  for (const key of fixed) {
    const source = manifest.exports[key].import
      .replace(/^\.\/dist\//u, "src/")
      .replace(/\.js$/u, ".ts");
    assert.ok(existsSync(join(honoRoot, source)), `Missing export source: ${key}`);
  }
  const utilsRoot = join(honoRoot, "src/utils");
  const wildcard = readdirSync(utilsRoot, { recursive: true, withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts"),
    )
    .map((entry) => relative(utilsRoot, join(entry.parentPath, entry.name)).split(sep).join("/"))
    .map((path) => `hono/utils/${path.replace(/\.ts$/u, "")}`);
  const expected = [
    ...fixed.map((key) => (key === "." ? "hono" : `hono/${key.slice(2)}`)),
    ...wildcard,
  ].sort();
  assert.equal(fixed.length, 76);
  assert.equal(wildcard.length, 28);
  assert.equal(new Set(expected).size, 104);

  const rows = readRows(readFileSync(join(skillRoot, "references/import-paths.md"), "utf8"));
  const compatibility = readRows(readFileSync(resolve(values.compatibility), "utf8"));
  assertInventory(expected, rows, "Skill inventory");
  assertInventory(expected, compatibility, "Compatibility inventory");
  const owners = new Map([
    ["Effect を利用", "Effect"],
    ["effront を利用", "effront"],
    ["追加", "effect-http"],
    ["対象外", "Excluded"],
  ]);
  const classifications = new Map(compatibility.map((row) => [row.path, owners.get(row.owner)]));
  const totals = { Effect: 0, effront: 0, "effect-http": 0, Excluded: 0 };
  for (const row of rows) {
    assert.equal(row.owner, classifications.get(row.path), `Changed classification: ${row.path}`);
    assert.ok(row.how.length >= 40, `Missing concrete guidance or reason: ${row.path}`);
    totals[row.owner]++;
    if (row.owner !== "Excluded") {
      assert.match(
        row.recipe,
        /^\[[^\]]+\]\([a-z-]+\.md(?:#[a-z-]+)?\)$/u,
        `Missing local recipe for ${row.path}`,
      );
    } else {
      assert.equal(
        row.recipe,
        "Not applicable",
        `Excluded path needs an explicit disposition: ${row.path}`,
      );
    }
  }
  assert.deepEqual(totals, { Effect: 54, effront: 21, "effect-http": 6, Excluded: 23 });
  for (const file of [
    join(skillRoot, "SKILL.md"),
    ...readdirSync(join(skillRoot, "references"))
      .filter((name) => name.endsWith(".md"))
      .map((name) => join(skillRoot, "references", name)),
  ]) {
    assertLinks(file);
  }
  console.log(
    JSON.stringify(
      {
        baseline,
        fixed: fixed.length,
        wildcard: wildcard.length,
        total: rows.length,
        actionable: rows.length - totals.Excluded,
        totals,
        missing: [],
        extra: [],
        duplicates: [],
        localLinks: "pass",
        classifications: "pass",
        scope: "Inventory and local reference checks, not proof of runtime parity for every API",
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
