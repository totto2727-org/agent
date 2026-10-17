# Simplify for the reader

Lumen Note is a local note summarizer for support staff preparing a handoff, not a general automation platform.
Rewrite the paired English and Japanese consumer guides so a support colleague can run the first example and understand the result without reading maintenance instructions.
Keep the product name and purpose, Node 24 prerequisite, local-file input, line count, ordered unique tags, no-upload guarantee, and one runnable command using the supplied note.txt in each guide.
Show the actual returned output in a fenced `json` block. Use a single-line `node cli.mjs` example from the repository root.
Correct the non-working remote example to the supported local interface.
Explain tags as lines beginning with `#`, and explain that blank lines do not contribute to the line count.
Remove the implementation-history detour, duplicated setup guidance, and irrelevant platform comparison. Preserve useful caveats: this does not diagnose incidents, and files are read as UTF-8.
Do not change the program or sample note. No word-count or token-count target applies. Judge clarity by the reader's ability to perform the task, not merely by shorter text.
