# Browser UI: Effront and React

For an interactive Cloudflare product, use Effront with React Server Components for server-rendered views, React client components for browser interactions, and the Effront Vite and Alchemy adapters for the target Worker. In [Projektor's frontend](https://github.com/totto2727-org/projektor/blob/4efeefc30821341ba1fb1990e814134f5057d546/workers/frontend.ts), the server reads through a Core Worker binding. Do not expose that binding to browser code. For Effront-specific APIs and adapter constraints, consult the [library-owned skill](https://github.com/totto2727-org/effront/blob/main/skills/effront/SKILL.md).

Both [Projektor](https://github.com/totto2727-org/projektor/blob/4efeefc30821341ba1fb1990e814134f5057d546/package.json) and [Flowdeck's workflow UI design](https://github.com/totto2727-org/flowdeck/blob/344353786b1473ace559d0d07afc69c68baeb19c/package.json) use Base UI and Tailwind.
Projektor uses TanStack Form for forms and CodeMirror for editing; a workflow inspector can render the run graph and events without either.
For a custom Enter-to-submit interaction, use the [modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance/blob/v0.0.186/skills/modern-web-guidance/SKILL.md) skill's [IME guide](https://github.com/GoogleChrome/modern-web-guidance/blob/v0.0.186/skills/modern-web-guidance/guides/forms/ime-safe-enter-submit.md).

Exercise browser navigation and user-visible mutations with Playwright. Use Worker integration tests for the service binding and storage. A component test alone does not exercise either boundary.
