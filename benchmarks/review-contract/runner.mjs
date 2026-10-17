import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { evaluate } from "./oracle.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
const [command, caseId, target] = process.argv.slice(2);
const fixture = manifest.cases.find((item) => item.id === caseId);

async function files(directory, excludedDirectories = []) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excludedDirectories.includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await files(path, excludedDirectories)));
    else if (entry.isFile()) result.push(path);
  }
  return result.sort();
}

if (command === "verify") {
  const freeze = JSON.parse(await readFile(join(root, "freeze.json"), "utf8"));
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  for (const item of freeze.oracleFiles) {
    if (hash(await readFile(join(root, item.path))) !== item.sha256)
      throw new Error(`Frozen file changed: ${item.path}`);
  }
  for (const item of freeze.cases) {
    for (const tree of [item.inputs, item.answer]) {
      const directory = join(root, tree.path);
      const paths = await files(directory);
      let text = "";
      for (const path of paths)
        text += `${relative(directory, path)}\0${hash(await readFile(path))}\n`;
      if (paths.length !== tree.files || hash(text) !== tree.sha256)
        throw new Error(`Frozen tree changed: ${tree.path}`);
    }
  }
  console.log(JSON.stringify({ frozenInputsVerified: true, cases: freeze.cases.length }));
} else if (command === "prepare" || command === "answer") {
  if (!fixture || !target) throw new Error("Usage: runner.mjs prepare|answer CASE NEW_DIRECTORY");
  const workspace = resolve(target);
  await mkdir(workspace, { recursive: false });
  await cp(join(root, fixture.publicRoot), workspace, { recursive: true });
  if (command === "answer")
    await cp(join(root, fixture.acceptedOverlay), workspace, { recursive: true });
  const git = spawnSync("git", ["init", "-q", workspace], { encoding: "utf8" });
  if (git.status !== 0) throw new Error(git.stderr);
  console.log(JSON.stringify({ caseId, workspace, answer: command === "answer" }));
} else if (command === "score") {
  if (!fixture || !target) throw new Error("Usage: runner.mjs score CASE DIRECTORY");
  console.log(JSON.stringify(await evaluate(caseId, resolve(target)), null, 2));
} else if (command === "packet") {
  if (!fixture || !target) throw new Error("Usage: runner.mjs packet CASE DIRECTORY");
  const workspace = resolve(target);
  let packet = "# Task\n" + (await readFile(join(workspace, "task.md"), "utf8"));
  for (const path of await files(workspace, [".git", ".review", ".review-policy"])) {
    if (
      ["task.md", "policy.md", "documentation-review.md"].some(
        (name) => path === join(workspace, name),
      )
    )
      continue;
    packet += `\n# File: ${relative(workspace, path)}\n` + (await readFile(path, "utf8"));
  }
  if (packet.length > 48000)
    throw new Error("Packet exceeds the whole-file Text boundary. Narrow its scope explicitly.");
  await mkdir(join(workspace, ".review"), { recursive: true });
  const output = join(workspace, ".review", "packet.md");
  await writeFile(output, packet);
  console.log(
    JSON.stringify({
      output,
      chars: packet.length,
      sha256: createHash("sha256").update(packet).digest("hex"),
    }),
  );
} else {
  throw new Error(
    "Commands: prepare CASE NEW_DIRECTORY, answer CASE NEW_DIRECTORY, score CASE DIRECTORY, packet CASE DIRECTORY. Run from a disposable sandbox. Scoring executes candidate code.",
  );
}
