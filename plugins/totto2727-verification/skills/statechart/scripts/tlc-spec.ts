// oxlint-disable-next-line rules/no-node-imports -- Read the standalone tool's configuration and parser output from the native filesystem.
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line rules/no-node-imports -- Resolve a specification using the host filesystem's path conventions.
import path from "node:path";
import { readConfig } from "./frontends/config.ts";
import { readChecks, readSany, readSpec } from "./frontends/spec.ts";
import type { Checks, Sany } from "./frontends/spec.ts";
import type { CheckResult } from "./ir.ts";
import { CHILD_SUCCESS } from "./native-process.ts";
import type { FileResult } from "./native-process.ts";
import { sanyErrors, tail } from "./tlc-output.ts";
import type { ToolRunner } from "./tlc-tools.ts";

export { initialOnlyProperties } from "./frontends/spec.ts";

export const readCheckConfiguration = async (configFile: string): Promise<Checks> => {
  const config = readConfig({ file: configFile, text: await readFile(configFile, "utf8") });
  return readChecks({ config, configFile });
};

const sanyFailure = async (xml: FileResult, specFile: string, { runJava }: ToolRunner): Promise<Error> => {
  const errors = xml.error ? undefined : sanyErrors(await runJava({
    args: [path.resolve(specFile)],
    main: "tla2sany.SANY",
    name: "sany-errors",
    vmOptions: ["-XX:TieredStopAtLevel=1"],
  }));
  // oxlint-disable-next-line rules/require-tagged-error -- The standalone CLI reports this native parse error without loading a runtime package.
  return new Error(`SANY could not read ${specFile} (exit ${xml.status}):\n${errors ?? tail(xml)}`);
};

interface CheckedSpec {
  sany: Sany;
  spec: CheckResult["spec"];
}

export const readCheckedSpec = async (
  { checks, folder, specFile }: { checks: Checks; folder: string; specFile: string },
  tools: ToolRunner,
): Promise<CheckedSpec> => {
  const xml = await tools.runJava({
    args: ["-o", "-I", folder, path.resolve(specFile)],
    main: "tla2sany.xml.XMLExporter",
    name: "sany",
    vmOptions: ["-XX:TieredStopAtLevel=1"],
  });
  if (xml.status !== CHILD_SUCCESS) {throw await sanyFailure(xml, specFile, tools);}
  const sany = readSany(await readFile(xml.stdout, "utf8"));
  const module = path.basename(specFile, ".tla");
  return { sany, spec: { ...readSpec({ checks, module, sany }), folder } };
};
