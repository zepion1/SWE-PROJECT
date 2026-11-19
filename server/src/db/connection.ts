import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type Db = Database.Database;

/**
 * Open the SQLite database with the pragmas the design relies on:
 * - foreign_keys: enforce relationships (off by default in SQLite)
 * - WAL: readers don't block the single writer (file databases only)
 * - busy_timeout: wait briefly instead of failing on a locked database
 */
export function openDatabase(databasePath: string): Db {
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  if (databasePath !== ":memory:") db.pragma("journal_mode = WAL");
  return db;
}
