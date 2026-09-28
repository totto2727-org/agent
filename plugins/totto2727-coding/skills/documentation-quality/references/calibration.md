# Calibrate a rule against reviewed history

Use this procedure when deriving or changing a rubric, not for every document review.
The [historical evidence](history-evidence.md) and [corpus specification](history-corpus.json) record the initial reference cases.

## Establish paired evidence

1. Identify the same audience and reader task for both candidates.
2. Inspect chronological commits, not only the base-to-merge diff.
3. Pair a corrected passage with its counterpart at the actual merge commit, preserving complete paragraphs, headings, examples, and warnings.
4. Label the old passage as negative only for the specific writing problem corrected, and the merged passage as positive for that comparison.
5. Separate API changes, feature additions, and factual corrections from writing-quality changes.
6. Record full commit hashes, paths, inclusive source ranges, rule IDs, and the reason for each label outside the evaluator's input.

An old API or modified line is not automatically bad prose.
The merge is the reference for a particular comparison, not proof that the whole document is technically perfect.
Include short accepted units to prevent a rule from succeeding merely by rejecting brevity.

## Keep the comparison blind

Send neutral candidate identifiers with the reader task, source unit, and necessary page or destination context.
Do not send revision preference, expected answers, labeled examples from the review guides, or provenance that reveals which version should pass.
Exclude translated editions, and keep nearly identical host variants in the same split.
Freeze the rules, threshold, and resolved model before evaluating a separate revision-family holdout.
If that holdout influences a later rule change, it is no longer untouched evidence for that change.

## Interpret disagreement

Report false acceptance, false rejection, abstention, infrastructure errors, and missing judgments separately, per rule and revision family.
Inspect source context and the relevant [rule guide](rules.md) before deciding whether a disagreement is a real defect, missing evidence, an inapplicable criterion, or a model error.
Do not alter expected labels to improve a score or average a failed critical check into a passing result.
Agreement on selected history is not a general accuracy guarantee.

Use the [corpus commands](running.md#reproduce-the-historical-comparison) to prepare and score reproducible runs.
Keep live results and one-off investigations under the working repository's ignored `tmp/`, not in distributed skill instructions.
