import { useCallback, useEffect, useState, type FormEvent } from "react";
import { SCHEDULE_CLASSES, type Page, type ProductView } from "@pharma/shared";
import { api, describeError } from "../../api/client";
import { hasRole, useSignedInActor } from "../../auth/AuthContext";

/**
 * Product catalog (M02: F4, F22). Everyone on staff can search; Pharmacist/Managers
 * can add products and deactivate/reactivate them. The server re-checks every action.
 */
export function ProductsPage() {
  const actor = useSignedInActor();
  const canManage = hasRole(actor, "PHARMACIST_MANAGER");

  const [query, setQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [items, setItems] = useState<ProductView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ includeInactive: String(includeInactive), limit: "25" });
      if (query.trim()) params.set("q", query.trim());
      if (cursor) params.set("cursor", cursor);
      try {
        const page = await api.get<Page<ProductView>>(`/products?${params}`);
        setItems((prev) => (cursor ? [...prev, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
      } catch (err) {
        setError(describeError(err));
      } finally {
        setLoading(false);
      }
    },
    [query, includeInactive],
  );

  // Reload when the inactive filter changes; text search runs on submit.
  useEffect(() => {
    void load();
  }, [includeInactive]);

  async function toggleActive(product: ProductView) {
    setError(null);
    try {
      const updated = await api.patch<ProductView>(`/products/${product.id}`, { active: !product.active });
      setItems((prev) =>
        includeInactive || updated.active
          ? prev.map((p) => (p.id === updated.id ? updated : p))
          : prev.filter((p) => p.id !== updated.id),
      );
      setStatus(`${productName(updated)} ${updated.active ? "reactivated" : "deactivated"}.`);
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title">Products</h1>

      <form
        className="rh-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <div className="rh-field">
          <label htmlFor="product-q">Search by brand, generic name or NDC</label>
          <input id="product-q" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100} />
        </div>
        <button className="rh-button" type="submit" disabled={loading}>
          Search
        </button>
        <label className="rh-check">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
          Show inactive
        </label>
      </form>

      {canManage ? <AddProductForm onCreated={(p) => { setItems((prev) => [p, ...prev]); setStatus(`${productName(p)} added.`); }} /> : null}

      <p role="status" className="rh-muted">
        {status}
      </p>
      {error ? (
        <div className="rh-alert" role="alert">
          {error}
        </div>
      ) : null}

      <div className="rh-table-wrap">
        <table className="rh-table">
          <caption className="rh-visually-hidden">Product catalog</caption>
          <thead>
            <tr>
              <th scope="col">NDC</th>
              <th scope="col">Product</th>
              <th scope="col">Strength</th>
              <th scope="col">Form</th>
              <th scope="col">Category</th>
              <th scope="col">Schedule</th>
              <th scope="col">Status</th>
              {canManage ? <th scope="col">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>
                  <code>{p.ndc}</code>
                </td>
                <td>{productName(p)}</td>
                <td>{p.strength}</td>
                <td>{p.dosageForm}</td>
                <td>{p.category}</td>
                <td>{p.scheduleClass === "NONE" ? "—" : <span className="rh-tag">C-{p.scheduleClass}</span>}</td>
                <td>{p.active ? "Active" : "Inactive"}</td>
                {canManage ? (
                  <td>
                    <button type="button" className="rh-button rh-button--secondary" onClick={() => void toggleActive(p)}>
                      {p.active ? "Deactivate" : "Reactivate"}
                      <span className="rh-visually-hidden"> {productName(p)}</span>
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && items.length === 0 ? <p className="rh-muted">No products found.</p> : null}
      {nextCursor ? (
        <button type="button" className="rh-button rh-button--secondary" disabled={loading} onClick={() => void load(nextCursor)}>
          Load more
        </button>
      ) : null}
    </section>
  );
}

function productName(p: ProductView): string {
  return p.brandName ? `${p.brandName} (${p.genericName})` : p.genericName;
}

function AddProductForm({ onCreated }: { onCreated: (p: ProductView) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    setBusy(true);
    setError(null);
    try {
      const created = await api.post<ProductView>("/products", {
        ndc: text("ndc"),
        brandName: text("brandName") || null,
        genericName: text("genericName"),
        strength: text("strength"),
        dosageForm: text("dosageForm"),
        category: text("category"),
        scheduleClass: text("scheduleClass"),
      });
      formEl.reset();
      onCreated(created);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rh-card rh-details">
      <summary>Add product</summary>
      <form onSubmit={onSubmit} className="rh-form-grid">
        <Field name="ndc" label="NDC" hint="Keep leading zeros, e.g. 00999-0701-30" pattern="[0-9]+(-[0-9]+)*" required />
        <Field name="genericName" label="Generic name" required />
        <Field name="brandName" label="Brand name (optional)" />
        <Field name="strength" label="Strength" hint="e.g. 50 mcg" required />
        <Field name="dosageForm" label="Dosage form" hint="e.g. Tablet" required />
        <Field name="category" label="Category" required />
        <div className="rh-field">
          <label htmlFor="scheduleClass">Controlled-substance schedule</label>
          <select id="scheduleClass" name="scheduleClass" defaultValue="NONE">
            {SCHEDULE_CLASSES.map((s) => (
              <option key={s} value={s}>
                {s === "NONE" ? "Not controlled" : `Schedule ${s}`}
              </option>
            ))}
          </select>
        </div>
        <div className="rh-form-actions">
          <button className="rh-button" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save product"}
          </button>
        </div>
        {error ? (
          <div className="rh-alert" role="alert">
            {error}
          </div>
        ) : null}
      </form>
    </details>
  );
}

function Field(props: { name: string; label: string; hint?: string; pattern?: string; required?: boolean }) {
  const hintId = props.hint ? `${props.name}-hint` : undefined;
  return (
    <div className="rh-field">
      <label htmlFor={props.name}>{props.label}</label>
      <input id={props.name} name={props.name} pattern={props.pattern} required={props.required} aria-describedby={hintId} />
      {props.hint ? (
        <small id={hintId} className="rh-muted">
          {props.hint}
        </small>
      ) : null}
    </div>
  );
}
