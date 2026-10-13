import { authorize } from "./auth.mjs";

export function render(input, format, token, expected) {
  authorize(token, expected);
  const records = input.split(/\r?\n/).filter((record) => record !== "");
  if (format === "json") return JSON.stringify(records);
  if (format === "text") return records.join("\n");
  throw new Error("Unknown format");
}
