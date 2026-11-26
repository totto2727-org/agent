---
name: scheduling
description: Specify the timing, overlap, and recovery contract of a recurring job or polling loop.
---

# Scheduling

“Every ten minutes” leaves three different contracts open. Choose the one the caller expects before selecting a timer.

| Basis       | Example                      | Decision that changes the result                                                                     |
| ----------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| Calendar    | 09:00 in a named time zone   | What happens when a local time is skipped or repeated?                                               |
| Fixed rate  | 00:03, 00:13, 00:23          | What happens when a run extends past the next slot? A cron firing at :00, :10, :20 loses the anchor. |
| Fixed delay | Ten minutes after completion | A two-minute job starts every twelve minutes. Is that acceptable?                                    |

Distinguish a logical run (for example, a window `[start, end)`) from an attempt. Decide whether a restart skips, coalesces, or replays missed windows, and whether overlapping runs are skipped, queued with a bound, or concurrent. Persist the anchor or completed window only if restart must preserve it. A scheduler's success record does not make an external effect exactly once.

Keep the work callable with an explicit window so recovery does not depend on waiting for a timer. Before retrying a partial run, identify which effects may already have happened and how to recognize them; bound retries relative to the next slot. Check the chosen scheduler's actual persistence and catch-up behavior rather than assuming it.

Source: [Scheduled and Periodic Execution Implementation Guide](https://blog.jxck.io/entries/2026-03-03/scheduled-and-periodic-execution.html).
