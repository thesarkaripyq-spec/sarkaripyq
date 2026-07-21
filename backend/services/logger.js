const winston = require('winston');

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  process.env.NODE_ENV === 'production'
    ? winston.format.json()
    : winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}${stack ? `\n${stack}` : ''}`;
      })
);

const transports = [
  new winston.transports.Console({ handleExceptions: true }),
];
if (process.env.LOG_FILE === 'true') {
  transports.push(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 10 * 1024 * 1024, maxFiles: 5 }),
    new winston.transports.File({ filename: 'logs/combined.log', maxsize: 10 * 1024 * 1024, maxFiles: 5 }),
  );
}

const logger = winston.createLogger({
  level,
  levels,
  format,
  transports,
  exitOnError: false,
});

if (process.env.LOGTAIL_TOKEN) {
  try {
    const { Logtail } = require('@logtail/node');
    const { LogtailTransport } = require('@logtail/winston');
    const logtail = new Logtail(process.env.LOGTAIL_TOKEN);
    logger.add(new LogtailTransport(logtail));
  } catch (e) {
    // Logtail dependencies not installed - this is optional
  }
}

const stream = { write: (message) => logger.http(message.trim()) };

module.exports = { logger, stream };
