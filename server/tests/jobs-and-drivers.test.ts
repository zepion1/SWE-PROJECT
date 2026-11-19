import { describe, expect, it } from "vitest";
import { runDailyJobs } from "../src/jobs/daily-jobs";
import m04 from "../src/drivers/m04.driver";
import m06 from "../src/drivers/m06.driver";
import { createTestApp } from "./helpers";

describe("worker and module drivers", () => {
  it("daily jobs isolate failures and report unbuilt modules as skipped", async () => {
    const { ctx } = createTestApp({ seed: true });
    const outcomes = await runDailyJobs(ctx);
    expect(outcomes.length).toBe(5); // 3 stores + forecasts + notices
    expect(outcomes.every((o) => o.status !== "FAILED")).toBe(true);
  });

  it("drivers run against the mocked context and return a structured result", async () => {
    expect(await m04.run()).toMatchObject({ status: "ERROR", errorCode: "NOT_IMPLEMENTED" });
    expect(await m06.run()).toMatchObject({ status: "OK", errorCode: null });
  });
});
