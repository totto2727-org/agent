export function parseArgs(args) {
  const result = { timeout: 500 };
  for (let index = 0; index < args.length; index += 2) {
    if (args[index] !== "--timeout") throw new Error("Unknown option");
    result.timeout = Number(args[index + 1]);
  }
  if (!Number.isInteger(result.timeout) || result.timeout <= 0) throw new Error("Invalid timeout");
  return result;
}
