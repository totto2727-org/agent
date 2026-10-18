# MoonBit JSON Boundaries

- Audience: advanced consumers implementing JSON and path adapters.
- Codec selection: [MoonBit baseline](../stack/share.md#capability-additions).

- Presence-sensitive contracts: distinguish missing fields, explicit `null`, and supplied values.
- Optional values must not collapse these cases or encode omitted request fields as `null`.

## Official Lens guidance

- Prefer the installed official [lens skill](https://github.com/totto2727-org/lens/blob/main/.agents/skills/lens/SKILL.md).
- Fallback: its upstream skill and [Lens API](https://mooncakes.io/docs/totto2727/lens).
- Use the consumer's resolved interface, not examples from `main`.

## Other input formats

- Convert parser output to JSON only if semantics survive.
- Otherwise convert directly to a typed wire model.
- Reject non-finite numbers and other non-JSON values before infallible serialization of untrusted configuration.
- Do not use a trusted adapter's abort behavior as recoverable decoding.
- Use an owned wrapper when MoonBit prevents foreign trait implementations for foreign types.

## Path boundaries

- Keep the selected typed path library, such as an existing [totto2727/x/path](https://mooncakes.io/docs/totto2727/x/path) dependency.
- Structural joins, not text concatenation.
- Typed paths until an external API requires text.
- Normalize before path-form validation.
- Use the invariant-preserving constructor after validation.
