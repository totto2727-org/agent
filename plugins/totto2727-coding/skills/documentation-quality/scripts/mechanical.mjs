// Local supplemental criteria only. These checks do not certify STE compliance.
// No manifest-supplied executable expressions or regular expressions are accepted.
export function validateMechanicalCheck(check, label, ErrorType = Error) {
  const reject = (message) => {
    throw new ErrorType(`${label}: ${message}`);
  };
  if (!check || typeof check !== "object" || Array.isArray(check)) reject("must be an object");
  const kinds = {
    "fenced-code-language": ["kind"],
    "prohibited-terms": ["kind", "terms", "caseSensitive", "protectedTerms"],
  };
  if (!Object.hasOwn(kinds, check.kind)) reject("unsupported mechanical kind");
  const allowed = kinds[check.kind];
  if (Object.keys(check).some((key) => !allowed.includes(key))) reject("unexpected parameter");
  if (check.kind === "prohibited-terms") {
    if (
      !Array.isArray(check.terms) ||
      !check.terms.length ||
      check.terms.length > 1000 ||
      check.terms.some(
        (term) => typeof term !== "string" || term.length > 128 || !/^[\p{L}\p{N}_]+$/u.test(term),
      )
    )
      reject(
        "terms must contain 1 through 1000 literal whole tokens (at most 128 characters each)",
      );
    if (check.caseSensitive !== undefined && typeof check.caseSensitive !== "boolean")
      reject("caseSensitive must be boolean");
    if (
      check.protectedTerms !== undefined &&
      (!Array.isArray(check.protectedTerms) ||
        check.protectedTerms.length > 1000 ||
        check.protectedTerms.some(
          (term) =>
            typeof term !== "string" || term.length > 128 || !/^[\p{L}\p{N}_]+$/u.test(term),
        ))
    )
      reject(
        "protectedTerms must be an array of literal whole tokens (at most 1000 tokens, 128 characters each)",
      );
    return {
      kind: check.kind,
      terms: [...new Set(check.terms)],
      protectedTerms: [...new Set(check.protectedTerms ?? [])],
      caseSensitive: check.caseSensitive ?? false,
    };
  }
  return { kind: check.kind };
}

export function sourceRange(markdown, start, end) {
  return {
    startLine: markdown.slice(0, start).split("\n").length,
    endLine: Math.max(
      1,
      markdown.slice(0, end).split("\n").length - (end > 0 && markdown[end - 1] === "\n" ? 1 : 0),
    ),
    startByte: Buffer.byteLength(markdown.slice(0, start)),
    endByte: Buffer.byteLength(markdown.slice(0, end)),
  };
}

