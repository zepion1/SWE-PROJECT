import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app";
import { createStubAdapters, DEV_MFA_CODE } from "../src/adapters/stubs";
import { fixedClock } from "../src/core/clock";
import { createContext } from "../src/context";
import { openDatabase } from "../src/db/connection";
import { runMigrations } from "../src/db/migrate";
import { SEED_PASSWORD, seedDemoData } from "../src/db/seed";

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

/** Sign in a seeded user (dev MFA code) and return the bearer token. */
export async function login(app: Express, email: string, password = SEED_PASSWORD): Promise<string> {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password, otp: DEV_MFA_CODE });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.token as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
