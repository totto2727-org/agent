// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to inspect or write files through the host filesystem.
import fs from "node:fs";
// oxlint-disable-next-line rules/no-node-imports -- Statechart's native fixtures use this built-in to resolve paths using the host platform's filesystem conventions.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
import { visitItems } from "#statechart/ir.ts";
import { CHECK_PASSED, COMMAND_ERROR, RULE_BROKEN, copyCase, corpus, read, run } from "./cli-fixtures.ts";

visitItems([
  [
    "a misspelled first keyword",
    "\\* The rules\nINVARIENT NeverLocked\nSPECIFICATION Spec\n",
    /^TLC refuses .*Login\.cfg at line 2\. It was expecting a keyword, but did not find it\.$/mu,
  ],
  [
    "a CHECK_DEADLOCK value in lower case",
    "SPECIFICATION Spec\nINVARIANT TypeOK\nCHECK_DEADLOCK false\n",
    /Login\.cfg at line 3\. It was expecting TRUE or FALSE, but did not find it\./u,
  ],
  [
    "an ALIAS line",
    "SPECIFICATION Spec\nINVARIANT TypeOK\nVIEW vars\nALIAS Pretty\n",
    /Login\.cfg at line 4\. It was expecting a keyword, but did not find it\./u,
  ],
  [
    "a comma between invariants",
    "SPECIFICATION Spec\nINVARIANT TypeOK, NeverLocked\n",
    /Login\.cfg at line 2\. The invariant , specified in the configuration file is not defined in the specification\./u,
  ],
  [
    "a keyword two times",
    "SPECIFICATION Spec\nINVARIANT TypeOK\nSPECIFICATION Spec\n",
    /Login\.cfg at line 3\. The keyword SPECIFICATION appeared twice\./u,
  ],
  [
    "a constant value that TLC cannot read",
    "CONSTANT N = -1\nSPECIFICATION Spec\n",
    /Login\.cfg at line 1\..*"-"/u,
  ],
  [
    "both SPECIFICATION and NEXT",
    "SPECIFICATION Spec\nNEXT Next\nINVARIANT TypeOK\n",
    /^TLC refuses the config .*Login\.cfg\. The configuration file cannot specify both INIT\/NEXT and SPECIFICATION fields\.$/mu,
  ],
  [
    "no SPECIFICATION and no INIT",
    "\\* The rules\nINVARIANT TypeOK\n",
    /^TLC refuses the config .*Login\.cfg\. The configuration file did not specify the initial state predicate\.$/mu,
  ],
  [
    "an operator constant with no arguments",
    "CONSTANT f() = 1\nSPECIFICATION Spec\n",
    /^TLC refuses .*Login\.cfg at line 1\. TLC gives no reason here\. An operator's arguments are one or more values in \( \), with commas between them\.$/mu,
  ],
  [
    "operator arguments with no closing parenthesis",
    "SPECIFICATION Spec\n\nCONSTANT f(1, 2 = 3\n",
    /^TLC refuses .*Login\.cfg at line 3\. TLC gives no reason here\. An operator's arguments are one or more values in \( \), with commas between them\.$/mu,
  ],
  [
    "a CONSTANT keyword on its own line before operator arguments with no closing parenthesis",
    "SPECIFICATION Spec\nCONSTANT\nf(1, 2\n= 3\n",
    /^TLC refuses .*Login\.cfg at line 2\. TLC gives no reason here\. An operator's arguments are one or more values in \( \), with commas between them\.$/mu,
  ],
  [
    "a comma invariant before a CHECK_DEADLOCK value in lower case",
    "SPECIFICATION Spec\nINVARIANT ,\nCHECK_DEADLOCK false\n",
    /Login\.cfg at line 3\. It was expecting TRUE or FALSE, but did not find it\./u,
  ],
  [
    "a comment that does not end",
    "SPECIFICATION Spec\nINVARIANT TypeOK\n(* The view\nVIEW vars\n",
    /Login\.cfg at line 3\..*\bcomment\b/u,
  ],
  [
    "CHECK_DEADLOCK FALSE in a comment that does not end",
    "INVARIANT TypeOK\nSPECIFICATION Spec\n(* CHECK_DEADLOCK FALSE\n",
    /Login\.cfg at line 3\. A comment starts here and does not end\./u,
  ],
  [
    "a no-break space before CHECK_DEADLOCK FALSE",
    "SPECIFICATION Spec\nINVARIANT TypeOK\n\u00A0CHECK_DEADLOCK FALSE\n",
    /Login\.cfg at line 3\. It cannot read the character "\u00A0" \(U\+00A0\) outside a string\./u,
  ],
  [
    "a line separator before CHECK_DEADLOCK FALSE",
    "SPECIFICATION Spec\nINVARIANT TypeOK\u2028CHECK_DEADLOCK FALSE\n",
    /Login\.cfg at line 2\. It cannot read the character "\u2028" \(U\+2028\) outside a string\./u,
  ],
  [
    "a byte order mark",
    "\uFEFFSPECIFICATION Spec\nINVARIANT TypeOK\n",
    /Login\.cfg at line 1\. The file starts with a byte order mark\. Save it as UTF-8 without one\.$/mu,
  ],
] satisfies [string, string, RegExp][], ([what, config, words]) => {
  // oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
  test(`a config with ${what} stops the command with exit 2 before TLC runs`, async () => {
    const dir = await copyCase("Login", async (copiedDirectory) => { await fs.promises.writeFile(path.join(copiedDirectory, "Login.cfg"), config); });
    const result = await run(dir);
    assert.equal(result.status, COMMAND_ERROR);
    assert.match(result.stderr, words);
    assert.deepEqual(result.configs, {});
    assert.deepEqual(result.files, []);
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a nested comment hides all of its text, as in TLC", async () => {
  const dir = await copyCase("Login", async (copiedDirectory) => {
    const file = path.join(copiedDirectory, "Login.cfg");
    await fs.promises.writeFile(file, `(* Off: (* old *) CHECK_DEADLOCK FALSE *)\n${await read(file)}`);
  });
  const result = await run(dir);
  assert.equal(result.status, CHECK_PASSED);
  assert.equal(result.report, await read(path.join(corpus, "Login", "report.md")));
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a string constant keeps the keywords and comment markers in it", async () => {
  const dir = await copyCase("TwoPhase", async (copiedDirectory) =>
    { await fs.promises.writeFile(
      path.join(copiedDirectory, "TwoPhase.cfg"),
      'CONSTANT RM = {"INVARIANT (*", "\\\\* r2"}\nSPECIFICATION TPSpec\nINVARIANT TPTypeOK TCConsistent\n',
    ); },
  );
  const result = await run(dir);
  assert.equal(result.status, RULE_BROKEN);
  assert.equal(result.report, await read(path.join(corpus, "TwoPhase", "report.md")));
  assert.match(result.configs.ChartRun, /^CONSTANT RM = .*"INVARIANT \(\*".*"\\\\\* r2"/mu);
  assert.deepEqual(result.configs.ChartRun.match(/^INVARIANT.*$/gmu), ["INVARIANT ChartMark"]);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("TYPE and TYPE_CONSTRAINT are config keywords, as in TLC", async () => {
  const dir = await copyCase("Login", async (copiedDirectory) =>
    { await fs.promises.writeFile(
      path.join(copiedDirectory, "Login.cfg"),
      "SPECIFICATION Spec\nINVARIANT TypeOK\nTYPE TypeOK\nTYPE_CONSTRAINT TypeOK\nVIEW vars\n",
    ); },
  );
  const result = await run(dir);
  assert.equal(result.status, CHECK_PASSED);
  assert.equal(result.report, await read(path.join(corpus, "Login", "report.md")));
  assert.match(result.configs.ChartRun, /^TYPE TypeOK$/mu);
  assert.match(result.configs.ChartRun, /^TYPE_CONSTRAINT TypeOK$/mu);
});
