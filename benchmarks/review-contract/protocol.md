# Pre-registered comparison

This benchmark tests task completion on fictitious repositories, not success on an existing production project.
The cases, public instructions, example answers, deterministic checks, and manual criteria are frozen before solver inference.
Expected answers and oracle labels are excluded from solver inputs.
Example answers are not exact-match scoring targets.

| Item                       | Fixed condition                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cases                      | Three mixed code/documentation tasks and one documentation-only control                                                                                       |
| Solver                     | Fresh OpenAI OAuth `gpt-6.1-sol`, medium effort, one solver per condition per case                                                                            |
| Baseline                   | The same public task, initial repository, and existing share-coding/js-coding/documentation-principles guidance at `0f3a3c4af95eff10e85b403c428800846a9e3a70` |
| Procedure                  | Baseline inputs plus the new code-review skill and its self-contained references for code cases                                                               |
| Documentation-only control | Existing documentation-quality workflow supplied equally to both conditions. The new code-review skill is not applicable                                      |
| Tools                      | Same Node 24 local runtime and public fixture tests. No dependencies, external data, deployment, or repository mutations outside the isolated trial           |
| Extra procedure            | Exact checks, applicable bounded JevLint questions through the real fork CLI, wider source review, and actual fixture public operations                       |
| Stop                       | One initial trial per condition. Do not rewrite cases or tune prompts after observing results. Any new trials must be separately identified                   |
| Missing inference          | Record it as missing, not clean. Do not switch providers or bypass an authentication prerequisite                                                             |

## Outcomes

1. Run every deterministic requirement check against the actual edited repository in a fresh process.
2. Have a reviewer assess the frozen manual criteria with condition names withheld.
3. Report complete-task success only when deterministic and applicable manual requirements both pass.
4. Report each failure and preserved legitimate customization, security boundary, already-correct behavior, and authorized scope.
5. Record JevLint subjects, loaded questions, answers, missing work, model, transport, revision, and raw record separately from task completion.
6. Do not fit thresholds on these task results or use a default score cutoff as acceptance.
7. Report timing only as descriptive. Different intervention workloads and shared service caching prevent causal latency claims.

A small single-run comparison cannot establish a stable improvement rate, individual tool causality, generalization to other languages, or lower future user-correction rates.
If the baseline reaches the ceiling, report no observed task-completion gain instead of manufacturing one.
Documentation-only controls cannot establish an effect from the code-review skill.
Keep generic reproducible results and task artifacts as benchmark evidence, while excluding private histories, worker transcripts, credentials, and temporary execution files from commits.
