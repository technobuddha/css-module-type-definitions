import { err, out, toError } from '@technobuddha/library';

export interface Logger {
  log: (message: string) => void;
  error: (error: unknown) => void;
}

export const defaultLogger: Logger = {
  log: (message: string) => out(`[cmtd] ${message}\n`),
  error: (error: unknown) => err(`[cmtd] ${toError(error).message}`),
};
