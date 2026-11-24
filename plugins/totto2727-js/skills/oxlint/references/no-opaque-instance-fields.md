# rules/no-opaque-instance-fields

A class extending a recognized Effect `Schema.Opaque` cannot add instance fields, methods, or a constructor. Keep the opaque class empty when it only represents a validated value.

Move an operation such as `value.format()` to a function that takes the opaque value. Use a static member only for class-level behavior. If the value needs more data, model that data in the schema rather than attaching fields to the class.

[Implementation](https://github.com/totto2727-org/oxlint/blob/main/src/upstream/effect/no-opaque-instance-fields.ts) · [Acceptance cases](https://github.com/totto2727-org/oxlint/blob/main/src/upstream/effect/rules.test.ts)
