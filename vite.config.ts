import preset from "@totto2727/oxlint/preset/application";
import { defineConfig } from "vite-plus";

const auditScripts = "plugins/totto2727-documentation/skills/audit-english-docs/scripts";

// Only these four suites run through Vitest. Statechart and watch-pr use their native runners.
const auditVitestFiles = ["catalog", "evaluate", "history-corpus", "ste"].map(
  (name) => `${auditScripts}/${name}.test.mjs`,
);

type Override = NonNullable<typeof preset.overrides>[number];

const scopeVitest = (override: Override): Override => {
  if (override.plugins.includes("vitest") && override.files.includes("**/*.test.ts")) {
    return { ...override, files: auditVitestFiles };
  }
  return override;
};

// oxlint-disable-next-line import/no-default-export -- Vite loads the default configuration export.
export default defineConfig({
  fmt: {
    ignorePatterns: [
      "plugins/totto2727-documentation/skills/unslop/SKILL.md",
      "plugins/totto2727-verification/skills/statechart/scripts/**",
      "plugins/totto2727-workflow/skills/poteto-mode/scripts/**",
    ],
  },
  lint: {
    ...preset,
    env: { node: true },
    overrides: [
      ...preset.overrides.map(scopeVitest),
      {
        // Node.js 22 and later run these distributed JavaScript files directly.
        files: [`${auditScripts}/*.mjs`],
        rules: { "rules/consistent-import-extension": ["error", { mode: "js" }] },
      },
    ],
  },
});
