import { CHART_STATES, RERUN_STATES } from '../ir.ts';
import type { ConfigSection, Spec } from '../ir.ts';

export function configText(sections: ConfigSection[], extra: string[]) {
  const lines: string[] = [];
  Iterator.from(sections).forEach((section) => {lines.push(`${section.key} ${section.tokens.join(" ")}`);});
  lines.push(...extra);
  return lines.join("\n");
}

export const boundRun = (module: string) =>
  [
    `---- MODULE ChartBound ----`,
    `EXTENDS ${module}`,
    `ChartTLC == INSTANCE TLC`,
    `ChartNaturals == INSTANCE Naturals`,
    `ChartBound == ChartNaturals!<(ChartTLC!TLCGet("distinct"), ${RERUN_STATES})`,
    `====`,
  ].join("\n");

export function chartRun({ module, variables, invariants }: Spec, tag: string) {
  const every: string[] = [];
  Iterator.from(invariants).forEach((name) => {every.push(`(IF ~${name} THEN {"${name}"} ELSE {}) \\cup `);});
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