// Offsets remain UTF-16 source offsets until sourceRange converts them to UTF-8.
// Conservative exclusions intentionally reduce coverage rather than claim that
// code, metadata, link destinations, or HTML meet a prose criterion.
export function inspectMarkdown(markdown) {
  const exclusions = [];
  const uncertainties = [];
  const fences = [];
  const exclude = (start, end, kind) => exclusions.push({ start, end, kind });
  const lines = [...markdown.matchAll(/[^\n]*(?:\n|$)/g)].filter((line) => line[0].length);
  let frontmatter = null;
  if (/^---\s*(?:\r?\n|$)/.test(markdown)) {
    const closing = lines.slice(1).find((line) => /^(?:---|\.\.\.)\s*$/.test(line[0].trimEnd()));
    frontmatter = { start: 0, end: closing ? closing.index + closing[0].length : markdown.length };
    exclude(frontmatter.start, frontmatter.end, "frontmatter");
  }
  let opening = null;
  for (const line of lines) {
    if (frontmatter && line.index < frontmatter.end) continue;
    if (opening) {
      const close = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line[0]);
      if (close && close[1][0] === opening.character && close[1].length >= opening.length) {
        const end = line.index + line[0].length;
        fences.push({ ...opening, end, closed: true });
        exclude(opening.start, end, "fenced-code");
        opening = null;
      }
    } else {
      const match = /^ {0,3}(`{3,}|~{3,})([^\n]*)/.exec(line[0]);
      if (match && !(match[1][0] === "`" && match[2].includes("`")))
        opening = {
          start: line.index,
          openingEnd: line.index + line[0].trimEnd().length,
          character: match[1][0],
          length: match[1].length,
          language: match[2].trim(),
        };
    }
  }
  if (opening) {
    fences.push({ ...opening, end: markdown.length, closed: false });
    exclude(opening.start, markdown.length, "fenced-code");
  }
  // Container parsing requires a full Markdown block parser. Do not mistake
  // quote/list fences for checked prose or silently certify a partial scan.
  const containerFence = lines.find(
    (line) =>
      (!frontmatter || line.index >= frontmatter.end) &&
      !fences.some((fence) => line.index >= fence.start && line.index < fence.end) &&
      /^ {0,3}(?:>\s*|(?:[-+*]|\d+[.)])\s+)(?:>\s*)*(?:`{3,}|~{3,})/.test(line[0]),
  );
  if (containerFence) {
    uncertainties.push({
      start: containerFence.index,
      end: markdown.length,
      reason: "Container-nested fences require contextual Markdown parsing.",
    });
    exclude(containerFence.index, markdown.length, "unsupported-container-fence");
  }
  // Indented blocks after a list marker can be continuation prose, nested
  // fences, or actual code depending on the container's indentation rules.
  // Keep uncertainty local to those blocks instead of silently dropping them
  // as indented code or tainting subsequent independent top-level content.
  let listIndent = null;
  for (const line of lines) {
    if (frontmatter && line.index < frontmatter.end) continue;
    if (uncertainties.some((range) => line.index >= range.start && line.index < range.end))
      continue;
    const fence = fences.find(
      (candidate) => line.index >= candidate.start && line.index < candidate.end,
    );
    if (fence && line.index !== fence.start) continue;
    if (/^[ \t\r\n]*$/.test(line[0])) continue;
    const indentation = /^[ \t]*/.exec(line[0])[0].replaceAll("\t", "    ").length;
    const listMarker = /^[ \t]*(?:[-+*]|\d+[.)])[ \t]+/.test(line[0]);
    if (listMarker) {
      listIndent = listIndent === null ? indentation : Math.min(listIndent, indentation);
      continue;
    }
    if (listIndent !== null && indentation > listIndent) {
      const end = fence?.end ?? line.index + line[0].length;
      uncertainties.push({
        start: line.index,
        end,
        reason:
          "Indented list continuation may be prose or a nested code block and requires contextual Markdown parsing.",
      });
      exclude(line.index, end, "unsupported-list-continuation");
    } else listIndent = null;
  }
  const mask = () => {
    const characters = markdown.split("");
    for (const { start, end } of exclusions)
      for (let index = start; index < end; index += 1)
        if (characters[index] !== "\n" && characters[index] !== "\r") characters[index] = " ";
    return characters.join("");
  };
  let visible = mask();
  // Match code spans with exactly the same delimiter length, including newlines.
  const runs = [...visible.matchAll(/`+/g)];
  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index];
    const closing = runs.findIndex(
      (other, otherIndex) => otherIndex > index && other[0].length === run[0].length,
    );
    if (closing !== -1) {
      exclude(run.index, runs[closing].index + runs[closing][0].length, "inline-code");
      index = closing;
    }
  }
  visible = mask();
  for (const match of visible.matchAll(
    /<(script|pre|style|textarea)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,
  ))
    exclude(match.index, match.index + match[0].length, "html-block");
  visible = mask();
  for (const match of visible.matchAll(
    /^ {0,3}<\/?(?:address|article|aside|blockquote|details|div|dl|fieldset|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|section|table|ul)\b[^\n]*[\s\S]*?(?=\n[ \t]*\r?\n|(?![\s\S]))/gim,
  ))
    exclude(match.index, match.index + match[0].length, "html-block");
  visible = mask();
  // HTML comments and paired HTML elements are excluded in full, not just tags.
  for (const match of visible.matchAll(
    /<!--[\s\S]*?(?:-->|$)|<([A-Za-z][\w:-]*)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>\n]+>/g,
  ))
    exclude(match.index, match.index + match[0].length, "html");
  visible = mask();
  for (const match of visible.matchAll(
    /(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/|mailto:|www\.)[^\s<>]+|\]\([^\n]*?\)|^ {0,3}\[[^\]\n]+\]:[^\n]*|\{#[^}\n]+\}\s*$/gm,
  ))
    exclude(match.index, match.index + match[0].length, "url-or-markup");
  visible = mask();
  for (const match of visible.matchAll(/^ {4}[^\n]+|^\t[^\n]+/gm))
    exclude(match.index, match.index + match[0].length, "indented-code");
  return { visible: mask(), exclusions, fences, frontmatter, uncertainties };
}

export function paragraphUnits(markdown, sections) {
  const { fences, frontmatter } = inspectMarkdown(markdown);
  const lines = [...markdown.matchAll(/[^\n]*(?:\n|$)/g)].filter((line) => line[0].length);
  const units = [];
  let start = null;
  let end = 0;
  const flush = () => {
    if (start === null) return;
    const range = sourceRange(markdown, start, end);
    const partial = sections.find(
      (candidate) =>
        candidate.sourceRange.startByte < range.endByte &&
        candidate.sourceRange.endByte > range.startByte &&
        (candidate.sourceRange.startByte > range.startByte ||
          candidate.sourceRange.endByte < range.endByte),
    );
    if (partial)
      throw new Error(
        `Section ${partial.id} selects only part of a paragraph (paragraph lines ${range.startLine}-${range.endLine}). Expand the source range to include the complete paragraph.`,
      );
    const section = sections.find(
      (candidate) =>
        candidate.sourceRange.startByte <= range.startByte &&
        candidate.sourceRange.endByte >= range.endByte,
    );
    if (section)
      units.push({
        id: `paragraph-${units.length + 1}`,
        headingPath: section.headingPath,
        text: markdown.slice(start, end),
        sourceRange: range,
      });
    start = null;
  };
  for (const line of lines) {
    if (frontmatter && line.index < frontmatter.end) continue;
    const fence = fences.find(
      (candidate) => line.index >= candidate.start && line.index < candidate.end,
    );
    if (fence) {
      if (line.index === fence.start) {
        flush();
        start = fence.start;
        end = fence.end;
        flush();
      }
      continue;
    }
    if (/^\s*$/.test(line[0]) || /^ {0,3}#{1,6}\s/.test(line[0])) {
      flush();
      if (/^\s*$/.test(line[0]) || /^ {0,3}#{1,6}\s/.test(line[0])) continue;
    }
    start ??= line.index;
    end = line.index + line[0].length;
  }
  flush();
  return units;
}

export function runMechanical(check, markdown, targetRange) {
  const { visible, exclusions, fences, uncertainties } = inspectMarkdown(markdown);
  const within = (start, end) => {
    const range = sourceRange(markdown, start, end);
    return range.startByte >= targetRange.startByte && range.endByte <= targetRange.endByte;
  };
  const findings = [];
  let applicable = false;
  if (check.kind === "fenced-code-language") {
    for (const fence of fences) {
      if (uncertainties.some((range) => fence.start < range.end && fence.end > range.start))
        continue;
      if (!within(fence.start, fence.end)) continue;
      applicable = true;
      if (!fence.closed)
        findings.push({
          defect: "unclosed-fence",
          message: "Fenced code block is unclosed, even if its language info string is present.",
          sourceRange: sourceRange(markdown, fence.start, fence.end),
        });
      else if (!fence.language)
        findings.push({
          defect: "missing-language",
          message: "Fenced code block has no language info string.",
          sourceRange: sourceRange(markdown, fence.start, fence.openingEnd),
        });
    }
  } else {
    const normalize = (term) => (check.caseSensitive ? term : term.toLowerCase());
    const prohibited = new Set(check.terms.map(normalize));
    const protectedTerms = new Set((check.protectedTerms ?? []).map(normalize));
    for (const token of visible.matchAll(/[\p{L}\p{N}_]+/gu)) {
      if (!within(token.index, token.index + token[0].length)) continue;
      applicable = true;
      if (prohibited.has(normalize(token[0])) && !protectedTerms.has(normalize(token[0])))
        findings.push({
          term: token[0],
          basis: "exact-project-restriction",
          message: `Explicitly prohibited project token: ${token[0]}`,
          sourceRange: sourceRange(markdown, token.index, token.index + token[0].length),
        });
    }
  }
  const parserWarnings = uncertainties
    .filter(({ start, end }) => {
      const range = sourceRange(markdown, start, end);
      return range.startByte < targetRange.endByte && range.endByte > targetRange.startByte;
    })
    .map(({ start, end, reason }) => ({ reason, sourceRange: sourceRange(markdown, start, end) }));
  const choice = findings.length
    ? "fail"
    : parserWarnings.length
      ? "insufficient_context"
      : applicable
        ? "pass"
        : "not_applicable";
  return {
    type: "choice",
    choice,
    confidence: 1,
    reviewRequired: parserWarnings.length > 0,
    findings,
    coverage: {
      claim:
        "Only the declared local supplemental criterion, not STE dictionary or full STE compliance.",
      parserWarnings,
      excluded: exclusions
        .filter(({ start, end }) => {
          const range = sourceRange(markdown, start, end);
          return range.startByte < targetRange.endByte && range.endByte > targetRange.startByte;
        })
        .map(({ start, end, kind }) => ({ kind, sourceRange: sourceRange(markdown, start, end) })),
    },
  };
}
