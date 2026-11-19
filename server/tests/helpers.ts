import { createApp } from "../src/app";
import { createStubAdapters } from "../src/adapters/stubs";
import { fixedClock } from "../src/core/clock";
import { createContext } from "../src/context";
import { openDatabase } from "../src/db/connection";
import { runMigrations } from "../src/db/migrate";
import { seedDemoData } from "../src/db/seed";

export const TEST_NOW = "2026-11-19T15:00:00.000Z";

/** Fresh in-memory database + app per test file: every test starts from a known state (Test Plan §4.2). */
export function createTestApp(options: { seed?: boolean } = {}) {
  const clock = fixedClock(TEST_NOW);
  const db = openDatabase(":memory:");
  runMigrations(db);
  if (options.seed) seedDemoData(db, clock);
  const adapters = createStubAdapters();
  const ctx = createContext({ db, clock, adapters });
  return { app: createApp(ctx), ctx, db, clock, adapters };
}
