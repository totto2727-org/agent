---
name: share-test-design
description: Choose what evidence a test plan or QA report needs to support a claim.
---

# Test plans and evidence

For each material risk, name the requirement, the situation that could violate it, and an observation that distinguishes success from failure. Derive expectations from the promised behavior, not solely from what today's implementation does. If the target is genuinely unspecified, report that gap rather than inventing a threshold.

Choose the smallest check that can observe the claim. A local database can show that invalid input leaves no partial records. It cannot show that the deployed Worker is bound to the right database. If deployment access is unavailable, report the first result and mark the second claim unverified.

Prioritize failures that would be costly or hard to notice, such as duplicate writes on retry or a successful response before persistence. Separate planned cases from observations actually made. Link the evidence and state what it cannot establish; a count of passing tests does not close a coverage gap.

For implementing a maintained check, use [share-test](../share-test/SKILL.md#test-implementation-boundaries).
