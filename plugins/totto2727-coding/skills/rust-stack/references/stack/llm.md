# Rust LLM Profile

Use this profile for developers integrating completions, agents, tools, embeddings, or provider clients.
Use Rig as the first choice for these capabilities, with the smallest crate and feature set that meets the requirement.
Apply the [shared Rust stack](share.md) for dependency compatibility and runtime configuration.
Verify provider support, streaming behavior, tool APIs, and release notes against the selected Rig version before implementation.
Do not infer a current API from examples for another release.

## Ownership and composition

Keep provider clients and provider-specific request types behind an application service.
Expose typed application commands, results, and events to CLI, desktop, and workflow callers.
Let the application composition root own the runtime, credentials, prompt and tool construction, client lifetime, and shutdown.
When an existing configuration or provider-profile library is used, keep profile resolution and optional Rig adapters separate from application-owned prompts, tools, and execution runtime.
Do not assume that resolving a provider profile initializes the application's execution environment.

Treat model output and tool arguments as untrusted boundary input.
Validate structural and semantic requirements before domain construction, and authorize side-effecting tools independently of model selection.
Use [Serde and garde conventions](../knowledge/capabilities.md#serde-garde-then-domain-construction) for typed boundaries.
Keep parse, validation, provider, timeout, tool, and cancellation errors distinct where recovery differs.
Bound requests and tool concurrency, and set explicit timeout, retry, and output-size policies.
Retry only when the operation's side-effect contract permits it.

## Streaming and observability

Keep token streaming and workflow execution progress as distinct timelines unless they represent the same coherent application boundary.
Convert provider events into typed application events before exposing them to the UI or workflow layer.
Handle cancellation and partial results explicitly rather than treating a dropped consumer as successful completion.
Use [graph-flow conventions](../knowledge/capabilities.md#workflows-with-graph-flow) only when code-defined workflow execution is needed.
Use [tracing conventions](../knowledge/capabilities.md#logging-with-tracing) for safe operational metadata.
Do not log prompts, tool arguments, retrieved documents, credentials, or model responses by default.
Allowlist safe identifiers, model names, timing, token counts, and failure categories only when operationally useful.
Test failure conversion, malformed tool input, cancellation, and streaming boundaries with [rust-test](../../../rust-test/SKILL.md).
Keep credentialed provider smoke tests separate from ordinary tests and do not claim provider compatibility from mocked results alone.

## Official sources

- [Rig documentation](https://rig.rs/docs)
- [Rig repository and release guidance](https://github.com/0xPlaygrounds/rig)
- [Serde data model](https://serde.rs/data-model.html)
