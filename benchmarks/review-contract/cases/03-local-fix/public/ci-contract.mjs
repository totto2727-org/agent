export const releaseCheck = Object.freeze({
  nodeMajor: 24,
  command: ["node", "--test", "test/*.test.mjs"],
  install: false,
});
