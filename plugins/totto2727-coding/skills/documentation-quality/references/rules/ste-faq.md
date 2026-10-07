# Published STE FAQ guidance

These checks derive from the [official FAQ](https://www.asd-ste100.org/STE_faq.html), not an invented reconstruction of Issue 9.
Read the [coverage record](../coverage.md) for the unimplemented standard requirements.
Apply them to prose, not executable syntax, identifiers, exact output, or protected quotations.
Required template structure remains unchanged.

## Direct procedural instructions

Rule: `ste-faq-procedural-instructions`.
Use the imperative form for an instruction the reader must perform.

- Anti-pattern: “The configuration file should then be opened.”
- Improvement: “Open the configuration file.”

A description of automatic behavior is not a work instruction.
“The server opens the file” does not require an imperative rewrite.
An exact quotation or unavailable normative exception requires review rather than a guessed waiver.

## Active descriptions

Rule: `ste-faq-active-description`.
Use active voice in descriptions; the FAQ permits passive voice when the agent is unknown.

- Anti-pattern: “The request is validated by the server.”
- Improvement: “The server validates the request.”

Do not invent an actor to eliminate a passive construction.
An omitted actor is not necessarily unknown; establish what the local evidence says.
If that evidence cannot establish the actor, keep the uncertainty visible.

## Necessary conditions before action

Rule: `ste-faq-condition-first`.
Put a condition the reader must know before action before its dependent instruction.

- Anti-pattern: “Restart the worker if you changed its configuration.”
- Improvement: “If you changed the worker configuration, restart the worker.”

This is not a demand to move every conditional clause to the front.
Judge whether the condition controls an action and must be known before that action.
Preserve any verified order or exact executable command.

## One topic per sentence

Rule: `ste-faq-one-topic`.
Keep each prose sentence to one coherent topic.

- Anti-pattern: “Save the settings, and the package also supports a different database.”
- Improvement: “Save the settings.” Move the unrelated database fact to its relevant explanation within the permitted structure.

A necessary condition, consequence, or explanation can belong to the same topic.
A conjunction alone does not prove a violation.
Do not infer word limits, paragraph limits, or detailed counting rules from this check.
