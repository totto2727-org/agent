# MoonBit Markdown Tests

> Document type: concrete MoonBit test implementation guidance.

## File format

Use `.mbt.md` only when the task explicitly calls for literate executable documentation or rewriting an existing black-box test as such. Ordinary unit and integration tests follow [`file-layout.md`](file-layout.md). White-box tests remain `_wbtest.mbt` because Markdown tests cannot provide the required white-box visibility.

Name the file after its implementation, for example `xy.mbt.md`, not `xy_test.mbt.md`.

For checked Markdown syntax, use the stack’s [official MoonBit guidance](../../mbt-stack/SKILL.md) and the [MoonBit testing guide](https://docs.moonbitlang.com/en/latest/language/tests.html). Apply the [async test setup](execution.md#async-tests) when the example needs the async runtime.

Group executable examples by the public behavior they explain. Use the same [case names](names.md) and [assertion policy](assertions.md#direct-results-and-raised-errors) as ordinary tests. Use [share-test-design](../../share-test-design/SKILL.md) ([source](https://github.com/totto2727-org/agent/blob/main/plugins/totto2727-principle/skills/share-test-design/SKILL.md)) when deciding which cases to show. A diagram or API index is useful only when it helps readers navigate several cases.
