import { NavLink, Outlet } from "react-router";
import { Brand } from "../components/Brand";
import { HealthBadge } from "../components/HealthBadge";

/** Customer portal shell (must meet WCAG 2.1 AA, N6). */
export function PublicLayout() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="rh-header">
        <div className="rh-header__inner">
          <Brand />
          <nav aria-label="Main">
            <NavLink to="/" end>
              Search
            </NavLink>
            <NavLink to="/nearby">Find a pharmacy</NavLink>
            <NavLink to="/account">My account</NavLink>
            <NavLink to="/staff/login">Staff sign-in</NavLink>
          </nav>
        </div>
      </header>
      <main id="main" className="rh-main">
        <Outlet />
      </main>
      <footer className="rh-footer">
        <p>
          RedHawk Pharmacy does not provide medical or dosing advice. Please talk to your pharmacist. ·{" "}
          <HealthBadge />
        </p>
      </footer>
    </>
  );
}
