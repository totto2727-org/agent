/** @type {(stateValue: { session: string, wrongTries: string }) => { Session: string, Tries: string }} */
export const state = (stateValue) => ({ Session: stateValue.session, Tries: stateValue.wrongTries });
