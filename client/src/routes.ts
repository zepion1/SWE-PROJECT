/**
 * Screen inventory for both apps. Each entry names the module, requirements and
 * roadmap iteration that will replace its placeholder with a real page.
 * N6: every common staff task must be reachable within 3 clicks of the dashboard.
 */
export interface ScreenSpec {
  path: string;
  title: string;
  module: string;
  requirements: string[];
  iteration: number;
  summary: string;
}

export const staffScreens: ScreenSpec[] = [
  {
    path: "/staff",
    title: "Dashboard",
    module: "M12",
    requirements: ["F24", "F9", "F10", "F13"],
    iteration: 3,
    summary: "Low-stock items, expiring lots, pending orders and AI alerts for your store.",
  },
  {
    path: "/staff/inventory",
    title: "Stock on hand",
    module: "M04",
    requirements: ["F7"],
    iteration: 2,
    summary: "Real-time quantity per product, broken down by lot, with search and filters.",
  },
  {
    path: "/staff/receive",
    title: "Receive stock",
    module: "M03",
    requirements: ["F5"],
    iteration: 2,
    summary: "Scan a barcode or type lot number, expiration date, quantity and supplier.",
  },
  {
    path: "/staff/adjustments",
    title: "Adjustments & counts",
    module: "M05",
    requirements: ["F6", "F8"],
    iteration: 2,
    summary: "Record discrepancies and cycle counts; pharmacists approve or reject pending corrections.",
  },
  {
    path: "/staff/expiring",
    title: "Expiring items",
    module: "M06",
    requirements: ["F9", "F10", "F11"],
    iteration: 2,
    summary: "Expired and soon-to-expire lots (30 / 60 / 90 days), first-expired-first-out advice, disposals.",
  },
  {
    path: "/staff/orders",
    title: "Purchase orders",
    module: "M07",
    requirements: ["F13", "F14"],
    iteration: 3,
    summary: "Draft, approve, send and receive purchase orders; delivery discrepancies are flagged.",
  },
  {
    path: "/staff/suppliers",
    title: "Suppliers",
    module: "M07",
    requirements: ["F12"],
    iteration: 3,
    summary: "Supplier contacts, lead times, minimum orders, prices and product reorder points.",
  },
  {
    path: "/staff/forecasts",
    title: "Forecasts & recommendations",
    module: "M08 / M09",
    requirements: ["F15", "F16", "F17", "F18"],
    iteration: 4,
    summary: "7 / 30 / 90-day demand forecasts and reorder suggestions to accept, edit or reject. Advisory only.",
  },
  {
    path: "/staff/reports",
    title: "Reports",
    module: "M13",
    requirements: ["F25"],
    iteration: 3,
    summary: "Inventory value, stock movement, expiration losses and forecast accuracy, exportable as CSV.",
  },
  {
    path: "/staff/admin",
    title: "Administration",
    module: "M01 / M13",
    requirements: ["F1", "F3"],
    iteration: 1,
    summary: "Staff accounts, role assignments, stores and the audit log (System Administrator).",
  },
];

export const publicScreens: ScreenSpec[] = [
  {
    path: "/nearby",
    title: "Find a pharmacy",
    module: "M11",
    requirements: ["F21"],
    iteration: 5,
    summary: "Nearest RedHawk pharmacies with your item in stock, by ZIP code or (with consent) your location.",
  },
  {
    path: "/account",
    title: "My account",
    module: "M15",
    requirements: ["F2", "F23"],
    iteration: 5,
    summary: "Optional registration for back-in-stock notifications. Searching never requires an account.",
  },
];
