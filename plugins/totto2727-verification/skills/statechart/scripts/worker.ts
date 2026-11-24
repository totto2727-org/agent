// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to preserve the bytes and UTF-8 boundaries in the host's streams.
import { Buffer } from "node:buffer";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to inspect or write files through the host filesystem.
import fs from "node:fs";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to convert local module URLs with the host platform's path rules.
import { pathToFileURL } from "node:url";
// oxlint-disable-next-line rules/no-node-imports -- The standalone Statechart tool uses this built-in to preserve the native rendering of the observed diagnostic.
import { inspect } from "node:util";
import { checkView } from "./frontends/view.ts";
import { compile } from "./pipeline.ts";
import { check, messageOf } from "./run.ts";
import { isString, visitItems } from "./ir.ts";

const [stage, specFile, configFile, viewFile] = process.argv.slice(2);

try {
  const view = checkView(
    viewFile ? await import(pathToFileURL(path.resolve(viewFile)).href) : {},
    inspect,
  );
  const { files, exit } = compile(await check(specFile, configFile), view);
  const draft = path.join(stage, "draft");
  fs.mkdirSync(draft);
  visitItems(files, ([name, parts]) => {
    const fd = fs.openSync(path.join(draft, name), "wx");
    try {
      visitItems(parts, (part) => {fs.writeSync(fd, isString(part) ? Buffer.from(part) : part);});
      fs.writeSync(fd, "\n");
    } finally {
      fs.closeSync(fd);
    }
  });
  fs.renameSync(draft, path.join(stage, "done"));
  process.exit(exit);
} catch (error) {
  console.error(messageOf(error));
  process.exit(2);
}
