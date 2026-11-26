export const nativeFailure = (failure: unknown): Error => {
  // oxlint-disable-next-line rules/no-instanceof-error -- The native render test diagnoses only the same realm's Error values and rethrows other failures.
  if (!(failure instanceof Error)) {throw failure;}
  return failure;
};

export const errorText = (failure: Error): string => failure.message;
