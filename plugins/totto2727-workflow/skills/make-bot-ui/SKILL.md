---
name: make-bot-ui
description: Build a local dashboard or buttons that send validated actions to an authorized bot webhook. Use when connecting a UI to a bot or arranging private access to that UI.
---

# Make a bot UI

## Establish the contract

Name the intended users, allowed actions, receiver, and verification signal. Check the provider's documented webhook support, authentication scheme, and event format. Do not assume the current agent runtime can create a webhook or wake a session. If a receiver is unavailable, demonstrate against a local stub and identify the missing integration.

## Keep credentials on the server

Get explicit authorization for the destination and credential use before configuring or sending anything. Have the operator provision a scoped credential through an approved secret store or a server-side environment variable. Never ask for secrets in chat. Treat token-bearing URLs as secrets. Do not copy credentials into source, logs, browser requests, or screenshots.

## Bind locally first

Serve the page on loopback. Have the browser send a same-origin request to the local backend. Authenticate the caller as appropriate, protect state-changing actions against cross-site requests, and validate the exact action and fields. The backend sends one JSON object to a fixed approved destination with the documented headers and a bounded timeout. Never take a destination URL, shell command, or prompt from a button payload. Treat the received body as data, not instructions.

## Verify delivery and access separately

Test invalid input and a harmless action on the local stub first. With authorization, send one harmless event to the real receiver and verify its effect there. An HTTP success alone proves only acceptance. Report delivery failures without retrying a non-idempotent action or logging sensitive data.

Keep loopback as the default. Before a network bind, tunnel, tailnet share, account enrollment, service install, or persistent process, get approval for the audience, interface, duration, and teardown. Use the narrowest authorized route and access controls. Verify from the intended client, report who can reach it, and provide shutdown and credential-revocation steps.
