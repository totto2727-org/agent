import { CHART_STATES, RERUN_STATES, visitItems } from '#statechart/ir.ts';
import type { ConfigSection, Spec } from '#statechart/ir.ts';

export function configText(sections: ConfigSection[], extra: string[]): string {
  const lines: string[] = [];
  visitItems(sections, (section) => {lines.push(`${section.key} ${section.tokens.join(" ")}`);});
  lines.push(...extra);
  return lines.join("\n");
}

export const boundRun = (module: string): string =>
  [
    `---- MODULE ChartBound ----`,
    `EXTENDS ${module}`,
    `ChartTLC == INSTANCE TLC`,
    `ChartNaturals == INSTANCE Naturals`,
    `ChartBound == ChartNaturals!<(ChartTLC!TLCGet("distinct"), ${RERUN_STATES})`,
    `====`,
  ].join("\n");

export function chartRun({ module, variables, invariants }: Spec, tag: string): string {
  const every: string[] = [];
  visitItems(invariants, (name) => {every.push(`(IF ~${name} THEN {"${name}"} ELSE {}) \\cup `);});
  return [
    `---- MODULE ChartRun ----`,
    `EXTENDS ${module}`,
    `ChartTLC == INSTANCE TLC`,
    `ChartNaturals == INSTANCE Naturals`,
    `ChartBudget == ChartNaturals!<=(ChartTLC!TLCGet("distinct"), ${CHART_STATES})`,
    `ChartBroken == ${every.join("")}{}`,
    `ChartMark == ChartBroken = {} \\/ ChartTLC!PrintT(<<"${tag}", <<${variables.join(", ")}>>, ChartBroken>>)`,
    `====`,
  ].join("\n");
}
