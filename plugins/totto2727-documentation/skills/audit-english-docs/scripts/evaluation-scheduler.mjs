const FIRST_QUEUE_INDEX = 0;
const NEXT_QUEUE_INDEX = 1;

/**
 * Runs each evaluation once with the configured concurrency limit.
 * @template Input, Output
 * @param {Input[]} items - The evaluation targets in report order.
 * @param {number} concurrency - The worker limit.
 * @param {(item: Input) => Promise<Output>} run - Evaluate a single target.
 * @returns {Promise<Output[]>} Results in the original target order.
 */
export const pooled = async (items, concurrency, run) => {
  /** @type {Output[]} */
  const results = [];
  const cursor = { next: FIRST_QUEUE_INDEX };
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor.next < items.length) {
        // Claim one target synchronously before awaiting I/O.
        const index = cursor.next;
        cursor.next += NEXT_QUEUE_INDEX;
        // oxlint-disable-next-line eslint/no-await-in-loop -- This worker waits for the current target before claiming the next.
        results[index] = await run(items[index]);
      }
    }),
  );
  return results;
};
