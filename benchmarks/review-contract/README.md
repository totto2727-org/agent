# Review contract benchmark

Use this benchmark to compare rules-only guidance with a correction-aware review procedure on fictitious repositories.
Read [the pre-registered protocol](protocol.md) before running a comparison.
The three code tasks include documentation propagation and protected behavior.
The documentation-only task is a separate control, not evidence of code-review improvement.

| Case             | Requested work                                                                                            | Protected counterexamples                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `01-defaults`    | Remove redundant CLI and runtime overrides, update the consumer guide, and add focused tests              | Managed-profile quota, timeout validation, authorization, Unicode JSON, transport failures                           |
| `02-domain`      | Establish constructor guarantees, remove redundant consumer checks, and use a standard ordered collection | External JSON rejection, later mutation, duplicate order, detached plain output, unusual identifiers                 |
| `03-local-fix`   | Fix CRLF at the shared record boundary and propagate both output descriptions                             | Bare CR, spaces, empty unauthorized input, format errors, authentication and release contracts                       |
| `04-reader-docs` | Simplify English and Japanese consumer guides with runnable local examples                                | Product meaning, ordered tags, accurate line count, UTF-8, no upload or incident diagnosis, unchanged implementation |

## Run the local checks

Run commands from the agent repository root in its pinned environment.
The fixtures use Node 24 builtins and do not install dependencies.
Create the local temporary directory before running the test entry point.

```bash
mkdir -p tmp
nix develop --command node benchmarks/review-contract/runner.mjs verify
nix develop --command node --test 'benchmarks/review-contract/*.test.mjs'
```

`verify` checks all frozen public input trees, example answers, and oracle files against [freeze.json](freeze.json).
The tests establish that initial public tests pass despite missed requirements, example answers and legitimate alternatives satisfy deterministic checks, and harmful mutations are rejected.
They do not establish the quality of a solver's output.

## Prepare and evaluate one trial

Use a new directory for each task, condition, and repetition.
The preparation command refuses to overwrite an existing directory and copies only public task files, not the oracle or answers.
It creates a local Git repository without a remote.
Add the specified condition's policy snapshot before the solver starts, then freeze the trial's starting revision.

```bash
mkdir -p tmp/review-trials
nix develop --command node benchmarks/review-contract/runner.mjs prepare 01-defaults tmp/review-trials/one
```

Give a fresh solver only that directory, the public task, and the pre-registered policy inputs.
Do not give it this benchmark directory, other trials, expected answers, hidden checks, labels, or previous-run findings.
Do not allow it to change the task, policy, initial tests, or oracle to evade requirements.
Keep working directories and raw traces private and outside commits.

After the solver finishes, run scoring in a fresh process with a bounded timeout in a disposable execution environment.
Scoring imports and executes candidate code and runs its tests, so do not use it for untrusted third-party submissions with ambient credentials or unrelated filesystem access.
Directory separation is not OS-level sandboxing.
The included fixtures and authorized solver edits are controlled synthetic inputs.

```bash
nix develop --command node benchmarks/review-contract/runner.mjs score 01-defaults tmp/review-trials/one
```

The JSON result lists deterministic requirement checks and the frozen manual review criteria.
A reviewer who does not know the condition must assess every applicable manual criterion against the actual changed artifacts.
Only their combined result establishes complete-task success within this synthetic benchmark.
The runner reports JSON even when requirement checks fail; callers must inspect `deterministicPass` and individual checks, not merely the process exit code.

The evaluator can construct the example answer separately with `answer CASE NEW_DIRECTORY`.
Never expose that directory to the solver.
Other implementations are valid when they meet the same behavior and manual criteria.

## Review through the public JevLint CLI

Use [code-review's JevLint procedure](../../plugins/totto2727-coding/skills/code-review/references/jevlint.md) with a compatible fork build, Node 24, and the existing authorized Cloudflare environment.
Keep static findings, semantic review assistance, wider review, and public-operation evidence separate.

The packet command copies the current task and local files into one temporary Markdown subject and refuses to truncate an oversized packet.
It does not establish completeness or applicability by itself.
Before inference, exclude any evaluation policy, answers, labels, secrets, unrelated files, and generated logs.
Add the actual diff, standard contract evidence, relevant creation paths, static results, and delivery claims required by each selected question.
Disable inapplicable questions or mark missing evidence in manual review.

```bash
nix develop --command node benchmarks/review-contract/runner.mjs packet 01-defaults tmp/review-trials/one
```

Use the public CLI's `rules`, `check --dry-run`, authorized live `check --record`, and offline `replay` commands.
Inspect loaded rules, subject coverage, all answers, missing work, and errors.
The question drafts have no fitted thresholds and are not approval gates.
A dry run, empty finding list, missing answer, or default cutoff is not evidence of correctness.
Never change provider or search for credentials when an actual user-controlled prerequisite blocks inference.

## Interpretation

Report complete task outcomes and individual missed requirements, not only a combined lint score.
Report legitimate exceptions, false findings, unanswered questions, source isolation, exact revisions, and any deviations from the protocol.
Do not relabel documentation controls as code-skill wins, equate synthetic task completion with production acceptance, or infer fewer future user corrections from one trial.
Read [the recorded comparison](results/README.md), including its limits and unresolved inference prerequisites.
