import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function summarize(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const tags = [
    ...new Set(lines.filter((line) => line.startsWith("#")).map((line) => line.slice(1).trim())),
  ];
  return { lines: lines.length, tags };
}

export async function run(args) {
  if (args.length !== 2 || args[0] !== "--local")
    throw new Error("Usage: node cli.mjs --local FILE");
  return JSON.stringify(summarize(await readFile(args[1], "utf8")));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(await run(process.argv.slice(2)));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
