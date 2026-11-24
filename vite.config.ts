import preset from "@totto2727/oxlint/preset/application";
import { defineConfig } from "vite-plus";

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
      ...(preset.overrides ?? []),
      {
        // Node.js 22 and later run these distributed JavaScript files directly.
        files: ["plugins/totto2727-documentation/skills/documentation-quality/scripts/*.mjs"],
        rules: { "rules/consistent-import-extension": ["error", { mode: "js" }] },
      },
    ],
  },
});
