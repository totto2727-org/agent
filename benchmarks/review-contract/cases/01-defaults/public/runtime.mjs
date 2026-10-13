export async function peek(transport, options = {}, authorization) {
  const request = {
    encoding: options.encoding ?? "utf8",
    retries: options.retries ?? 0,
    timeout: options.timeout ?? 500,
    authorization,
  };
  if (!Number.isInteger(request.timeout) || request.timeout <= 0)
    throw new Error("Invalid timeout");
  if (options.profile === "managed") request.concurrency = 2;
  return JSON.stringify(await transport(request));
}
