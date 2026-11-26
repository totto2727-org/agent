// oxlint-disable-next-line rules/no-node-imports -- Statechart's Node suite uses native assertions for chart and subprocess results.
import assert from "node:assert/strict";
// oxlint-disable-next-line rules/no-node-imports -- Statechart runs these fixtures with Node's test runner as part of the standalone skill.
import { test } from "node:test";
import { SWITCH_ON, draw, fixtureText, graphOf, numberedState } from "./chart-fixtures.ts";

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a label codes only the characters that Mermaid reads as syntax, so TLA+ values stay as TLC prints them", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, {
    state: (variables) => (variables.n === SWITCH_ON ? 'x: "1";\nnext' : "a <b> #2"),
    step: () => 'say: <<1, "a">> :> [k |-> {}] @@ 2..3',
  });
  assert.match(chart, /^ {2}s\d+: a #60;b> #35;2$/mu);
  assert.match(chart, /^ {2}s\d+: x: "1"#59; next$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: say: <<1, "a">> :> \[k \|-> \{\}\] @@ 2\.\.3$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a label with %% stays text and cannot open a Mermaid directive", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, {
    state: (variables) => (variables.n === SWITCH_ON ? "%%{init: {}}%%" : "a %%{ b"),
    step: () => "%% go",
  });
  assert.doesNotMatch(chart, /%%/u);
  assert.match(chart, /^ {2}s\d+: a #37;%\{ b$/mu);
  assert.match(chart, /^ {2}s\d+: #37;%\{init: \{\}\}#37;%$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: #37;% go$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("each line break in a label or a colors key is a space, so it cannot start a chart line", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, {
    colors: { Open: "blue", "Shut\r  s99: Ghost state": "pink" },
    group: (variables) => (variables.n === SWITCH_ON ? "Shut\r  s99: Ghost state" : "Open"),
    state: (variables) => (variables.n === SWITCH_ON ? "b\r\n\r\v\f\u0085\u2028\u2029\tc" : "a"),
    step: () => "go\r  s9: Ghost",
  });
  assert.doesNotMatch(chart, /[\r\v\f\u0085\u2028\u2029\t]/u);
  assert.match(chart, /^ {2}s\d+: b {9}c$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: go {3}s9: Ghost$/mu);
  assert.match(chart, /^ {4}lg1: Shut {3}s99: Ghost state$/mu);
  assert.doesNotMatch(chart, /^\s*s9{1,2}:/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a label of only white space or with a lone surrogate still has text in the chart", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, {
    state: (variables) => (variables.n === SWITCH_ON ? "a\uD800b" : "\t"),
    step: () => " ",
  });
  assert.match(chart, /^ {2}s\d+: #32;$/mu);
  assert.match(chart, /^ {2}s\d+: a#65533;b$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: #32;$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("NUL and C1 controls in a label are left out, since a browser draws their character references as other characters", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, {
    state: (variables) => (variables.n === SWITCH_ON ? ["P\0\u0080", "C\u00004Dynamic"] : "\0\u009F"),
    step: () => "a\0\u0080b\u0085c\u009Fd",
  });
  assert.doesNotMatch(chart, /[\0\u0080-\u009F]|#0;|#1[2-5]\d;/u);
  assert.match(chart, /^ {2}s\d+: #32;$/mu);
  assert.match(chart, /^ {2}state "P" as s\d+ \{$/mu);
  assert.match(chart, /^ {4}s\d+: C#52;Dynamic$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: ab cd$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a label puts a word joiner inside ﬂ° and ¶ß, since Mermaid decodes a label's text a second time", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, {
    state: (variables) => (variables.n === SWITCH_ON ? ["ﬂ\0°lt¶ß", "x"] : "ﬂ°°65¶ßstateß"),
    step: () => "ﬂ ° ¶ ß",
  });
  assert.match(chart, /^ {2}s\d+: ﬂ#8288;#176;#176;65#182;#8288;ßstateß$/mu);
  assert.match(chart, /^ {2}state "ﬂ#8288;#176;lt#182;#8288;ß" as s\d+ \{$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: ﬂ #176; #182; ß$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test('a label puts a word joiner inside marker-end=", since Mermaid rewrites marker-end="url(…# in the drawn SVG', () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, {
    state: (variables) => (variables.n === SWITCH_ON ? ['marker-end="url(p#q', "x"] : 'marker-end="url(a#b'),
    step: () => 'a="b" = "c"',
    title: 'marker-end="url(a#b',
  });
  assert.match(chart, /^title: "marker-end=ﬂ°°8288¶ß\\"url\(aﬂ°°35¶ßb"$/mu);
  assert.match(chart, /^ {2}s\d+: marker-end=#8288;"url\(a#35;b$/mu);
  assert.match(chart, /^ {2}state "marker-end=#8288;#34;url\(p#35;q" as s\d+ \{$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: a="b" = "c"$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a parent or region name with [[fork]], [[join]], or [[choice]] stays text", () => {
  const nested = graphOf(
    [
      ["x", { n: 0 }, true],
      ["y", { n: 1 }],
    ],
    [["x", "y", "Go"]],
  );
  const parents = draw(nested, {
    state: (variables) => [["a [[fork]]", "[[JOIN]]"][Number(variables.n)], "In"],
  }).chart;
  assert.match(parents, /^ {2}state "a #91;\[fork\]\]" as s\d+ \{$/mu);
  assert.match(parents, /^ {2}state "#91;\[JOIN\]\]" as s\d+ \{$/mu);
  const parallel = graphOf(
    [
      ["s0", { x: 0, y: 0 }, true],
      ["s1", { x: 1, y: 0 }],
    ],
    [["s0", "s1", "GoX"]],
  );
  const regions = draw(parallel, {
    // oxlint-disable-next-line eslint/sort-keys -- This fixture assigns the escaped region r0 by declaring it first.
    state: (variables) => ({ "[[choice]]": `X${fixtureText(variables.x)}`, Other: `Y${fixtureText(variables.y)}` }),
  }).chart;
  assert.match(regions, /^ {4}state "#91;\[choice\]\]" as r0 \{$/mu);
  assert.doesNotMatch(parents + regions, /\[\[/u);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a label with C4Container, C4Component, C4Dynamic, or C4Deployment keeps the chart a state diagram", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, {
    state: (variables) => (variables.n === SWITCH_ON ? ["C4Component", "C4Deployment"] : "aC4Dynamic"),
    step: () => "C4Container C4Context",
  });
  assert.doesNotMatch(chart, /C4(?:Container|Component|Dynamic|Deployment)/u);
  assert.match(chart, /^ {2}s\d+: aC#52;Dynamic$/mu);
  assert.match(chart, /^ {2}state "C#52;Component" as s\d+ \{$/mu);
  assert.match(chart, /^ {4}s\d+: C#52;Deployment$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: C#52;Container C4Context$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a title with < cannot open an HTML tag that rewrites the chart's quotes", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const { chart } = draw(graph, { state: (variables) => ["P", `S${fixtureText(variables.n)}`], title: "<a=" });
  assert.doesNotMatch(chart, /</u);
  assert.match(chart, /^title: "ﬂ°°60¶ßa="$/mu);
  assert.match(chart, /^ {2}state "P" as s\d+ \{$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("the title writes each character outside the allow list in the form Mermaid decodes in a title", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
    ],
    [["s0", "s1", "Go"]],
  );
  const title = (titleText: string): string | undefined =>
    /^---\ntitle: (?<title>.*)\n---\n/u.exec(draw(graph, { state: numberedState, title: titleText }).chart)?.groups?.title;
  assert.equal(title("Queue<T> for AT&T"), '"Queueﬂ°°60¶ßT> for ATﬂ°°38¶ßT"');
  assert.equal(title("ﬂ°°65¶ß"), '"ﬂﬂ°°8288¶ßﬂ°°176¶ßﬂ°°176¶ß65ﬂ°°182¶ßﬂ°°8288¶ßß"');
  assert.equal(title('a\0b\u0080\n"c"'), String.raw`"ab \"c\""`);
  const blank = draw(graph, { state: numberedState, title: "\0\0" }).chart;
  assert.doesNotMatch(blank, /\0|^---$|^title:/mu);
  assert.match(blank, /^stateDiagram-v2$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("labels write the space between direction and LR, RL, TB, or BT as #32;", () => {
  const graph = graphOf(
    [
      ["s0", { n: 0 }, true],
      ["s1", { n: 1 }],
      ["s2", { n: 2 }],
      ["s3", { n: 3 }],
    ],
    [
      ["s0", "s1", "Turn"],
      ["s1", "s2", "Back"],
      ["s2", "s3", "Go"],
    ],
  );
  const steps: Record<string, string> = {
    Back: "back direction rl",
    Go: "go",
    Turn: "turn direction LR",
  };
  const { chart } = draw(graph, {
    state: (variables) =>
      ["Idle", "Facing direction TB", "Redirection\tlrx", "Up DIRECTION  BT"][Number(variables.n)],
    step: (actionName) => steps[actionName],
  });
  assert.doesNotMatch(chart, /direction\s+(?:LR|RL|TB|BT)/iu);
  assert.match(chart, /^ {2}s\d+: Facing direction#32;TB$/mu);
  assert.match(chart, /^ {2}s\d+: Redirection#32;lrx$/mu);
  assert.match(chart, /^ {2}s\d+: Up DIRECTION#32;BT$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: turn direction#32;LR$/mu);
  assert.match(chart, /^ {2}s\d+ --> s\d+: back direction#32;rl$/mu);
});

// oxlint-disable-next-line typescript/no-floating-promises -- Statechart's Node test runner owns this registration and observes its Promise.
test("a region named __proto__ is a region like any other", () => {
  const graph = graphOf(
    [
      ["s0", { x: 0, y: 0 }, true],
      ["s1", { x: 1, y: 0 }],
      ["s2", { x: 0, y: 1 }],
    ],
    [
      ["s0", "s1", "GoX"],
      ["s0", "s2", "GoY"],
    ],
  );
  const { chart } = draw(graph, {
    state: (variables): unknown => JSON.parse(`{"__proto__": "X${fixtureText(variables.x)}", "Other": "Y${fixtureText(variables.y)}"}`),
  });
  assert.match(chart, /^ {4}state "#95;#95;proto#95;#95;" as r0 \{$/mu);
  assert.match(chart, /^ {6}s0 --> s1: GoX \[when Y0\]$/mu);
  assert.match(chart, /^ {4}state "Other" as r1 \{$/mu);
});
