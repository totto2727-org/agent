/** @type {(stateValue: { tmState: string, rmState: { r1: string, r2: string } }) => { Manager: string, r1: string, r2: string }} */
export const state = (stateValue) => ({ Manager: stateValue.tmState, r1: stateValue.rmState.r1, r2: stateValue.rmState.r2 });
