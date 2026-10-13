export function authorize(token, expected) {
  if (typeof expected !== "string" || expected.length === 0 || token !== `Bearer ${expected}`)
    throw new Error("Unauthorized");
}
