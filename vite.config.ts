import preset from "@totto2727/oxlint/preset/application";
import { defineConfig } from "vite-plus";

const auditScripts = "plugins/totto2727-documentation/skills/audit-english-docs/scripts";

// These four native JavaScript suites use Vitest alongside the preset's TypeScript suites.
const auditVitestFiles = ["catalog", "evaluate", "history-corpus", "ste"].map(
  (name) => `${auditScripts}/${name}.test.mjs`,
);

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
      ...(preset.overrides ?? []).map((override) =>
        override.plugins?.includes("vitest") && override.files.includes("**/*.test.ts")
          ? { ...override, files: [...override.files, ...auditVitestFiles] }
          : override,
      ),
      {
        // Node.js 22 and later run these distributed JavaScript files directly.
        files: [`${auditScripts}/*.mjs`],
        rules: { "rules/consistent-import-extension": ["error", { mode: "js" }] },
      },
    ],
  },
});
