/**
 * Worker entry point: `npm run worker`.
 * Runs the daily jobs once and exits. Schedule it with cron (or the OS task
 * scheduler) shortly after midnight store-local time. An in-process scheduler
 * can replace this in Iteration 3 (M12).
 */
import { createAdapters } from "../adapters/stubs";
import { loadConfig } from "../config";
import { createContext } from "../context";
import { openDatabase } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { runDailyJobs } from "./daily-jobs";

const config = loadConfig();
const db = openDatabase(config.databasePath);
runMigrations(db);

try {
  const outcomes = await runDailyJobs(createContext({ db, adapters: createAdapters(config) }));
  console.table(outcomes);
  if (outcomes.some((o) => o.status === "FAILED")) process.exitCode = 1;
} finally {
  db.close();
}
