/**
 * Database CLI.
 *   npm run db:migrate             apply pending migrations
 *   npm run db:seed                apply migrations, then load synthetic demo data
 *   npm run mfa:code -- <email>    print a staff user's current TOTP code (MFA_MODE=totp demos)
 */
import { totp } from "../adapters/totp";
import { loadConfig } from "../config";
import { openDatabase } from "./connection";
import { runMigrations } from "./migrate";
import { seedDemoData } from "./seed";

const [command, arg] = process.argv.slice(2);
const config = loadConfig();
const db = openDatabase(config.databasePath);

try {
  const applied = runMigrations(db);
  if (command !== "mfa-code") {
    console.log(applied.length ? `Applied migrations: ${applied.join(", ")}` : "Schema is up to date.");
  }

  if (command === "seed") {
    seedDemoData(db);
    console.log(`Seeded synthetic demo data into ${config.databasePath}`);
  } else if (command === "mfa-code") {
    const row = db.prepare("SELECT mfa_secret FROM users WHERE email = ?").get(arg ?? "") as
      | { mfa_secret: string | null }
      | undefined;
    if (!row?.mfa_secret) {
      console.error(`No MFA secret found for "${arg ?? ""}".`);
      process.exitCode = 1;
    } else {
      console.log(totp(row.mfa_secret, new Date()));
    }
  } else if (command !== "migrate") {
    console.error(`Unknown command "${command}". Use "migrate", "seed" or "mfa-code <email>".`);
    process.exitCode = 1;
  }
} finally {
  db.close();
}
