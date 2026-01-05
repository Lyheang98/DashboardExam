/**
 * Logger utility
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  error?: string;
}

/**
 * Get current time in Cambodia (Asia/Phnom_Penh)
 * Format: YYYY-MM-DD HH:mm:ss
 */
export function nowCambodia(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Phnom_Penh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  log(level: LogLevel, message: string, context?: string, error?: any) {
    const entry: LogEntry = {
      timestamp: nowCambodia(), // ✅ Cambodia time
      level,
      message,
      context,
      ...(error !== undefined &&
        error !== null && {
          error: error instanceof Error ? error.message : String(error),
        }),
    };

    if (this.isDevelopment) {
      const style = this.getConsoleStyle(level);
      const logData: any = { context };

      if (error !== undefined && error !== null) {
        logData.error = error instanceof Error ? error.message : String(error);
      }

      console.log(
        `[${entry.timestamp}] ${style}${level}${style ? '\x1b[0m' : ''} ${message}`,
        logData
      );
    }
  }

  debug(message: string, context?: string) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: string) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: string, error?: any) {
    this.log(LogLevel.WARN, message, context, error);
  }

  error(message: string, context?: string, error?: any) {
    this.log(LogLevel.ERROR, message, context, error);
  }

  private getConsoleStyle(level: LogLevel): string {
    const styles: Record<LogLevel, string> = {
      [LogLevel.DEBUG]: '\x1b[36m',
      [LogLevel.INFO]: '\x1b[32m',
      [LogLevel.WARN]: '\x1b[33m',
      [LogLevel.ERROR]: '\x1b[31m',
    };
    return styles[level];
  }
}

export const logger = new Logger();
