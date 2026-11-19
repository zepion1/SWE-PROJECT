import { NavLink, Outlet } from "react-router";
import { Brand } from "../components/Brand";
import { HealthBadge } from "../components/HealthBadge";
import { staffScreens } from "../routes";

/**
 * Pharmacy operations shell. Every staff screen is one click from the side nav (N6: ≤ 3 clicks).
 * TODO (Iteration 1, M01): redirect to /staff/login without a session and hide
 * links the user's role cannot use. The server enforces access regardless.
 */
export function StaffLayout() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="rh-header">
        <div className="rh-header__inner">
          <Brand to="/staff" suffix="Operations" />
          <span style={{ marginLeft: "auto" }}>
            <HealthBadge />
          </span>
        </div>
      </header>
      <div className="rh-staff">
        <nav className="rh-sidenav" aria-label="Staff">
          <ul>
            {staffScreens.map((s) => (
              <li key={s.path}>
                <NavLink to={s.path} end={s.path === "/staff"}>
                  {s.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main id="main">
          <Outlet />
        </main>
      </div>
    </>
  );
}
