import { EC, isString, matchesUndefined } from "#statechart/ir.ts";
import type { Message, Part, Trace } from "#statechart/ir.ts";
import { actionOf, messageState, textOf } from "./messages.ts";

const FIRST_PRINTED_STATE = 1;
const BACK_TO_STATE = /^(?<state>\d+): Back to state: /u;
type Sequence = Trace["seq"];

const trace = (seq: Sequence, loop?: number): Trace =>
  // oxlint-disable-next-line eslint/sort-keys -- Keep the existing field order of the serialized trace.
  ({ seq, loop });

const appendPrintedState = (message: Message, seq: Sequence): void => {
  const action = message.code === EC.TLC_STATE_PRINT2 ? actionOf(message) : undefined;
  if (!matchesUndefined(action)) {
    seq.push({ action, vars: messageState(message) });
  } else if (
    message.code === EC.TLC_INVARIANT_VIOLATED_INITIAL || message.code === EC.TLC_PROPERTY_VIOLATED_INITIAL
  ) {
    seq.push({ action: "", vars: messageState(message) });
  }
};

const appendState = (message: Message, seq: Sequence): number | undefined => {
  if (message.code === EC.TLC_STATE_PRINT3) {return seq.length - FIRST_PRINTED_STATE;}
  if (message.code === EC.TLC_BACK_TO_STATE) {
    const state = BACK_TO_STATE.exec(textOf(message))?.groups?.state;
    if (!matchesUndefined(state)) {
      const loop = Number(state) - FIRST_PRINTED_STATE;
      seq.push({ action: actionOf(message) ?? "", vars: seq[loop]?.vars });
      return loop;
    }
  }
  appendPrintedState(message, seq);
  return undefined;
};

export const readTrace = function readTrace(messages: Iterable<Part>): Trace {
  const seq: Sequence = [];
  // oxlint-disable-next-line rules/no-for-loops -- A closing trace frame stops reading and closes the underlying transcript iterator.
  for (const message of messages) {
    if (!isString(message)) {
      const loop = appendState(message, seq);
      if (!matchesUndefined(loop)) {return trace(seq, loop);}
    }
  }
  return trace(seq);
};
