export default {
  fmt: {
    ignorePatterns: [
      "plugins/totto2727-documentation/skills/share-artifact/agents/template.md",
      "plugins/totto2727-documentation/skills/share-artifact/readme/template.md",
    ],
  },
  lint: {
    jsPlugins: [{ name: "rules", specifier: "@totto2727/oxlint" }],
    rules: {
      "rules/no-eslint-disable-comments": "error",
      "rules/no-jsx-script-tag": "error",
      "rules/require-disable-reason": "error",
    },
  },
};
