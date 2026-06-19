import { errln, noop, outln, space, toError } from '@technobuddha/library';

export const LOGLEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'off'] as const;

export type LogLevel = (typeof LOGLEVELS)[number];

const Ranks: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  off: 5,
};

export function loggerOutput<T extends string | Error>(
  level: LogLevel,
  other: LogLevel,
  fn: (message: T) => void,
): (message: T) => void {
  return (Ranks[level] ?? 2) >= (Ranks[other] ?? 2) ? fn : noop;
}

export interface Logger {
  trace: (...message: string[]) => void;
  debug: (...message: string[]) => void;
  info: (...message: string[]) => void;
  warn: (...message: string[]) => void;
  error: (error: string | Error, ...message: string[]) => void;
}

export interface LoggerController {
  get logger(): Logger;
}

export const defaultLogger: Logger = {
  trace: outln,
  debug: outln,
  info: outln,
  warn: (message: string, ...args: string[]) => outln('Warning:', space, message, ...args),
  error: (error: string | Error, ...args: string[]) =>
    errln('Error:', space, toError(error).message, ...args),
};

export const stdioLogger: Logger = {
  trace: outln,
  debug: outln,
  info: outln,
  warn: (message: string, ...args: string[]) => outln('Warning:', space, message, ...args),
  error: (error: string | Error, ...args: string[]) =>
    errln('Error:', space, toError(error).message, ...args),
};
