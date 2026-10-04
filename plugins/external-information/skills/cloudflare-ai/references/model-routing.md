# Model selection

## LLM priority

1. For ordinary generation, coding, reasoning, and summarization, use OpenCode Go through the configured AI Gateway.
   Default to **`deepseek-v4.1-flash`**.
2. Choose another available OpenCode Go model only when the task demonstrably requires substantially higher accuracy.
   Establish that need from the task or observed failures, verify current availability and pricing, and bound the request.
3. Use a non-OpenCode-Go provider only when OpenCode Go is actually unavailable for the required request.
   A preference for another provider is not evidence of unavailability.
   Confirm the relevant availability or capability failure, then choose the lowest-cost adequate model from the user's configured, authorized routes.
   Explain the fallback and its cost before material spending; do not change accounts, credentials, or paid settings to force it.
4. Treat top-tier Claude and GPT models as exceptional, not routine fallbacks.
   Check current pricing, explain why cheaper models are inadequate, cap input/output tokens and calls, and ensure the user's authorization covers the expected cost.
   Do not escalate merely because a response is inconvenient or a confidence value is low.

## Decision Model selection

Typed Decision Models are the capability exception: OpenCode Go currently does not provide this interface.
Choose an appropriate configured `clef-flash`, `clef`, or `typesafe/jev` route by current cost, capabilities, and task accuracy rather than assuming one is always cheapest.
Do not send ordinary text-generation tasks to these routes.

Keep call budgets and batches small, reuse relevant results when freshness permits, and count Decision Model calls as paid work too.
Do not silently switch models, providers, or billing routes after authentication or billing failures.

## Sources

- [OpenCode Go](https://opencode.ai/docs/go/): current models, pricing, and availability.
- [Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/): credits and stored provider keys.
