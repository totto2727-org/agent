---
name: cloudflare-ai
description: >-
  Call LLMs and typed Decision Models with curl through Cloudflare AI Gateway or Workers AI. Use for inference, implementation authentication and endpoints, and model selection, not Cloudflare Browser Run.
compatibility: Bash, curl with --fail-with-body, jq, shasum for Decision Model cache keys, and configured Cloudflare environment variables.
---

# Cloudflare AI

Use this skill for inference through the configured Cloudflare AI Gateway or Workers AI.
Connection credentials are already available as environment variables.

## Select a model

Follow [model selection](references/model-routing.md) for model priority, cost limits, and fallback conditions.

## Invoke the selected model

- **LLM**: use [LLM requests](references/llm.md) for the generic chat-compatible request, then its OpenCode Go specialization.
- **Decision Model**: use [Decision Model requests](references/decision-models.md) for native Clef and universal Jev envelopes, direct Workers AI, and typed results.
- Use [connection and records](references/connection.md) for environment variables, credential handling, billing failures, and request/response storage.

Use [decision-model](../decision-model/SKILL.md) to design typed judgments and application acceptance criteria.
Its design guidance does not change this skill's connection or execution conventions.
