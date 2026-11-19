import type { ComponentType } from "react";
import { Route, Routes } from "react-router";
import { AuthProvider } from "./auth/AuthContext";
import { Placeholder } from "./components/Placeholder";
import { PublicLayout } from "./layouts/PublicLayout";
import { StaffLayout } from "./layouts/StaffLayout";
import { SearchPage } from "./pages/public/SearchPage";
import { AdminPage } from "./pages/staff/AdminPage";
import { LoginPage } from "./pages/staff/LoginPage";
import { ProductsPage } from "./pages/staff/ProductsPage";
import { publicScreens, staffScreens } from "./routes";

/** Screens that are built. Every other screen in routes.ts renders its <Placeholder>. */
const BUILT_STAFF_PAGES: Record<string, ComponentType> = {
  "/staff/products": ProductsPage,
  "/staff/admin": AdminPage,
};

/**
 * Two route trees in one bundle (ARCHITECTURE.md §2):
 *   /         customer portal (public)
 *   /staff/*  pharmacy operations (staff session required)
 */
export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<SearchPage />} />
          {publicScreens.map((s) => (
            <Route key={s.path} path={s.path} element={<Placeholder spec={s} />} />
          ))}
        </Route>

        <Route path="/staff/login" element={<LoginPage />} />
        <Route element={<StaffLayout />}>
          {staffScreens.map((s) => {
            const Page = BUILT_STAFF_PAGES[s.path];
            return <Route key={s.path} path={s.path} element={Page ? <Page /> : <Placeholder spec={s} />} />;
          })}
        </Route>

        <Route element={<PublicLayout />}>
          <Route path="*" element={<p>Page not found.</p>} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
