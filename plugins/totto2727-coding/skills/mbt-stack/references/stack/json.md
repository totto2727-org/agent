# MoonBit JSON Boundaries

## Select a codec

| Contract                                                                       | Choice                           |
| ------------------------------------------------------------------------------ | -------------------------------- |
| Fixed-shape requests and responses                                             | Standard `FromJson` and `ToJson` |
| A wire contract that derivation cannot express                                 | Manual codec                     |
| Dynamic keys, irregular shapes, path diagnostics, or presence-sensitive fields | Lens                             |

When the contract distinguishes them, keep missing fields, explicit `null`, and supplied values distinct.
An optional value must not collapse those cases or force omitted request fields to serialize as `null`.

## Official Lens guidance

Use the locally installed [lens skill](https://github.com/totto2727-org/lens/blob/main/.agents/skills/lens/SKILL.md) when available.
Otherwise, use that official skill and its references, with the [API documentation](https://mooncakes.io/docs/totto2727/lens) and [repository](https://github.com/totto2727-org/lens) as fallbacks.
Use the consumer's resolved interface rather than examples from `main`.
If neither the interface nor official guidance is available, report the missing evidence instead of inventing Lens operations.

## Other input formats

Convert parser output to JSON only when the conversion keeps the necessary semantics.
Otherwise, convert the parser-owned value directly to a typed wire model.
Before infallible serialization, reject non-finite numbers and other values that JSON cannot represent in untrusted configuration.
A trusted adapter's abort behavior is not a recoverable decoding policy.
Use an owned wrapper when MoonBit's implementation rules prevent a foreign trait implementation for a foreign type.

## Path boundaries

Keep the selected typed path library instead of a second one.
For `totto2727/x/path`, use the [official API](https://mooncakes.io/docs/totto2727/x/path).
Use structural path joins, not text concatenation.
Keep typed paths until an external API needs text.
Normalize paths before path-form validation.
Use the invariant-preserving constructor after validation.
