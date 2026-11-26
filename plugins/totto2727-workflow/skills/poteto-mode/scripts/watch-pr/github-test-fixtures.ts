import type { PrContext } from "./types.ts";
import { parsePrNumber } from "./types.ts";

export const WATCH_PULL_NUMBER = 42;

export const watchContext: PrContext = {
  number: parsePrNumber(WATCH_PULL_NUMBER),
  owner: "owner",
  repo: "repo",
};
