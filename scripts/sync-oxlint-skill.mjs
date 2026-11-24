import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import plugin from "@totto2727/oxlint";

assert.equal(
  process.argv.length,
  3,
  "Usage: node scripts/sync-oxlint-skill.mjs <trusted oxlint-docs checkout>",
);
const docs = resolve(process.argv[2]);
const git = (...args) => execFileSync("git", ["-C", docs, ...args], { encoding: "utf8" }).trim();
assert.equal(
  git("status", "--porcelain", "--", "src/content", "LICENSE"),
  "",
  "Use committed documentation sources",
);
const revision = git("rev-parse", "HEAD");
const { ruleArticles, ruleMarkdown } = await import(
  pathToFileURL(join(docs, "src/content/rules.ts"))
);
const { externalEffectRuleNames } = await import(
  pathToFileURL(join(docs, "src/content/policies.ts"))
);
const ids = Object.keys(plugin.rules).sort();
assert.deepEqual(
  [...ruleArticles.map(({ name }) => name), ...externalEffectRuleNames].sort(),
  ids,
  "Documentation and installed plugin must cover the same rule IDs",
);
const skill = new URL("../plugins/totto2727-js/skills/oxlint/", import.meta.url);
const refs = new URL("references/", skill);
for (const name of externalEffectRuleNames) {
  assert.ok(
    existsSync(new URL(`${name}.md`, refs)),
    `Write the missing incorporated rule reference: ${name}`,
  );
}
for (const file of readdirSync(refs)) {
  assert.ok(
    ids.includes(file.replace(/\.md$/u, "")),
    `Review and remove retired rule reference: ${file}`,
  );
}
for (const article of ruleArticles) {
  const markdown = ruleMarkdown(article, "en")
    .replace(/^(## .+?) \{#[\w-]+\}$/gmu, "$1")
    .replace(/\]\(\/rules\/([\w-]+)\)/gu, (_, id) => {
      assert.ok(ids.includes(id), `Unknown linked rule: ${id}`);
      return `](${id}.md)`;
    });
  writeFileSync(
    new URL(`${article.name}.md`, refs),
    `# rules/${article.name}\n\n${article.purpose[0]}\n\n${markdown}\n`,
  );
}
copyFileSync(join(docs, "LICENSE"), new URL("LICENSE", skill));
const links = ids.map((id) => `- [${id}](references/${id}.md)`).join("\n");
writeFileSync(
  new URL("SKILL.md", skill),
  `---
name: oxlint
description: >-
  Resolve rules/<id> diagnostics from @totto2727/oxlint in JavaScript or TypeScript.
---

# Oxlint rule index

Open the page matching the reported ID. Fix the code first and rerun the project's lint command. Use a documented exception only when the required behavior rules out the normal correction.
For preset selection, see the [package documentation](https://github.com/totto2727-org/oxlint#setup). The index covers the plugin's own namespace, not every built-in rule enabled by a preset.

## Rules

${links}

[English documentation source](https://github.com/totto2727-org/oxlint-docs/blob/${revision}/src/content/rules.ts) · [License](LICENSE)
`,
);
