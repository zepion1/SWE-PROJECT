/**
 * Database CLI.
 *   npm run db:migrate   apply pending migrations
 *   npm run db:seed      apply migrations, then load synthetic demo data
 */
import { loadConfig } from "../config";
import { openDatabase } from "./connection";
import { runMigrations } from "./migrate";
import { seedDemoData } from "./seed";

const command = process.argv[2];
const config = loadConfig();
const db = openDatabase(config.databasePath);

try {
  const applied = runMigrations(db);
  console.log(applied.length ? `Applied migrations: ${applied.join(", ")}` : "Schema is up to date.");

  if (command === "seed") {
    seedDemoData(db);
    console.log(`Seeded synthetic demo data into ${config.databasePath}`);
  } else if (command !== "migrate") {
    console.error(`Unknown command "${command}". Use "migrate" or "seed".`);
    process.exitCode = 1;
  }
} finally {
  db.close();
}
