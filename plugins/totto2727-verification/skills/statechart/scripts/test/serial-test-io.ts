export const inOrder = async <Item, Result>(
  items: Readonly<Item[]>,
  visit: (item: Item) => Promise<Result>,
): Promise<Result[]> => {
  const results: Result[] = [];
  // oxlint-disable-next-line rules/no-for-loops -- File discovery and child probes run one at a time.
  for (const item of items) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Finish each native filesystem or process operation before starting the next.
    results.push(await visit(item));
  }
  return results;
};
