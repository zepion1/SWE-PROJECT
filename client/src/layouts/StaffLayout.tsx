import { Navigate, NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { Brand } from "../components/Brand";
import { HealthBadge } from "../components/HealthBadge";
import { canSee, staffScreens } from "../routes";

const ROLE_LABELS = { PHARMACIST_MANAGER: "Pharmacist / Manager", TECHNICIAN: "Technician", SYSTEM_ADMIN: "System Administrator" };

/**
 * Pharmacy operations shell (M01, F1). Requires a signed-in staff user; shows
 * only the screens the user's roles can use. Every screen is one click from
 * the side nav (N6: ≤ 3 clicks). The server enforces access regardless.
 */
export function StaffLayout() {
  const { state, logout } = useAuth();
  const location = useLocation();

  if (state.status === "loading") {
    return (
      <p className="rh-main" role="status">
        Loading…
      </p>
    );
  }
  if (state.status === "signedOut") {
    return <Navigate to="/staff/login" replace state={{ from: location.pathname }} />;
  }

  const { actor } = state;
  const visible = staffScreens.filter((s) => canSee(s, actor));
  const current = staffScreens.find((s) => s.path === location.pathname);

  // Land each role on its first available screen (e.g. administrators go to Administration).
  if (location.pathname === "/staff" && current && !canSee(current, actor) && visible[0]) {
    return <Navigate to={visible[0].path} replace />;
  }

  const roleSummary = [...new Set(actor.roles.map((r) => ROLE_LABELS[r.role]))].join(", ");

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="rh-header">
        <div className="rh-header__inner">
          <Brand to="/staff" suffix="Operations" />
          <div className="rh-user">
            <HealthBadge />
            <span>
              <strong>{actor.displayName}</strong> <span className="rh-user__role">{roleSummary}</span>
            </span>
            <button type="button" className="rh-button rh-button--inverse" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="rh-staff">
        <nav className="rh-sidenav" aria-label="Staff">
          <ul>
            {visible.map((s) => (
              <li key={s.path}>
                <NavLink to={s.path} end={s.path === "/staff"}>
                  {s.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main id="main">
          {current && !canSee(current, actor) ? (
            <div className="rh-alert" role="alert">
              You don't have access to {current.title}.
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </>
  );
}
