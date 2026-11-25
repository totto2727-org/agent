/** @type {(stateValue: { playback: string, volume: string }) => { Playback: string, Volume: string }} */
export const state = (stateValue) => ({ Playback: stateValue.playback, Volume: stateValue.volume });
/** @type {(action: string) => string} */
export const step = (action) =>
  action.replaceAll(/(?<=[a-z])(?=[A-Z0-9])|(?<=[A-Z])(?=[A-Z][a-z])/gu, " ").toLowerCase();
