import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ROLES, type AuditEventView, type Role, type StaffUserCreated, type StaffUserView, type StoreView } from "@pharma/shared";
import { api, describeError } from "../../api/client";

const ROLE_LABELS: Record<Role, string> = {
  TECHNICIAN: "Technician",
  PHARMACIST_MANAGER: "Pharmacist / Manager",
  SYSTEM_ADMIN: "System Administrator",
};

/** System Administrator console (M01: F1 staff accounts; M13: F3 audit log, Q7). */
export function AdminPage() {
  const [users, setUsers] = useState<StaffUserView[]>([]);
  const [stores, setStores] = useState<StoreView[]>([]);
  const [audit, setAudit] = useState<AuditEventView[]>([]);
  const [created, setCreated] = useState<StaffUserCreated | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [u, s, a] = await Promise.all([
        api.get<StaffUserView[]>("/admin/users"),
        api.get<StoreView[]>("/stores"),
        api.get<AuditEventView[]>("/audit?limit=25"),
      ]);
      setUsers(u);
      setStores(s);
      setAudit(a);
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function unlock(user: StaffUserView) {
    try {
      await api.post(`/admin/users/${user.userId}/unlock`);
      await refresh();
    } catch (err) {
      setError(describeError(err));
    }
  }

  const storeName = (id: string | null) => (id === null ? "All stores" : (stores.find((s) => s.id === id)?.name ?? id));

  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title">Administration</h1>
      {error ? (
        <div className="rh-alert" role="alert">
          {error}
        </div>
      ) : null}

      <CreateUserForm
        stores={stores}
        onCreated={(result) => {
          setCreated(result);
          void refresh();
        }}
      />

      {created ? (
        <div className="rh-card rh-secret" role="status">
          <h2>Account created for {created.user.email}</h2>
          <p>
            Give this authenticator setup to the user now. <strong>It is shown only once.</strong>
          </p>
          <p>
            Secret: <code>{created.mfaSetup.secret}</code>
          </p>
          <p className="rh-break">
            Setup link: <code>{created.mfaSetup.otpauthUri}</code>
          </p>
          <button type="button" className="rh-button rh-button--secondary" onClick={() => setCreated(null)}>
            Done
          </button>
        </div>
      ) : null}

      <h2>Staff accounts</h2>
      <div className="rh-table-wrap">
        <table className="rh-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Roles</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userId}>
                <td>{u.displayName}</td>
                <td>{u.email}</td>
                <td>{u.roles.map((r) => `${ROLE_LABELS[r.role]} · ${storeName(r.storeId)}`).join("; ")}</td>
                <td>{u.status}</td>
                <td>
                  {u.status === "LOCKED" ? (
                    <button type="button" className="rh-button rh-button--secondary" onClick={() => void unlock(u)}>
                      Unlock<span className="rh-visually-hidden"> {u.email}</span>
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Recent audit events</h2>
      <div className="rh-table-wrap">
        <table className="rh-table">
          <thead>
            <tr>
              <th scope="col">When (UTC)</th>
              <th scope="col">Actor</th>
              <th scope="col">Action</th>
              <th scope="col">Entity</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((e) => (
              <tr key={e.id}>
                <td>{e.at.replace("T", " ").slice(0, 19)}</td>
                <td>{users.find((u) => u.userId === e.actorId)?.email ?? e.actorId}</td>
                <td>{e.action}</td>
                <td>
                  {e.entityType} <code>{e.entityId}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CreateUserForm({ stores, onCreated }: { stores: StoreView[]; onCreated: (r: StaffUserCreated) => void }) {
  const [role, setRole] = useState<Role>("TECHNICIAN");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<StaffUserCreated>("/admin/users", {
        email: String(form.get("email") ?? ""),
        displayName: String(form.get("displayName") ?? ""),
        password: String(form.get("password") ?? ""),
        roles: [{ role, storeId: role === "SYSTEM_ADMIN" ? null : String(form.get("storeId") ?? "") }],
      });
      formEl.reset();
      setRole("TECHNICIAN");
      onCreated(result);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rh-card rh-details">
      <summary>Create staff account</summary>
      <form onSubmit={onSubmit} className="rh-form-grid">
        <div className="rh-field">
          <label htmlFor="new-email">Email</label>
          <input id="new-email" name="email" type="email" autoComplete="off" required />
        </div>
        <div className="rh-field">
          <label htmlFor="new-name">Display name</label>
          <input id="new-name" name="displayName" required />
        </div>
        <div className="rh-field">
          <label htmlFor="new-password">Temporary password</label>
          <input id="new-password" name="password" type="password" minLength={12} autoComplete="new-password" required />
        </div>
        <div className="rh-field">
          <label htmlFor="new-role">Role</label>
          <select id="new-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        {role !== "SYSTEM_ADMIN" ? (
          <div className="rh-field">
            <label htmlFor="new-store">Store</label>
            <select id="new-store" name="storeId" required>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="rh-form-actions">
          <button className="rh-button" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
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
