# @totto2727/fp Installation

Read this reference only when maintaining a repository that uses `@totto2727/fp` or when its adoption is explicitly required.
The package is not a prerequisite for generic Effect code.

## Installation

Check the selected package release's published exports, peer dependencies, and supported runtimes before adding it.
Resolve a compatible Effect version under [JS dependency safeguards](../../js-stack/references/stack/share.md#dependency-versions).
Do not assume `effect@beta` is a permanent peer requirement or bypass release-age rules to satisfy an old example.

### Node.js

Use the repository's Vite+ dependency interface and existing dependency manager to add the verified JSR package and required peers.
Preserve its authoritative lockfile.

### Deno

Preserve the repository's Deno/JSR profile and use its documented dependency entry points.
Do not change supported consumer runtimes merely to apply the pnpm default.
