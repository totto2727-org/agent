import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, expect, it } from "vitest";

const execute = promisify(execFile);
const entry = fileURLToPath(new URL("../markdownlint.mjs", import.meta.url));
const staticDirectory = fileURLToPath(new URL("../", import.meta.url));
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

it("prints public markdownlint JSON and exits zero for a conforming file", async () => {
  const { directory, file } = await fixture();
  const result = await execute(process.execPath, [entry, file], { cwd: directory });
  expect(JSON.parse(result.stdout)).toEqual({ [file]: [] });
});

it("keeps MD013 enabled despite hostile root/nested configs and inline disable comments", async () => {
  const { directory } = await fixture();
  const nested = join(directory, "nested");
  await mkdir(nested);
  for (const path of [directory, nested]) {
    await writeFile(join(path, ".markdownlint.json"), '{"default":false,"MD013":false}');
    await writeFile(join(path, ".markdownlintrc"), '{"default":false,"MD013":false}');
    await writeFile(
      join(path, ".markdownlint-cli2.cjs"),
      'throw new Error("repository configuration was read");',
    );
  }
  const file = join(nested, "long.md");
  await writeFile(
    file,
    `# Guide\n\n<!-- markdownlint-disable -->\n\n${"Long prose ".repeat(20)}ends here.\n`,
  );
  await expect(execute(process.execPath, [entry, file], { cwd: directory })).rejects.toMatchObject({
    code: 1,
    stdout: expect.stringContaining('"MD013"'),
  });
});

it("executes the package markdownlint task from outside the skill with explicit file arguments", async () => {
  const { directory, file } = await fixture("# Guide\n\n```\nexample\n```\n");
  await writeFile(join(directory, ".markdownlint.json"), '{"default":false}');
  await expect(
    execute("vp", ["-C", staticDirectory, "run", "markdownlint", file], { cwd: directory }),
  ).rejects.toMatchObject({
    code: 1,
    stdout: expect.stringContaining('"MD040"'),
  });
});

it.each([[[]], [["--unexpected"]], [["/definitely/missing/documentation-quality.md"]]])(
  "invalid inputs %j exit two without being reported as a pass",
  async (args) => {
    await expect(execute(process.execPath, [entry, ...args])).rejects.toMatchObject({ code: 2 });
  },
);
