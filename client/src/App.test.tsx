import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { staffScreens } from "./routes";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("RedHawk Pharmacy app shell", () => {
  beforeEach(() => {
    // The health badge calls the API; answer it with the shared envelope.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: { status: "ok", db: "ok" }, requestId: "test" })),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the brand and the public medication search", () => {
    renderAt("/");
    expect(screen.getByText("RedHawk Pharmacy")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Find your medication" })).toBeTruthy();
    expect(screen.getByRole("search")).toBeTruthy();
  });

  it("lists every staff screen in the side navigation (N6: one click from the dashboard)", () => {
    renderAt("/staff");
    const nav = screen.getByRole("navigation", { name: "Staff" });
    for (const s of staffScreens) {
      expect(nav.textContent).toContain(s.title);
    }
  });

  it("renders the staff sign-in form with a one-time code field (F1)", () => {
    renderAt("/staff/login");
    expect(screen.getByLabelText("One-time code")).toBeTruthy();
  });
});
