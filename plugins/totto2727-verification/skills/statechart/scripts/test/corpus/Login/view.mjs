/** @type {(stateValue: { main: string }) => string[]} */
export const state = (stateValue) => stateValue.main.split(".");
