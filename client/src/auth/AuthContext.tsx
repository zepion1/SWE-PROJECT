import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ActorView, Role, SessionView } from "@pharma/shared";
import { api, setSessionRejectedHandler, setSessionToken } from "../api/client";

/**
 * Staff session state (M01, F1).
 * The bearer token lives in sessionStorage: it survives a page reload but is
 * cleared when the tab closes and is never shared across tabs. The server is
 * the authority: every request is re-authorized there.
 */
const STORAGE_KEY = "redhawk.session";

export type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; actor: ActorView };

interface AuthApi {
  state: AuthState;
  login(input: { email: string; password: string; otp: string }): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

function readToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode): the session simply won't survive a reload.
  }
  setSessionToken(token);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const signOutLocally = useCallback(() => {
    writeToken(null);
    setState({ status: "signedOut" });
  }, []);

  useEffect(() => {
    setSessionRejectedHandler(signOutLocally);
    const token = readToken();
    if (!token) {
      setState({ status: "signedOut" });
    } else {
      setSessionToken(token);
      api
        .get<ActorView>("/auth/me")
        .then((actor) => setState({ status: "signedIn", actor }))
        .catch(signOutLocally);
    }
    return () => setSessionRejectedHandler(null);
  }, [signOutLocally]);

  const login = useCallback<AuthApi["login"]>(async (input) => {
    const session = await api.post<SessionView>("/auth/login", input);
    writeToken(session.token);
    setState({ status: "signedIn", actor: session.actor });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      signOutLocally();
    }
  }, [signOutLocally]);

  const value = useMemo(() => ({ state, login, logout }), [state, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** For pages rendered inside StaffLayout, which only renders when signed in. */
export function useSignedInActor(): ActorView {
  const { state } = useAuth();
  if (state.status !== "signedIn") throw new Error("useSignedInActor used outside a signed-in area");
  return state.actor;
}

export function hasRole(actor: ActorView, ...roles: Role[]): boolean {
  return actor.roles.some((r) => roles.includes(r.role));
}
