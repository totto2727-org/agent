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

## Wrapper-assisted live control: 2026-10-17

This supplement serves reviewers checking the model-call evidence, not users choosing a calibrated approval gate.
The installed `oo` and `monid` launchers supply their proxy configuration and authentication to child processes.
Both launchers ran without an executable-permission error.
`oo search` and `monid whoami` reached their public APIs.
A missing variable in the parent shell does not establish that a configured launcher cannot call its service.
Do not invoke an underlying binary without preserving the launcher's environment and routing.

The Monid proxy exposes TypeSafe `/systemone`, not the original Cloudflare transport.
After declaring this route difference, two requests used pinned `jev-1.13.0`, the unchanged packets from the original domain controls, and the original JevLint question and state builders.
Inputs, model, two-call budget, no-retry policy, and the expected ordering were recorded before inference.

| Control                                                    | Completed answers | Score | Confidence | Observed result at the existing default cutoff of 2 |
| ---------------------------------------------------------- | ----------------- | ----- | ---------- | --------------------------------------------------- |
| Q1: missing domain guarantee                               | 1/1               | 2.50  | 0.51       | Reported                                            |
| Q2: established guarantee and retained external validation | 1/1               | 1.03  | 0.91       | Not reported                                        |

Both calls returned `COMPLETED`, HTTP 200, and the requested model.
Validation checked exact question coverage, answer types, finite ranges, distributions, and returned rubric text.
Receipts report 2,799 input tokens, 42 output tokens, and USD 0.000117 in total.
These two observations separate the existing defect and clean controls, but do not calibrate the default cutoff or establish general false-positive or false-negative rates.

The [saved evidence](monid-20261017/summary.json) includes hashes and receipts without account identifiers or credentials.
The `.request.txt` files preserve the exact JSON request bytes.
The [pre-inference record](monid-20261017/freeze.json) binds their hashes and question-builder revision.
The [converted record](monid-20261017/converted-replay-record.json) explicitly identifies its Monid source: it was **not** emitted by `jev-lint check`.
The built public JevLint `replay` command consumed that record and returned exit 1, two subjects, zero missing answers, and one finding for Q1 only.
Its [report](monid-20261017/replay.json) preserves those observed results.
Replay made zero additional requests.

This is a real Monid inference and public replay check, not an end-to-end JevLint-to-Monid transport integration.
The original Cloudflare record, eight task runs, frozen rules, and zero-gain comparison remain unchanged.
Automatic skill activation, representative calibration, and an improvement in task completion remain unverified.

## What remains before claiming improvement

1. For the original Cloudflare CLI check, first use any existing authorized launcher that supplies its required configuration.
   Do not infer failure from the parent environment alone.
   That route requires `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_GATEWAY_ID` and `CLOUDFLARE_AI_GATEWAY_API_KEY`, without storing them in repository artifacts.
2. Complete the actual configured JevLint route, including defect, hard-clean, justified-exception and missing-evidence controls. Record all answers and missing work.
3. Fit any necessary per-question threshold on separate calibration examples, then assess independent held-out examples. Do not fit to this comparison.
4. Pre-register a separate, more discriminating task set and repetitions if task-completion improvement is still the goal. Keep this ceiling result intact.

The replay correctness fix was independently verified offline through the actual built public CLI: the same real null-answer record changed from exit 0 to exit 3, with `subjects=2`, `missing=2`, no findings and zero requests.
[JevLint PR #2](https://github.com/totto2727-org/jevlint/pull/2) contains the independent main-based fix, 24 public CLI regression invocations across JSON/pretty/GitHub output, and a passing 435-test CI run.
Its before/after exit behavior is a separate operational improvement, not evidence that this review procedure raises task-completion rates.
