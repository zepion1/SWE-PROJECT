import type { ScreenSpec } from "../routes";

/** Stand-in for a screen that a later iteration builds. Shows what it will do and where it traces to. */
export function Placeholder({ spec }: { spec: ScreenSpec }) {
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title">{spec.title}</h1>
      <div className="rh-card">
        <p>{spec.summary}</p>
        <p>
          <span className="rh-tag">{spec.module}</span>
          {spec.requirements.map((r) => (
            <span key={r} className="rh-tag">
              {r}
            </span>
          ))}
        </p>
        <p className="rh-muted">Planned for Iteration {spec.iteration}. See the README roadmap.</p>
      </div>
    </section>
  );
}
