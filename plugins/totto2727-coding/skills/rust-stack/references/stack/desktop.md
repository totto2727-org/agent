# Rust Desktop Profile

Use this profile for developers implementing native GUI applications with GPUI.
The [shared GUI policy](../../../share-stack/SKILL.md#select-a-gui-stack) selects GPUI across languages.
This profile owns native Rust implementation details, not a claim that another language has a GPUI binding.
Do not invent cross-language bindings or move existing GUI code during unrelated maintenance.
Apply the [shared Rust stack](share.md) and verify GPUI APIs and platform requirements against the selected source revision.

## Native composition

Keep the executable composition root responsible for application setup, windows, platform integration, service construction, and shutdown.
Keep GPUI view and entity state at the UI boundary and expose typed commands and events to application services.
Give each state value one owner rather than mirroring mutable domain state across independent UI and background stores.
Keep rendering and event handlers responsive by moving blocking I/O and long-running work off the UI event loop.
Return background results through the mechanisms supported by the selected GPUI version.
Do not assume a background thread can mutate UI state directly.

Use Tokio only when background I/O or another selected dependency requires it.
Keep GPUI's scheduling and the Tokio runtime distinct, with explicit ownership and a verified handoff rather than assumed executor interoperability.
Own each task and subscription, cancel work when its window or operation ends, and observe task failures.
Prevent a stale operation from overwriting the state of a newer operation or a closed window.
Use the [LLM profile](llm.md) for provider work and [capability knowledge](../knowledge/capabilities.md) for validated configuration and safe telemetry.

## Platform boundaries and verification

Declare supported platforms instead of inferring portability from a successful host build.
Keep native assets, resources, permissions, and platform APIs behind explicit boundaries.
On macOS, verify the actual bundle's resource lookup, permissions, native libraries, and launch path rather than treating a Cargo build as a complete app bundle.
Keep signing, notarization, and distribution credentials outside source examples and run those operations only when authorized.
Validate window lifecycle, background failure, cancellation, and stale-result handling with [rust-test](../../../rust-test/SKILL.md) where practical.
Smoke-test the actual packaged GUI on each promised platform and state any unverified platform behavior.

## Official sources

- [GPUI site](https://www.gpui.rs/)
- [GPUI source and examples](https://github.com/zed-industries/zed/tree/main/crates/gpui)
- [GPUI crate documentation](https://docs.rs/gpui/latest/gpui/)
- [Tokio graceful shutdown](https://tokio.rs/tokio/topics/shutdown)
