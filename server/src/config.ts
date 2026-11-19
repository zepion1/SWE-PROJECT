import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export interface AppConfig {
  port: number;
  /** Absolute path to the SQLite file, or ":memory:" for tests. */
  databasePath: string;
  nodeEnv: "development" | "test" | "production";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = (env.NODE_ENV ?? "development") as AppConfig["nodeEnv"];
  const rawDbPath = env.DATABASE_PATH ?? "./data/pharmacy.db";
  return {
    port: Number(env.PORT ?? 3000),
    databasePath:
      nodeEnv === "test" || rawDbPath === ":memory:"
        ? ":memory:"
        : path.resolve(SERVER_ROOT, rawDbPath),
    nodeEnv,
  };
}
