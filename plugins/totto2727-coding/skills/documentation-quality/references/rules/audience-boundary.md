# Audience boundary

Rule: `audience-boundary`.
This supplements STE with a reader-task boundary.

Distinguish beginner users, intermediate users, advanced users, and developers of the subject itself.
Split subject developers into contributors and maintainers only when their tasks need different documentation.
A programmer who uses a library is its user, not its developer.
An advanced user can need internal knowledge without contributing to the project.

## Finding

A beginner installation page explains the framework's internal module graph before showing how to create a project.
That mechanism is unrelated to the beginner's immediate task.
Keep the installation action and observable result; identify the advanced or contributor route through a clearly described link.
Do not require the beginner to filter out internal development instructions.

## Indispensable knowledge

Keep public interfaces, security requirements, serialization constraints, and resource-lifetime behavior when correct use depends on them.
Explain the necessary behavior, conditions, and consequences first.
Include its underlying mechanism only when those facts are insufficient for the task.
Do not equate every technical word with an internal detail.

Declare the intended group in review metadata.
Do not demand a boilerplate audience section, all reader groups on each page, or changes to required template headings.
If the task or need for internal knowledge cannot be established locally, return `insufficient_context`.
