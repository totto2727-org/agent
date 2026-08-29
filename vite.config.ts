export default {
  fmt: {
    ignorePatterns: [
      "plugins/*/skills/docs-*/**",
      "plugins/totto2727-coding/skills/share-artifact/agents/template.md",
    ],
  },
  run: {
    tasks: {
      test: {
        command: "PYTHONPATH=. uv run tests/share_artifact_readme_template_test.py",
      },
    },
  },
};
