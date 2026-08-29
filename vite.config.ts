export default {
  fmt: {
    ignorePatterns: [
      "plugins/totto2727-coding/skills/share-artifact/agents/template.md",
      "plugins/totto2727-coding/skills/share-artifact/readme/sample.md",
      "plugins/totto2727-coding/skills/share-artifact/readme/template.md",
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
