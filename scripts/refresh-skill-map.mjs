import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (file) => readFileSync(join(root, file), "utf8");
const packages = readdirSync(join(root, "plugins"))
  .filter((pkg) => existsSync(join(root, "plugins", pkg, "plugin.json")))
  .sort();
const locations = new Map();
for (const pkg of packages) {
  const dir = `plugins/${pkg}/skills`;
  for (const skill of readdirSync(join(root, dir)).sort()) {
    if (locations.has(skill)) throw new Error(`Duplicate skill: ${skill}`);
    locations.set(skill, `${dir}/${skill}`);
  }
}
function references(skill, path) {
  const targets = new Set();
  for (const f of readdirSync(join(root, path), { recursive: true })) {
    if (!f.endsWith(".md") || f.startsWith("scripts/")) continue;
    const text = read(`${path}/${f}`)
      .replace(/^---\n[\s\S]*?\n---\n/u, "")
      .replace(/^\s*```[^\n]*\n[\s\S]*?^\s*```[^\n]*$/gmu, "");
    for (const [, href] of text.matchAll(/\]\((\.\.\/[^\s)]+)\)/gu)) {
      const [target, ...rest] = posix
        .normalize(posix.join(skill, dirname(f), href.split("#")[0]))
        .split("/");
      if (!locations.has(target) || skill === target) continue;
      if (!existsSync(join(root, locations.get(target), ...rest)))
        throw new Error(`${path}/${f}: missing target ${href}`);
      targets.add(target);
    }
    for (const match of text.matchAll(/(?:\*\*|`|\[)\/?([a-z][a-z0-9-]+)(?:\*\*|`|\])/gu)) {
      if (locations.has(match[1]) && match[1] !== skill) targets.add(match[1]);
    }
  }
  return [...targets].sort();
}
const sections = packages.map((pkg) => {
  const folder = `plugins/${pkg}`;
  const desc = JSON.parse(read(`${folder}/plugin.json`)).description;
  const rows = [...locations]
    .filter(([, path]) => path.startsWith(folder + "/"))
    .map(([name, path]) => {
      const refs = references(name, path);
      return `| [${name}](${path}/SKILL.md) | ${refs.map((ref) => "`" + ref + "`").join(", ") || "None"} |`;
    });
  return `### [${pkg}](${folder}/plugin.json)\n\n${desc}\n\n| Skill | Refers to |\n| --- | --- |\n${rows.join("\n")}`;
});
const file = join(root, "README.md");
const doc = readFileSync(file, "utf8");
const first = doc.indexOf("### [totto2727-");
const end = doc.indexOf("## Development and license", first);
if (first < 0 || end < 0) throw new Error("Missing README map boundaries");
writeFileSync(file, doc.slice(0, first) + sections.join("\n\n") + "\n\n" + doc.slice(end));
console.log(`Mapped ${locations.size} skills in ${packages.length} plugins.`);
