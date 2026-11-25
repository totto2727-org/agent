const PERIOD = 2;
const ODD = 1;

/** @type {(current: { x: number }) => string} */
export const state = ({ x }) => (x % PERIOD === ODD ? "odd" : String(x));
