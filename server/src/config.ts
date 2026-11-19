import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export interface AppConfig {
  port: number;
  /** Absolute path to the SQLite file, or ":memory:" for tests. */
  databasePath: string;
  nodeEnv: "development" | "test" | "production";
  /**
   * "totp": real authenticator-app codes (default in production).
   * "dev":  the fixed code 123456 is accepted (default in development and tests). Never use in production.
   */
  mfaMode: "totp" | "dev";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = (env.NODE_ENV ?? "development") as AppConfig["nodeEnv"];
  const rawDbPath = env.DATABASE_PATH ?? "./data/pharmacy.db";
  const mfaMode = env.MFA_MODE === "totp" || env.MFA_MODE === "dev" ? env.MFA_MODE : nodeEnv === "production" ? "totp" : "dev";
  if (nodeEnv === "production" && mfaMode === "dev") {
    throw new Error("MFA_MODE=dev is not allowed in production");
  }
  return {
    port: Number(env.PORT ?? 3000),
    databasePath:
      nodeEnv === "test" || rawDbPath === ":memory:"
        ? ":memory:"
        : path.resolve(SERVER_ROOT, rawDbPath),
    nodeEnv,
    mfaMode,
  };
}
