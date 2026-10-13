# Recorded comparison: 2026-10-13

**No task-completion improvement was observed. The full static-plus-JevLint-plus-LLM intervention remains unverified.**
The baseline already completed all three code tasks, and the procedure condition completed them too.
Live JevLint was blocked before inference because its three configured Cloudflare variables were absent.
The rules remain advisory drafts, not calibrated approval gates.

## Actual task outcomes

| Task                                        | Rules-only baseline                 | Procedure with live inference blocked | Evidence                                                                                                                     |
| ------------------------------------------- | ----------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Redundant defaults and intentional quota    | R1: 6/6 checks, 3/3 manual criteria | R2: 6/6 checks, 3/3 manual criteria   | Public parser/runtime operations, Unicode, timeout and auth assertions; README review                                        |
| Domain guarantees and standard collection   | R4: 7/7 checks, 3/3 manual criteria | R3: 7/7 checks, 3/3 manual criteria   | Constructor/mutation/external JSON operations; iterable, duplicate-order and detached-row checks; source review              |
| Local CRLF fix and equivalent documentation | R5: 7/7 checks, 3/3 manual criteria | R6: 7/7 checks, 3/3 manual criteria   | Actual renderer in both formats, auth failures, bare CR and protected release contract; both documents reviewed              |
| Documentation-only control                  | R7: 6/6 checks, 4/4 manual criteria | R8: 6/6 checks, 4/4 manual criteria   | Both guides' commands executed and output compared; purpose, caveats and fidelity reviewed. No new code-review skill applied |

Code task completion is **3/3 versus 3/3**, with an observed gain of **0 percentage points**.
Across the eight trials, 52/52 mechanical checks and 26/26 condition-label-blinded manual criteria passed.
The documentation controls are excluded from the code-skill comparison.
These outcomes concern controlled fictitious repositories, not production deployment or explicit user acceptance.

## Evidence and limitations

| Evidence                         | Observed result                                                                                                                                            | What it does not prove                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Pre-inference freeze             | Commit `bcee18c5f44bd99fa2e25adc9b42940fc85261f6` records inputs, instructions, example answers, oracles, questions and protocol; frozen hashes reverified | Representative coverage of all past correction types                                                               |
| Initial fixture checks           | All four original public test sets pass, while ten additional requirement checks fail                                                                      | Improvement caused by the new skill. This validates benchmark sensitivity only                                     |
| Example solutions and controls   | All four example solutions and legitimate alternatives pass; harmful mutations are rejected                                                                | Solver quality or inference accuracy                                                                               |
| Blind task runs                  | Same fresh OpenAI OAuth `gpt-6.1-sol`, medium effort, one pair per case; no answer or oracle inputs; protected policies and original tests unchanged       | A stable improvement rate, latency gain, or individual tool causality                                              |
| Reproduction                     | All eight published patches apply to fresh public repositories and reproduce their mechanical results under pinned Node 24                                 | Repeated fresh model generations or human reader acceptance                                                        |
| Manual review                    | Every frozen criterion assessed with source locators by a separate reviewer who did not receive condition labels                                           | Human acceptance, a reader study, or complete ASD-STE100 dictionary compliance                                     |
| Skill validation and offline CLI | Official local skill validator passes; five rules load; complete Text subjects plan without truncation; missing context is refused with exit 2             | Actual automatic activation in installed clients or semantic accuracy                                              |
| Live CLI control                 | Two subjects, zero answered, two missing, zero calls, exit 3                                                                                               | Any true/false finding, calibrated threshold or Cloudflare inference success                                       |
| Original replay behavior         | The same null-answer record replays with two missing subjects but exit 0                                                                                   | A clean result. This discrepancy was reproduced through the public CLI and isolated for a separate correctness fix |
| Replay correctness fix           | The identical real record returns exit 3 after commit `ae39d96e96c7e4d1c2762d3ba97f3dabb20a77fd`, still with two missing subjects and zero calls           | Task-completion improvement or successful live inference. This only closes the false-success exit path             |

Initial scoring and solvers used Node `v24.21.0`; independent pinned reproduction used Node `v24.18.1`.
Directory separation was controlled input isolation, not an OS security sandbox for arbitrary submissions.
No post-hoc case changes, prompt tuning, provider fallback, credential search, or authentication repair followed the observed results.

## Reproduce a published result

Run from the agent repository root, using a new directory each time.

```bash
ROOT="$PWD"
mkdir -p tmp/review-reproduction
nix develop --command node benchmarks/review-contract/runner.mjs prepare 01-defaults tmp/review-reproduction/R1
git -C tmp/review-reproduction/R1 apply --unidiff-zero "$ROOT/benchmarks/review-contract/results/patches/R1.patch"
nix develop --command node benchmarks/review-contract/runner.mjs score 01-defaults tmp/review-reproduction/R1
nix develop --command node --test 'benchmarks/review-contract/*.test.mjs'
```

[comparison.json](comparison.json) records condition mapping, revisions, hashes, observed counts and unresolved inference.
[checks/](checks/) contains individual mechanical results, [manual-review.json](manual-review.json) contains every contextual criterion's evidence, and [patches/](patches/) contains generic solver changes without private transcripts or review logs.
The patches use standard Git zero-context format against the exact frozen public inputs, so apply them with `--unidiff-zero`.
The reproduction test checks patch hashes, applies each patch and executes the actual public fixture operations.

## What remains before claiming improvement

1. Supply the existing authorized `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_GATEWAY_ID` and `CLOUDFLARE_AI_GATEWAY_API_KEY` to the process without storing them in repository artifacts.
2. Complete the actual configured JevLint route, including defect, hard-clean, justified-exception and missing-evidence controls. Record all answers and missing work.
3. Fit any necessary per-question threshold on separate calibration examples, then assess independent held-out examples. Do not fit to this comparison.
4. Pre-register a separate, more discriminating task set and repetitions if task-completion improvement is still the goal. Keep this ceiling result intact.

The replay correctness fix was independently verified offline through the actual built public CLI: the same real null-answer record changed from exit 0 to exit 3, with `subjects=2`, `missing=2`, no findings and zero requests.
[JevLint PR #2](https://github.com/totto2727-org/jevlint/pull/2) contains the independent main-based fix, 24 public CLI regression invocations across JSON/pretty/GitHub output, and a passing 435-test CI run.
Its before/after exit behavior is a separate operational improvement, not evidence that this review procedure raises task-completion rates.
