import { errln, outln, space, toError } from '@technobuddha/library';

export interface Logger {
  trace: (message: string) => void;
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (error: string | Error) => void;
}

export const defaultLogger: Logger = {
  trace: outln,
  debug: outln,
  info: outln,
  warn: (message: string) => outln('Warning:', space, message),
  error: (error: string | Error) => errln('Error:', space, toError(error).message),
};
