export default {
  fmt: {
    ignorePatterns: ["plugins/*/skills/docs-*/**"],
  },
  run: {
    tasks: {
      test: {
        command: "uv run tests/share_artifact_readme_template_test.py",
      },
    },
  },
};
