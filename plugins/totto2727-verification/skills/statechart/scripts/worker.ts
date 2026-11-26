// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to inspect or write files through the host filesystem.
import fs from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to convert local module URLs with the host platform's path rules.
import { pathToFileURL } from "node:url";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to preserve the native rendering of the observed diagnostic.
import { inspect } from "node:util";
import { checkView } from "./frontends/view.ts";
import { compile } from "./pipeline.ts";
import { check, messageOf } from "./run.ts";

const FIRST_ARGUMENT = 2;
const COMMAND_ERROR = 2;
const [stage, specFile, configFile, viewFile] = process.argv.slice(FIRST_ARGUMENT);

const writeParts = async (file: string, parts: Iterable<string | Uint8Array>): Promise<void> => {
  const handle = await fs.open(file, "wx");
  try {
    // oxlint-disable-next-line rules/no-for-loops -- Consume the generated file parts one at a time without buffering the artifact.
    for (const part of parts) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Preserve file position and chunk order before requesting the next part.
      await handle.writeFile(part);
    }
    await handle.writeFile("\n");
  } finally {
    await handle.close();
  }
};

try {
  const viewModule: unknown = viewFile ? await import(pathToFileURL(path.resolve(viewFile)).href) : {};
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Pass the view module's native namespace to the existing export validator.
  const view = checkView(viewModule as Record<string, unknown>, inspect);
  const { files, exit } = compile(await check(specFile, configFile), view);
  const draft = path.join(stage, "draft");
  await fs.mkdir(draft);
  // oxlint-disable-next-line rules/no-for-loops -- Finish each output file before making the next file available in the staging folder.
  for (const [name, parts] of files) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Complete writing each file before renaming the draft folder as a unit.
    await writeParts(path.join(draft, name), parts);
  }
  await fs.rename(draft, path.join(stage, "done"));
  // oxlint-disable-next-line unicorn/no-process-exit -- Report the check's result to the CLI after the staged files have closed.
  process.exit(exit);
} catch (error) {
  // oxlint-disable-next-line eslint/no-console -- The worker passes its diagnostic to the CLI through stderr.
  console.error(messageOf(error));
  // oxlint-disable-next-line unicorn/no-process-exit -- Report a failed check to the parent and shut down the isolated worker.
  process.exit(COMMAND_ERROR);
}
