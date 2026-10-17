# Lumen Note

Lumen Note is a local note summarizer for support handoffs. It is not an incident diagnosis tool.
The engine started as an array experiment, then became a Set-based pipeline, and might eventually support a generic platform.
Compared with hosted workflow platforms, its architectural layering is less ambitious.
Install Node 24. Ensure that Node 24 is installed before continuing. There is no package installation.

```sh
node cli.mjs --remote note.txt
```

The program reads UTF-8 files locally and does not upload them. It reports a line count and ordered unique tags.
Blank lines are ignored. Lines beginning with `#` are tags.
