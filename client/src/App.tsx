import { Route, Routes } from "react-router";
import { Placeholder } from "./components/Placeholder";
import { PublicLayout } from "./layouts/PublicLayout";
import { StaffLayout } from "./layouts/StaffLayout";
import { SearchPage } from "./pages/public/SearchPage";
import { LoginPage } from "./pages/staff/LoginPage";
import { publicScreens, staffScreens } from "./routes";

/**
 * Two route trees in one bundle (ARCHITECTURE.md §2):
 *   /         customer portal (public)
 *   /staff/*  pharmacy operations (staff session required)
 * Replace a <Placeholder> with the real page when its module ships.
 */
export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<SearchPage />} />
        {publicScreens.map((s) => (
          <Route key={s.path} path={s.path} element={<Placeholder spec={s} />} />
        ))}
      </Route>

      <Route path="/staff/login" element={<LoginPage />} />
      <Route element={<StaffLayout />}>
        {staffScreens.map((s) => (
          <Route key={s.path} path={s.path} element={<Placeholder spec={s} />} />
        ))}
      </Route>

      <Route element={<PublicLayout />}>
        <Route path="*" element={<p>Page not found.</p>} />
      </Route>
    </Routes>
  );
}
