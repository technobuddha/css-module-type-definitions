import { errln, noop, outln } from '@technobuddha/library';

export const LOGLEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'off'] as const;

export type LogLevel = (typeof LOGLEVELS)[number];

const RANKS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  off: 5,
};

export interface Logger {
  readonly trace: (...message: string[]) => void;
  readonly debug: (...message: string[]) => void;
  readonly info: (...message: string[]) => void;
  readonly warn: (...message: string[]) => void;
  readonly error: (...message: string[]) => void;
}

export interface LoggerController {
  get logger(): Logger;
}

export const defaultLogger: Logger = {
  trace: outln,
  debug: outln,
  info: outln,
  warn: errln,
  error: errln,
};

export const stdioLogger: Logger = {
  trace: outln,
  debug: outln,
  info: outln,
  warn: (...args: string[]) => outln('Warning: ', ...args),
  error: (...args: string[]) => errln('Error: ', ...args),
};

export function loggerForLevel(baseLogger: Logger, level: LogLevel): Logger {
  const rank = RANKS[level] ?? 2;

  return {
    trace: rank <= 0 ? baseLogger.trace : noop,
    debug: rank <= 1 ? baseLogger.debug : noop,
    info: rank <= 2 ? baseLogger.info : noop,
    warn: rank <= 3 ? baseLogger.warn : noop,
    error: rank <= 4 ? baseLogger.error : noop,
  };
}
