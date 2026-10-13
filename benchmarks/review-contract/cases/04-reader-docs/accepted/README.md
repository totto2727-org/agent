# Lumen Note

Lumen Note summarizes a local note for a support handoff. It does not diagnose incidents.
Use Node 24. No packages, account, or credentials are needed.
From this directory, summarize the sample UTF-8 file:

```sh
node cli.mjs --local note.txt
```

Output:

```json
{ "lines": 4, "tags": ["handoff", "urgent"] }
```

`lines` counts nonblank lines, including tag lines. Lines beginning with `#` are tags.
`tags` removes duplicates and keeps the order in which tags first appear.
Replace `note.txt` with your local file path. Files are read as UTF-8 and are never uploaded.
