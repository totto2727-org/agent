import { EC, isString, matchesUndefined } from '../ir.ts';
import type { Part, Trace } from '../ir.ts';
import { actionOf, messageState, textOf } from "./messages.ts";

export function readTrace(messages: Iterable<Part>): Trace {
  const seq: Trace["seq"] = [];
  for (const m of messages) {
    if (isString(m)) {continue;}
    if (m.code === EC.TLC_STATE_PRINT3) {return { seq, loop: seq.length - 1 };}
    const back = m.code === EC.TLC_BACK_TO_STATE && /^(\d+): Back to state: /u.exec(textOf(m));
    if (back) {
      const loop = Number(back[1]) - 1;
      seq.push({ action: actionOf(m) ?? "", vars: seq[loop]?.vars });
      return { seq, loop };
    }
    const action = m.code === EC.TLC_STATE_PRINT2 ? actionOf(m) : undefined;
    if (!matchesUndefined(action)) {seq.push({ action, vars: messageState(m) });}
    else if (
      m.code === EC.TLC_INVARIANT_VIOLATED_INITIAL ||
      m.code === EC.TLC_PROPERTY_VIOLATED_INITIAL
    )
      {seq.push({ action: "", vars: messageState(m) });}
  }
  return { seq, loop: undefined };
}
