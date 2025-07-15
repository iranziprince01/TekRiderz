import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from '../config/config';

// Create logs directory if it doesn't exist
const logsDir = path.dirname(path.join(process.cwd(), config.logging.file));
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Safe JSON serialization to handle circular references
const safeStringify = (obj: any, space?: number): string => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    // Filter out sensitive or overly complex objects
    if (key === 'password' || key === 'token' || key === 'secret') {
      return '[REDACTED]';
    }
    if (key === 'httpAgent' || key === 'httpsAgent' || key === 'socket' || key === 'request') {
      return '[Complex Object]';
    }
    return value;
  }, space);
};

// Define custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length) {
      try {
        metaStr = safeStringify(meta, 2);
      } catch (error) {
        metaStr = '[Unable to serialize meta data]';
      }
    }
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'tekriders-backend' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: config.server.isProduction ? logFormat : consoleFormat,
    }),
    
    // Write all logs with level 'error' and below to 'error.log'
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
    
    // Write all logs with level 'info' and below to the configured log file
    new winston.transports.File({
      filename: path.join(process.cwd(), config.logging.file),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
  ],
});

// If we're not in production, also log to console with colors
if (!config.server.isProduction) {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// Handle winston errors
logger.on('error', (error) => {
  console.error('Logger error:', error);
});

export default logger; 