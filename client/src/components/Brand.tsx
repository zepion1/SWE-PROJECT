import { Link } from "react-router";

export const APP_NAME = "RedHawk Pharmacy";

/** Wordmark: white hawk mark + name, for use on the red header. */
export function Brand({ to = "/", suffix }: { to?: string; suffix?: string }) {
  return (
    <Link to={to} className="rh-brand">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="#FFFFFF" />
        <path d="M6 20c5-1 8-4 10-9 1 3 4 5 10 5-4 2-7 2-10 1-2 2-5 3-10 3z" fill="#D1190D" />
      </svg>
      <span>
        {APP_NAME}
        {suffix ? <span style={{ fontWeight: 400 }}> · {suffix}</span> : null}
      </span>
    </Link>
  );
}
