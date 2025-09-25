import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";
import fs from "fs";

const logDir = process.env.LOG_DIR || "logs";
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const transports = [];

if (process.env.NODE_ENV === "production") {
  transports.push(
    new winston.transports.DailyRotateFile({
      dirname: logDir,
      filename: "%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
      level: process.env.LOG_LEVEL || "info",
    })
  );
}

// Always console, but colorize in dev
transports.push(
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports,
});

export default logger;
