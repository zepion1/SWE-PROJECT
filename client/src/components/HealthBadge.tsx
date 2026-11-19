import { useEffect, useState } from "react";
import type { HealthStatus } from "@pharma/shared";
import { api } from "../api/client";

/** Shows whether the API and database are reachable; proves client ↔ server wiring. */
export function HealthBadge() {
  const [state, setState] = useState<"checking" | "ok" | "down">("checking");

  useEffect(() => {
    let cancelled = false;
    api
      .get<HealthStatus>("/health")
      .then((h) => !cancelled && setState(h.db === "ok" ? "ok" : "down"))
      .catch(() => !cancelled && setState("down"));
    return () => {
      cancelled = true;
    };
  }, []);

  const label = state === "checking" ? "Checking server…" : state === "ok" ? "Server online" : "Server offline";
  return (
    <span className="rh-health" role="status">
      <span className="rh-health__dot" data-ok={state === "checking" ? undefined : String(state === "ok")} />
      {label}
    </span>
  );
}
