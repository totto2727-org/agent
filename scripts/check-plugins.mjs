import assert from "node:assert/strict";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

// Agent Plugins 1.0.0 manifest constraints, checked locally without schema fetching.
const schema = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const stringFields = [
  "$schema",
  "name",
  "version",
  "description",
  "homepage",
  "repository",
  "license",
];
const allowedFields = new Set([...stringFields, "author", "keywords", "extensions"]);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

async function contained(root, path) {
  const resolved = await realpath(path);
  const inside = relative(root, resolved);
  assert(!isAbsolute(inside) && inside !== ".." && !inside.startsWith("../"), path);
  return resolved;
}

for (const entry of await readdir("plugins", { withFileTypes: true })) {
  assert(entry.isDirectory(), `Unexpected plugin entry: ${entry.name}`);
  const root = await realpath(resolve("plugins", entry.name));
  const manifestPath = await contained(root, resolve(root, "plugin.json"));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert(isObject(manifest), `${entry.name}: manifest must be an object`);
  assert.equal(manifest.$schema, schema);
  assert.equal(manifest.name, entry.name);
  assert(manifest.name.length <= 64);
  assert(/^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(manifest.name));
  for (const [key, value] of Object.entries(manifest)) {
    assert(allowedFields.has(key), `${entry.name}: unknown manifest field ${key}`);
    if (stringFields.includes(key)) assert.equal(typeof value, "string", key);
  }
  if (manifest.author !== undefined) {
    assert(isObject(manifest.author));
    for (const [key, value] of Object.entries(manifest.author)) {
      assert(["name", "email", "url"].includes(key), key);
      assert.equal(typeof value, "string", key);
    }
  }
  if (manifest.keywords !== undefined) {
    assert(Array.isArray(manifest.keywords));
    assert(manifest.keywords.every((value) => typeof value === "string"));
  }
  if (manifest.extensions !== undefined) {
    assert(isObject(manifest.extensions));
    assert(Object.values(manifest.extensions).every(isObject));
  }

  // These packages distribute only the portable manifest and skills.
  assert.deepEqual((await readdir(root)).sort(), ["plugin.json", "skills"]);
  const skillsRoot = await contained(root, resolve(root, "skills"));
  let count = 0;
  for (const skill of await readdir(skillsRoot, { withFileTypes: true })) {
    assert(skill.isDirectory(), `${entry.name}: unexpected skills entry ${skill.name}`);
    const skillPath = await contained(root, resolve(skillsRoot, skill.name, "SKILL.md"));
    assert((await stat(skillPath)).isFile(), skillPath);
    count += 1;
  }
  assert(count > 0, `${entry.name}: no skills discovered`);
  console.log(`${entry.name}: valid standard manifest, ${count} immediate skills`);
}
