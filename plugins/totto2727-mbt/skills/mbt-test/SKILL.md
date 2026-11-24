---
name: mbt-test
description: Place MoonBit regression tests and executable examples in workspace packages.
---

# MoonBit test placement

Keep tests of one implementation beside it. Use a separate `src/test/` package when the contract crosses packages or a process boundary, as in [Model's integration suite](https://github.com/totto2727-org/model/tree/main/src/test). Test through the consumer's public imports rather than widening production visibility for a fixture.

When a public usage example is part of the contract, keep it executable in the package's `.mbt.md` documentation instead of copying it into a second test. Verify that the test run actually includes that example. A passing suite with no documentation cases says nothing about the README.

For runner options, assertion APIs, or test syntax, use the installed [moonbit-orientation](https://github.com/moonbitlang/skills/tree/master/skills/moonbit-orientation) skill and the [official testing guide](https://docs.moonbitlang.com/en/latest/language/tests.html).
