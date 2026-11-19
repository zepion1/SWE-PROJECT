import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "./connection";

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

/**
 * Apply every `migrations/NNN_*.sql` file not yet recorded in schema_migrations,
 * in filename order, each inside its own transaction. Never edit an applied
 * migration: add a new numbered file instead.
 */
export function runMigrations(db: Db, dir = MIGRATIONS_DIR): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);

  const applied = new Set(
    db.prepare("SELECT name FROM schema_migrations").all().map((r) => (r as { name: string }).name),
  );
  const pending = fs
    .readdirSync(dir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
    .filter((f) => !applied.has(f));

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(file);
    })();
  }
  return pending;
}
