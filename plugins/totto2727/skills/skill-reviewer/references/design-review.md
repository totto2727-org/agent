# Design Review Heuristics

Use these questions for the concerns being reviewed, not as mandatory categories or a scoring rubric.
They are reviewer heuristics, not additional Agent Skills format constraints.

## Description and scope

- Can a reader infer the capability and the situations where it is useful?
- Does the description match what the body actually provides?
- If adjacent skills could plausibly handle the same request, is the responsibility boundary clear?
- Would an exclusion resolve a real near-miss, or merely add noise?

Prefer natural descriptions of user intent to keyword stuffing.
Do not require a minimum word count, specific activation phrase, or list of file extensions when the scope is already clear.
A narrow skill can be useful without generalizing to unrelated tasks.

## Body and composition

- Is the information needed for the skill's purpose easy to find and precise enough to apply?
- Does the skill contribute useful domain knowledge or constraints rather than generic instructions an agent already knows?
- Are stable principles separated from task-specific orchestration when that distinction matters?
- Are ordering, error handling, output contracts, or examples specified where correctness depends on them?
- Does the instruction leave room for judgment where multiple approaches are valid?
- Could its assumptions conflict with user intent, trusted environment rules, or another relevant skill?

Do not require numbered steps, a workflow taxonomy, an output template, imperative prose, or error handling for a principles-only skill.
Recommend these only to address a concrete comprehension or execution risk.

## Information placement

- Does the entry point expose essential guidance and route readers to supporting detail when needed?
- Do linked files exist, and is their relevance apparent without opening every file?
- Is information duplicated in ways likely to drift or increase reading effort?
- Are evaluation prompts and expected answers kept out of normal execution context when they would contaminate a test?

Extra files, including a README, are not inherently invalid.
Judge whether each file serves its reader rather than enforcing a fixed directory layout.
Keep domain gotchas visible before the point where they prevent a predictable mistake.
