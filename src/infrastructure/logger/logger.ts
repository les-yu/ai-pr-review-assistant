import pino from "pino";
import { env } from "../config/env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV === "production"
      ? undefined
      : { target: "pino/file", options: { destination: 1 } },
});

export function createLogger(context: string) {
  return logger.child({ context });
}
