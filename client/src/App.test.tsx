import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorView, ProductView } from "@pharma/shared";
import { App } from "./App";
import { staffScreens } from "./routes";

// ---- tiny API mock: "METHOD /path" -> [status, data] ------------------------------
type Reply = [number, unknown];
let routes: Record<string, Reply | ((body: unknown) => Reply)> = {};
const calls: string[] = [];

function envelope([status, data]: Reply) {
  const body = status < 400 ? { data, requestId: "test" } : { error: data, requestId: "test" };
  return Response.json(body, { status });
}

beforeEach(() => {
  calls.length = 0;
  routes = { "GET /health": [200, { status: "ok", db: "ok" }] };
  sessionStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace("/api/v1", "").split("?")[0];
      const key = `${init?.method ?? "GET"} ${path}`;
      calls.push(key);
      const route = routes[key];
      if (!route) return envelope([404, { code: "NOT_FOUND", message: `no mock for ${key}` }]);
      return envelope(typeof route === "function" ? route(init?.body ? JSON.parse(String(init.body)) : undefined) : route);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const actor = (role: ActorView["roles"][number]["role"], displayName: string): ActorView => ({
  userId: `u-${role}`,
  email: `${role.toLowerCase()}@redhawk.test`,
  displayName,
  roles: [{ role, storeId: role === "SYSTEM_ADMIN" ? null : "store-montclair" }],
});
const manager = actor("PHARMACIST_MANAGER", "Morgan Manager");
const technician = actor("TECHNICIAN", "Taylor Technician");
const admin = actor("SYSTEM_ADMIN", "Avery Admin");

/** Simulate a session restored from sessionStorage. */
function signedInAs(who: ActorView) {
  sessionStorage.setItem("redhawk.session", "token-123");
  routes["GET /auth/me"] = [200, who];
}

const amox: ProductView = {
  id: "prod-amox",
  ndc: "09999-0201-50",
  brandName: null,
  genericName: "Amoxicillin",
  strength: "500 mg",
  dosageForm: "Capsule",
  category: "Antibiotic",
  scheduleClass: "NONE",
  active: true,
};

// ---- tests -----------------------------------------------------------------

describe("public portal", () => {
  it("shows the RedHawk brand and the medication search", () => {
    renderAt("/");
    expect(screen.getByText("RedHawk Pharmacy")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Find your medication" })).toBeTruthy();
  });
});

describe("staff sign-in (F1)", () => {
  it("redirects to sign-in when there is no session", async () => {
    renderAt("/staff/products");
    expect(await screen.findByRole("heading", { name: "Staff sign-in" })).toBeTruthy();
  });

  it("signs in with password + one-time code and returns to the requested page", async () => {
    routes["POST /auth/login"] = (body) => {
      expect(body).toEqual({ email: "manager@redhawk.test", password: "ChangeMe!123", otp: "123456" });
      return [200, { token: "tok", expiresAt: "2026-11-19T23:00:00Z", actor: manager }];
    };
    routes["GET /products"] = [200, { items: [amox], nextCursor: null }];
    renderAt("/staff/products");

    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "manager@redhawk.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "ChangeMe!123" } });
    fireEvent.change(screen.getByLabelText("One-time code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Products" })).toBeTruthy();
    expect(screen.getByText("Morgan Manager")).toBeTruthy();
    expect(sessionStorage.getItem("redhawk.session")).toBe("tok");
  });

  it("shows the server's message when sign-in fails", async () => {
    routes["POST /auth/login"] = [401, { code: "UNAUTHENTICATED", message: "Invalid email, password or one-time code" }];
    renderAt("/staff/login");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "x@redhawk.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "nope" } });
    fireEvent.change(screen.getByLabelText("One-time code"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Invalid email, password or one-time code");
  });

  it("signing out clears the session and revokes it on the server", async () => {
    signedInAs(manager);
    routes["POST /auth/logout"] = [200, { loggedOut: true }];
    renderAt("/staff");
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Staff sign-in" })).toBeTruthy();
    expect(calls).toContain("POST /auth/logout");
    expect(sessionStorage.getItem("redhawk.session")).toBeNull();
  });

  it("an expired session sends the user back to sign-in", async () => {
    signedInAs(manager);
    routes["GET /auth/me"] = [401, { code: "UNAUTHENTICATED", message: "Sign in required" }];
    renderAt("/staff");
    expect(await screen.findByRole("heading", { name: "Staff sign-in" })).toBeTruthy();
  });
});

describe("role-aware staff navigation (N6, DDS §9.1)", () => {
  it("pharmacy staff see every operations screen, but not Administration", async () => {
    signedInAs(manager);
    renderAt("/staff");
    const nav = await screen.findByRole("navigation", { name: "Staff" });
    for (const s of staffScreens.filter((s) => s.path !== "/staff/admin")) {
      expect(within(nav).getByRole("link", { name: s.title })).toBeTruthy();
    }
    expect(within(nav).queryByRole("link", { name: "Administration" })).toBeNull();
  });

  it("administrators land on Administration", async () => {
    signedInAs(admin);
    routes["GET /admin/users"] = [200, [{ ...admin, status: "ACTIVE", createdAt: "2026-11-19" }]];
    routes["GET /stores"] = [200, []];
    routes["GET /audit"] = [200, []];
    renderAt("/staff");
    expect(await screen.findByRole("heading", { name: "Administration" })).toBeTruthy();
    const table = (await screen.findAllByRole("table"))[0]!;
    expect(await within(table).findByText("Avery Admin")).toBeTruthy();
  });

  it("a technician who opens the admin URL is told they have no access", async () => {
    signedInAs(technician);
    renderAt("/staff/admin");
    expect((await screen.findByRole("alert")).textContent).toContain("don't have access");
  });
});

describe("products page (M02, F4)", () => {
  it("technicians can browse but not add products", async () => {
    signedInAs(technician);
    routes["GET /products"] = [200, { items: [amox], nextCursor: null }];
    renderAt("/staff/products");
    expect(await screen.findByText("09999-0201-50")).toBeTruthy();
    expect(screen.queryByText("Add product")).toBeNull();
  });

  it("managers can add a product, keeping NDC leading zeros (T25)", async () => {
    signedInAs(manager);
    routes["GET /products"] = [200, { items: [], nextCursor: null }];
    routes["POST /products"] = (body) => {
      expect(body).toMatchObject({ ndc: "00999-0701-30", brandName: null, scheduleClass: "NONE" });
      return [201, { ...amox, id: "new", ndc: "00999-0701-30", genericName: "Levothyroxine" }];
    };
    renderAt("/staff/products");

    fireEvent.click(await screen.findByText("Add product"));
    const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fill("NDC", "00999-0701-30");
    fill("Generic name", "Levothyroxine");
    fill("Strength", "50 mcg");
    fill("Dosage form", "Tablet");
    fill("Category", "Endocrine");
    fireEvent.click(screen.getByRole("button", { name: "Save product" }));

    expect(await screen.findByText("00999-0701-30")).toBeTruthy();
    expect(screen.getByText("Levothyroxine added.")).toBeTruthy();
  });
});
