/**
 * Logger utility for production-grade logging
 * Replace console.error with this for centralized logging
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

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  log(level: LogLevel, message: string, context?: string, error?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error instanceof Error ? error.message : String(error),
    };

    // In development, log to console
    if (this.isDevelopment) {
      const style = this.getConsoleStyle(level);
      console.log(`[${entry.timestamp}] ${style}${level}${style ? '\x1b[0m' : ''} ${message}`, {
        context,
        error: entry.error,
      });
    }

    // In production, you could send to a logging service
    // Example: sendToLoggingService(entry)
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
      [LogLevel.DEBUG]: '\x1b[36m', // cyan
      [LogLevel.INFO]: '\x1b[32m', // green
      [LogLevel.WARN]: '\x1b[33m', // yellow
      [LogLevel.ERROR]: '\x1b[31m', // red
    };
    return styles[level];
  }
}

export const logger = new Logger();
