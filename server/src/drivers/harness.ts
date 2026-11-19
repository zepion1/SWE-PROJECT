/**
 * Module driver harness (DDS §6 "Implementation outline/module driver", §10.1).
 *
 *   driver_Mxx(sampleInput, mockedDependencies):
 *     validate_contract(sampleInput)      -> compile-time: sampleInput is typed by the module export
 *     configure_mocked_imports()          -> in-memory SQLite + synthetic seed + stub adapters + fixed clock
 *     result = invoke_module_export(sampleInput)
 *     print(result.status, result.errorCode, result.outputSummary)
 *
 * Drivers compile with `npm run typecheck` and run with `npm run drivers`.
 * Until a module is implemented its driver reports NOT_IMPLEMENTED, which is the
 * expected "compiled, not tested" state.
 */
import { createStubAdapters } from "../adapters/stubs";
import { fixedClock } from "../core/clock";
import { AppError } from "../core/errors";
import type { Actor } from "../core/types";
import { createContext, type AppContext } from "../context";
import { openDatabase } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { seedDemoData } from "../db/seed";

export const DRIVER_NOW = "2026-11-19T15:00:00.000Z";

export interface DriverResult {
  module: string;
  status: "OK" | "ERROR";
  errorCode: string | null;
  outputSummary: string;
}

export interface ModuleDriver {
  module: string;
  run(): Promise<DriverResult>;
}

/** Actors matching the seeded users (server/src/db/seed.ts). */
export const fixtures = {
  manager: {
    kind: "USER",
    userId: "user-manager",
    email: "manager@redhawk.test",
    roles: [{ role: "PHARMACIST_MANAGER", storeId: "store-montclair" }],
  },
  technician: {
    kind: "USER",
    userId: "user-tech",
    email: "tech@redhawk.test",
    roles: [{ role: "TECHNICIAN", storeId: "store-montclair" }],
  },
  admin: {
    kind: "USER",
    userId: "user-admin",
    email: "admin@redhawk.test",
    roles: [{ role: "SYSTEM_ADMIN", storeId: null }],
  },
  pos: { kind: "SERVICE", serviceName: "POS_ADAPTER" },
} satisfies Record<string, Actor>;

export function createDriverContext(): AppContext {
  const clock = fixedClock(DRIVER_NOW);
  const db = openDatabase(":memory:");
  runMigrations(db);
  seedDemoData(db, clock);
  return createContext({ db, clock, adapters: createStubAdapters() });
}

export function defineDriver<I>(
  module: string,
  sampleInput: I,
  invoke: (ctx: AppContext, input: I) => unknown,
): ModuleDriver {
  return {
    module,
    async run() {
      const ctx = createDriverContext();
      try {
        const output = await invoke(ctx, sampleInput);
        return { module, status: "OK", errorCode: null, outputSummary: summarize(output) };
      } catch (err) {
        const code = err instanceof AppError ? err.code : "UNEXPECTED";
        const message = err instanceof Error ? err.message : String(err);
        return { module, status: "ERROR", errorCode: code, outputSummary: message };
      } finally {
        ctx.db.close();
      }
    },
  };
}

function summarize(output: unknown): string {
  const text = JSON.stringify(output) ?? "undefined";
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}
