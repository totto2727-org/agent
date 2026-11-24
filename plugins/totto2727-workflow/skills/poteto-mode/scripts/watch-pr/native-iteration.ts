export const visitItems = <Item>(source: Iterable<Item>, visit: (item: Item) => void): void => {
  // oxlint-disable-next-line rules/no-for-loops -- The standalone watcher runs on Bun versions that lack iterator helpers.
  for (const item of source) {visit(item);}
};
