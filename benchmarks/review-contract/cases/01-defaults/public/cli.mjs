export function parseArgs(args) {
  const result = { timeout: 500, encoding: "utf8", retries: 0, format: "json" };
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index].slice(2);
    if (!["timeout", "encoding", "retries", "format"].includes(key))
      throw new Error("Unknown option");
    const value = args[index + 1];
    result[key] = ["timeout", "retries"].includes(key) ? Number(value) : value;
  }
  if (!Number.isInteger(result.timeout) || result.timeout <= 0) throw new Error("Invalid timeout");
  if (result.encoding !== "utf8" || result.retries !== 0 || result.format !== "json")
    throw new Error("Unsupported value");
  return result;
}
