import { useState, type FormEvent } from "react";
import { INSURANCE_PRICING_NOTE, type PublicProductResult } from "@pharma/shared";
import { api, ApiClientError } from "../../api/client";

/**
 * Customer medication search (M10: F19, F20, F22). Wired to GET /api/v1/public/search.
 * Shows availability labels only, never quantities.
 */
export function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProductResult[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      setResults(await api.get<PublicProductResult[]>(`/public/search?q=${encodeURIComponent(query)}`));
    } catch (err) {
      setResults(null);
      if (err instanceof ApiClientError && err.code === "NOT_IMPLEMENTED") {
        setMessage("Medication search is coming in Iteration 5.");
      } else {
        setMessage(err instanceof Error ? err.message : "Search failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title">Find your medication</h1>
      <p className="rh-muted">Search by brand name, generic name or NDC. No account needed.</p>

      <form className="rh-search" onSubmit={onSubmit} role="search">
        <div className="rh-field">
          <label htmlFor="q">Medication</label>
          <input
            id="q"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Atorvastatin or 09999-0102-30"
            minLength={2}
            required
          />
        </div>
        <button className="rh-button" type="submit" disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </button>
      </form>

      {message ? (
        <div className="rh-alert" role="alert">
          {message}
        </div>
      ) : null}

      {results ? (
        <ul aria-label="Search results">
          {results.map((r) => (
            <li key={r.productId} className="rh-card" style={{ marginTop: 12 }}>
              <strong>{r.name}</strong> {r.strength} {r.dosageForm} · {r.availability} · ${r.cashPrice}
              <div className="rh-muted">{INSURANCE_PRICING_NOTE}</div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
