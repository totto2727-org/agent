import { execFile } from "node:child_process";
import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, expect, it } from "vitest";
import config from "../config/markdownlint.json" with { type: "json" };

const require = createRequire(import.meta.url);
const execute = promisify(execFile);
const cli = require.resolve("markdownlint-cli");
const staticDirectory = fileURLToPath(new URL("../", import.meta.url));
const cliOptions = ["--config", join(staticDirectory, "config/markdownlint.json")];
const directories = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture(source = "# Guide\n\nCheck the panel.\n") {
  const directory = await mkdtemp(join(tmpdir(), "documentation-quality-markdownlint-"));
  directories.push(directory);
  const file = join(directory, "guide.md");
  await writeFile(file, source);
  return { directory, file };
}

function lint(args, options = {}) {
  return execute(process.execPath, [cli, ...cliOptions, ...args], {
    cwd: staticDirectory,
    ...options,
  });
}

it("keeps all default markdownlint rules enabled and uses the official CLI output", async () => {
  expect(config).toEqual({ default: true });
  await expect(access(join(staticDirectory, ".markdownlintignore"))).rejects.toMatchObject({
    code: "ENOENT",
  });
  const { file } = await fixture();
  await expect(lint([file, "--json"])).resolves.toMatchObject({ stdout: "", stderr: "" });
});

it("static cwd does not read target root/nested configs, executable configs, or ignore files", async () => {
  const { directory } = await fixture();
  const nested = join(directory, "nested");
  await mkdir(nested);
  for (const path of [directory, nested]) {
    await writeFile(join(path, ".markdownlint.json"), '{"default":false,"MD013":false}');
    await writeFile(join(path, ".markdownlintrc"), '{"default":false,"MD013":false}');
    await writeFile(join(path, ".markdownlintignore"), "*\n");
    await writeFile(join(path, ".gitignore"), "*\n");
    for (const name of [".markdownlint.cjs", ".markdownlint-cli2.cjs"]) {
      await writeFile(join(path, name), 'throw new Error("target configuration was read");');
    }
  }
  const file = join(nested, "long.md");
  await writeFile(file, `# Guide\n\n${"Long prose ".repeat(20)}ends here.\n`);
  await expect(lint([file, "--json"])).rejects.toMatchObject({
    code: 1,
    stderr: expect.stringContaining('"MD013"'),
  });
});

it("executes the documented direct CLI from outside the skill with explicit file arguments", async () => {
  const { directory, file } = await fixture("# Guide\n\n```\nexample\n```\n");
  await writeFile(join(directory, ".markdownlint.json"), '{"default":false}');
  await writeFile(join(directory, ".markdownlintignore"), "*\n");
  await expect(
    execute("vp", ["-C", staticDirectory, "exec", "markdownlint", ...cliOptions, file, "--json"], {
      cwd: directory,
    }),
  ).rejects.toMatchObject({
    code: 1,
    stderr: expect.stringContaining('"MD040"'),
  });
});

it("supports the official inline suppression behavior instead of a custom stricter policy", async () => {
  const { file } = await fixture(
    `# Guide\n\n<!-- markdownlint-disable MD013 -->\n\n${"Long prose ".repeat(20)}ends here.\n`,
  );
  await expect(lint([file])).resolves.toMatchObject({ stdout: "", stderr: "" });
});

it("supports quoted globs and reports every matching file", async () => {
  const { directory, file } = await fixture("No heading.\n");
  const second = join(directory, "second.md");
  await writeFile(second, "No heading.\n");
  try {
    await lint([join(directory, "*.md"), "--json"]);
    throw new Error("Expected lint findings");
  } catch (error) {
    expect(error.code).toBe(1);
    expect(
      JSON.parse(error.stderr).map(({ fileName }) => resolve(staticDirectory, fileName)),
    ).toEqual([file, second]);
  }
});

it("explicit config still merges cwd rc settings, so arbitrary cwd is not an isolation boundary", async () => {
  const { directory, file } = await fixture(`# Guide\n\n${"Long prose ".repeat(20)}ends here.\n`);
  await writeFile(join(directory, ".markdownlintrc"), '{"MD013":false}');
  await expect(lint([file], { cwd: directory })).resolves.toMatchObject({ stderr: "" });
});

it("unknown CLI flags fail, while no files or an unmatched path print help with exit zero", async () => {
  await expect(lint(["--unexpected"])).rejects.toMatchObject({ code: 1 });
  for (const args of [[], ["/definitely/missing/documentation-quality.md"]]) {
    await expect(lint(args)).resolves.toMatchObject({ stdout: expect.stringContaining("Usage:") });
  }
});

it("malformed explicit configuration fails with official exit code four", async () => {
  const { directory, file } = await fixture();
  const configPath = join(directory, "invalid.json");
  await writeFile(configPath, "{");
  await expect(lint(["--config", configPath, file])).rejects.toMatchObject({ code: 4 });
});
