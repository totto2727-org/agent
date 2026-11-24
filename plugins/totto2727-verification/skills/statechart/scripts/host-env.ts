// oxlint-disable-next-line node/no-process-env -- TLC and worker processes inherit the host environment when the standalone CLI starts them.
export const hostEnvironment = (): NodeJS.ProcessEnv => process.env;
