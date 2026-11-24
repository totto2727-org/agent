import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const baseline = "f6fbaf0299c48eea9e656e03e2ffe7ac755e8823";
const libraryRecipes = new Map([
  ["effront", "skills/effront/references/hono-migration.md"],
  ["effect-http", ".agents/skills/effect-http/references/standalone-policies.md"],
]);
const guideRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../references/knowledge/hono-to-effect",
);

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

function assertLinks(file, externalContent) {
  const markdown = readFileSync(file, "utf8");
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/gu)) {
    const href = match[1];
    const [path, fragment] = href.split("#");
    let content;
    if (externalContent.has(path)) {
      content = externalContent.get(path);
    } else {
      if (/^https?:\/\//u.test(href)) continue;
      const target = path ? resolve(dirname(file), path) : file;
      assert.ok(target.startsWith(guideRoot + sep), `Link leaves Hono guide: ${href}`);
      assert.ok(existsSync(target), `Missing local link from ${file}: ${href}`);
      if (fragment) content = readFileSync(target, "utf8");
    }
    if (fragment) {
      const anchors = [...content.matchAll(/^#{1,6}\s+(.+)$/gmu)].map((heading) =>
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
      "effront-root": { type: "string" },
      "effect-http-root": { type: "string" },
    },
  });
  assert.ok(
    values["hono-root"] && values["effect-http-root"] && values["effront-root"],
    "Usage: node check-hono-coverage.mjs --hono-root <pinned-checkout> --effect-http-root <effect-http-checkout> --effront-root <effront-checkout>",
  );
  const readLibraryFile = (owner, path) =>
    execFileSync("git", ["-C", resolve(values[`${owner}-root`]), "show", `HEAD:${path}`], {
      encoding: "utf8",
    });
  const recipeUrls = new Map();
  const externalContent = new Map();
  for (const [owner, path] of libraryRecipes) {
    const url = `https://github.com/totto2727-org/${owner}/blob/main/${path}`;
    recipeUrls.set(owner, url);
    externalContent.set(url, readLibraryFile(owner, path));
  }
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

  const rows = readRows(readFileSync(join(guideRoot, "import-paths.md"), "utf8"));
  const compatibility = readRows(readLibraryFile("effect-http", "docs/hono-compatibility.md"));
  assertInventory(expected, rows, "Hono guide inventory");
  assertInventory(expected, compatibility, "Compatibility inventory");
  const owners = new Map([
    ["Use Effect", "Effect"],
    ["Use effront", "effront"],
    ["Add", "effect-http"],
    ["Out of scope", "Excluded"],
  ]);
  const classifications = new Map(compatibility.map((row) => [row.path, owners.get(row.owner)]));
  const totals = { Effect: 0, effront: 0, "effect-http": 0, Excluded: 0 };
  for (const row of rows) {
    assert.equal(row.owner, classifications.get(row.path), `Changed classification: ${row.path}`);
    assert.ok(row.how.length >= 40, `Missing concrete guidance or reason: ${row.path}`);
    totals[row.owner]++;
    if (recipeUrls.has(row.owner)) {
      const href = row.recipe.match(/^\[[^\]]+\]\(([^)]+)#[a-z-]+\)$/u)?.[1];
      assert.equal(
        href,
        recipeUrls.get(row.owner),
        `Missing canonical ${row.owner} recipe for ${row.path}`,
      );
    } else if (row.owner !== "Excluded") {
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
  for (const name of readdirSync(guideRoot).filter((name) => name.endsWith(".md"))) {
    assertLinks(join(guideRoot, name), externalContent);
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
        libraryRecipeLinks: "pass",
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
