import { EC, isString, matchesUndefined } from '#statechart/ir.ts';
import type { Part, Trace } from '#statechart/ir.ts';
import { actionOf, messageState, textOf } from "./messages.ts";

export function readTrace(messages: Iterable<Part>): Trace {
  const seq: Trace["seq"] = [];
  for (const message of messages) {
    if (isString(message)) {continue;}
    if (message.code === EC.TLC_STATE_PRINT3) {return { seq, loop: seq.length - 1 };}
    const back = message.code === EC.TLC_BACK_TO_STATE && /^(\d+): Back to state: /u.exec(textOf(message));
    if (back) {
      const loop = Number(back[1]) - 1;
      seq.push({ action: actionOf(message) ?? "", vars: seq[loop]?.vars });
      return { seq, loop };
    }
    const action = message.code === EC.TLC_STATE_PRINT2 ? actionOf(message) : undefined;
    if (!matchesUndefined(action)) {seq.push({ action, vars: messageState(message) });}
    else if (
      message.code === EC.TLC_INVARIANT_VIOLATED_INITIAL ||
      message.code === EC.TLC_PROPERTY_VIOLATED_INITIAL
    )
      {seq.push({ action: "", vars: messageState(message) });}
  }
  return { seq, loop: undefined };
}
