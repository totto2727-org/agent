# Rust LLM Profile

Use Rig first for completions, agents, tools, embeddings, and provider clients.
Select only the crates and features necessary for the capability.
Make sure that the resolved Rig release has the necessary provider and streaming support.

Provider-profile resolution and optional Rig adapters do not initialize application-owned prompts, tools, or the execution runtime.
Keep those responsibilities separate when a profile library is present.
Token streaming and workflow progress are different timelines unless they describe the same application operation.

Select [graph-flow](../knowledge/capabilities.md#workflows-with-graph-flow) only for code-defined workflows, not merely because Rig is present.
Use [validation](../knowledge/capabilities.md#serde-garde-then-domain-construction) for model boundaries and [tracing guidance](../knowledge/capabilities.md#logging-with-tracing) for payload exposure risks.

## Official sources

- [Rig documentation](https://rig.rs/docs)
- [Rig repository and releases](https://github.com/0xPlaygrounds/rig)
