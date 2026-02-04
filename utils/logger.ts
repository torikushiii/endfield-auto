import winston from "winston";

const { combine, timestamp, printf, colorize } = winston.format;

const customFormat = printf(({ level, message, timestamp, ...meta }) => {
    const hasMeta = Object.keys(meta).length > 0;
    const metaStr = hasMeta
        ? `\n${JSON.stringify(meta, null, 2)}`
        : "";

    // eslint-disable-next-line no-control-regex
    const upperLevel = level.replace(/(\x1b\[[0-9;]*m)|([^\x1b]+)/g, (m, ansi, text) => ansi || text.toUpperCase());

    return `${timestamp} [${upperLevel}] ${message}${metaStr}`;
});

const isJson = process.env.LOG_FORMAT === "json";

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        isJson ? winston.format.json() : customFormat
    ),
    transports: [
        new winston.transports.Console({
            format: isJson
                ? winston.format.json()
                : combine(
                    colorize(),
                    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
                    customFormat
                ),
        }),
    ],
});

export default logger;
