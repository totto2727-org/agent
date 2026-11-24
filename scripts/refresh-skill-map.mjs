import { Predicate, String } from "effect";

// oxlint-disable-next-line rules/no-node-imports -- The maintenance CLI reads and writes files in the local checkout.
import { access, readFile, readdir, writeFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Link targets use POSIX paths while checkout paths use the host filesystem.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- The checkout is located relative to this module's file URL.
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const firstCharacter = 0;
const missingIndex = -1;
const sortsBefore = -1;

/** @type {(left: string, right: string) => number} */
const compareText = (left, right) => (left < right ? sortsBefore : Number(left > right));

/** @type {(file: string) => Promise<string>} */
const read = async (file) => readFile(path.join(root, file), "utf8");

/** @type {(file: string) => Promise<boolean>} */
const exists = async (file) => {
  try {
    await access(path.join(root, file));
    return true;
  } catch {
    return false;
  }
};

const pluginDirectories = await readdir(path.join(root, "plugins"));
const pluginPresence = await Promise.all(
  pluginDirectories.map(async (name) => ({
    name,
    present: await exists(`plugins/${name}/plugin.json`),
  })),
);
const packages = pluginPresence
  .filter(({ present }) => present)
  .map(({ name }) => name)
  .toSorted(compareText);

/** @type {Map<string, string>} */
const locations = new Map();
const skills = await Promise.all(
  packages.map(async (name) => {
    const directory = `plugins/${name}/skills`;
    const names = await readdir(path.join(root, directory));
    const candidates = await Promise.all(
      names.map(async (skill) => ({ present: await exists(`${directory}/${skill}/SKILL.md`), skill })),
    );
    return {
      directory,
      names: candidates.filter(({ present }) => present).map(({ skill }) => skill).toSorted(compareText),
    };
  }),
);
skills.forEach(({ directory, names }) => {
  names.forEach((skill) => {
    if (locations.has(skill)) {
      // oxlint-disable-next-line rules/require-tagged-error -- Preserve this standalone CLI's native failure and message.
      throw new Error(`Duplicate skill: ${skill}`);
    }
    locations.set(skill, `${directory}/${skill}`);
  });
});

/** @type {(source: { directory: string, file: string, skill: string }, link: string) => Promise<string[]>} */
const linkedSkill = async ({ directory, file, skill }, link) => {
  const [target, ...rest] = path.posix
    .normalize(path.posix.join(skill, path.dirname(file), link.split("#")[0]))
    .split("/");
  const location = locations.get(target);
  if (Predicate.isNullish(location) || skill === target) {
    return [];
  }
  if (!(await exists(path.join(location, ...rest)))) {
    // oxlint-disable-next-line rules/require-tagged-error -- Preserve this standalone CLI's native failure and message.
    throw new Error(`${directory}/${file}: missing target ${link}`);
  }
  return [target];
};

/** @type {(skill: string, directory: string, file: string) => Promise<string[]>} */
const fileReferences = async (skill, directory, file) => {
  const content = await read(`${directory}/${file}`);
  const text = content
    .replace(/^---\n[\s\S]*?\n---\n/u, "")
    .replaceAll(/^\s*```[^\n]*\n[\s\S]*?^\s*```[^\n]*$/gmu, "");
  const links = [...text.matchAll(/\]\((?<href>\.\.\/[^\s)]+)\)/gu)].flatMap(({ groups }) =>
    Predicate.isNullish(groups?.href) ? [] : [groups.href],
  );
  const linked = await Promise.all(
    links.map(async (link) => linkedSkill({ directory, file, skill }, link)),
  );
  const mentions = [
    ...text.matchAll(/(?:\*\*|`|\[)\/?(?<name>[a-z][a-z0-9-]+)(?:\*\*|`|\])/gu),
  ].flatMap(({ groups }) => (Predicate.isNullish(groups?.name) ? [] : [groups.name]));
  return [...linked.flat(), ...mentions.filter((name) => locations.has(name) && name !== skill)];
};

/** @type {(skill: string, directory: string) => Promise<string[]>} */
const references = async (skill, directory) => {
  const entries = await readdir(path.join(root, directory), { recursive: true });
  const markdown = entries.filter((file) => file.endsWith(".md") && !file.startsWith("scripts/"));
  const targets = await Promise.all(
    markdown.map(async (file) => fileReferences(skill, directory, file)),
  );
  return [...new Set(targets.flat())].toSorted(compareText);
};

/** @type {(file: string) => Promise<string>} */
const description = async (file) => {
  /** @type {unknown} */
  const manifest = JSON.parse(await read(file));
  if (
    Predicate.isObject(manifest) &&
    "description" in manifest &&
    Predicate.isString(manifest.description)
  ) {
    return manifest.description;
  }
  // oxlint-disable-next-line rules/require-tagged-error -- The standalone CLI reports malformed plugin manifests as native failures.
  throw new TypeError(`${file}: expected a plugin description`);
};

const sections = await Promise.all(
  packages.map(async (name) => {
    const folder = `plugins/${name}`;
    const manifest = `${folder}/plugin.json`;
    const entries = [...locations].filter(([, directory]) => directory.startsWith(`${folder}/`));
    const rows = await Promise.all(
      entries.map(async ([skill, directory]) => {
        const targets = await references(skill, directory);
        const links = targets.map((target) => `\`${target}\``).join(", ");
        return `| [${skill}](${directory}/SKILL.md) | ${String.isEmpty(links) ? "None" : links} |`;
      }),
    );
    const detail = await description(manifest);
    return `### [${name}](${manifest})\n\n${detail}\n\n| Skill | Refers to |\n| --- | --- |\n${rows.join("\n")}`;
  }),
);
const readme = "README.md";
const doc = await read(readme);
const first = doc.indexOf("### [totto2727-");
const end = doc.indexOf("## Development and license", first);
if (first === missingIndex || end === missingIndex) {
  // oxlint-disable-next-line rules/require-tagged-error -- Preserve the standalone CLI's failure when the output boundaries are missing.
  throw new Error("Missing README map boundaries");
}
await writeFile(
  path.join(root, readme),
  `${doc.slice(firstCharacter, first)}${sections.join("\n\n")}\n\n${doc.slice(end)}`,
);
// oxlint-disable-next-line eslint/no-console -- This is the CLI's user-facing success output.
console.log(`Mapped ${locations.size} skills in ${packages.length} plugins.`);
