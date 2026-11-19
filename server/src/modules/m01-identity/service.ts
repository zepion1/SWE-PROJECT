/**
 * M01 Identity and Authorization (F1, F2)
 * Subparts: CredentialValidator, SessionService, RolePolicy (./rbac.ts)
 * Tests: T18, T21, T22 (related T06) · Iteration 1
 *
 * - Staff sign in with email + password + one-time code. MFA is always required
 *   for staff (DDS M01 precondition); users.mfa_enabled is reserved for future use.
 * - Every credential failure returns the same 401 message, and the password hash
 *   runs even for unknown emails, so responses don't reveal which accounts exist.
 * - MAX_FAILED_LOGINS consecutive failures lock the account (T21); an admin unlocks it.
 * - Session tokens are random; only sha256(token) is stored. Sessions expire after SESSION_TTL_MS.
 * - Every attempt (success or failure) is audited.
 */
import type {
  ActorView,
  Role,
  SessionView,
  StaffUserCreated,
  StaffUserStatus,
  StaffUserView,
  StoreView,
} from "@pharma/shared";
import { generateTotpSecret, otpauthUri } from "../../adapters/totp";
import { hashPassword, newToken, sha256, verifyPassword } from "../../core/crypto";
import { errors } from "../../core/errors";
import { newId } from "../../core/ids";
import type { Actor, RoleAssignment } from "../../core/types";
import type { Infra } from "../../context";
import { isUniqueViolation } from "../../db/connection";
import type { AuditService } from "../m13-audit-reporting/service";
import { assertAuthorized, authorize } from "./rbac";

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // one 8-hour shift
export const MAX_FAILED_LOGINS = 5;
const INVALID_CREDENTIALS = "Invalid email, password or one-time code";
const AUTH_SERVICE: Actor = { kind: "SERVICE", serviceName: "AUTH" };

export interface LoginInput {
  email: string;
  password: string;
  /** One-time code from the user's authenticator app (required for staff). */
  otp: string;
}

export interface CreateStaffUserInput {
  email: string;
  displayName: string;
  password: string;
  roles: { role: Role; storeId: string | null }[];
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  mfa_secret: string | null;
  status: StaffUserStatus;
  failed_login_count: number;
  created_at: string;
}

let timingHash: string | undefined;
/** A real scrypt hash to verify against when the email is unknown (equalises response time). */
function timingEqualizerHash(): string {
  timingHash ??= hashPassword("redhawk-timing-equalizer");
  return timingHash;
}

export class IdentityService {
  constructor(
    private readonly infra: Infra,
    private readonly audit: AuditService,
  ) {}

  /** DDS: login(email, password, otp) -> Session */
  login(input: LoginInput): SessionView {
    const { db, clock, adapters } = this.infra;
    const now = clock.now();
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(input.email.trim()) as UserRow | undefined;
    const passwordOk = verifyPassword(input.password, user?.password_hash ?? timingEqualizerHash());

    if (!user) {
      this.auditAttempt("LOGIN_FAILED", "unknown", { reason: "UNKNOWN_EMAIL" });
      throw errors.unauthenticated(INVALID_CREDENTIALS);
    }
    if (user.status !== "ACTIVE") {
      this.auditAttempt("LOGIN_FAILED", user.id, { reason: `ACCOUNT_${user.status}` });
      throw errors.unauthenticated(INVALID_CREDENTIALS);
    }
    const otpOk = adapters.mfa.verify(user.mfa_secret, input.otp, now);
    if (!passwordOk || !otpOk) {
      this.recordFailedAttempt(user, passwordOk ? "INVALID_OTP" : "INVALID_PASSWORD");
      throw errors.unauthenticated(INVALID_CREDENTIALS);
    }

    const roles = this.loadRoles(user.id);
    if (roles.length === 0) {
      this.auditAttempt("LOGIN_FAILED", user.id, { reason: "NO_ROLE" });
      throw errors.forbidden("Your account has no role assigned. Contact your System Administrator.");
    }

    const token = newToken();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
    const actor: Actor = { kind: "USER", userId: user.id, email: user.email, roles };
    db.transaction(() => {
      db.prepare("INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").run(
        newId(),
        user.id,
        sha256(token),
        now.toISOString(),
        expiresAt,
      );
      db.prepare("UPDATE users SET failed_login_count = 0 WHERE id = ?").run(user.id);
      this.audit.record({ actor, storeId: null, action: "LOGIN_SUCCEEDED", entityType: "user", entityId: user.id });
    })();

    return { token, expiresAt, actor: this.toActorView(user, roles) };
  }

  /** Revoke the caller's session token. */
  logout(actor: Actor, token: string): void {
    const user = requireUser(actor);
    const { db, clock } = this.infra;
    db.transaction(() => {
      db.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND user_id = ? AND revoked_at IS NULL").run(
        clock.now().toISOString(),
        sha256(token),
        user.userId,
      );
      this.audit.record({ actor, storeId: null, action: "LOGOUT", entityType: "user", entityId: user.userId });
    })();
  }

  /** Look up an unexpired, unrevoked session of an ACTIVE user and load its role assignments. */
  resolveSession(token: string): Actor | null {
    const row = this.infra.db
      .prepare(
        `SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.status = 'ACTIVE'`,
      )
      .get(sha256(token), this.infra.clock.now().toISOString()) as { id: string; email: string } | undefined;
    if (!row) return null;
    return { kind: "USER", userId: row.id, email: row.email, roles: this.loadRoles(row.id) };
  }

  me(actor: Actor): ActorView {
    return this.getStaffUser(requireUser(actor).userId);
  }

  /** System Administrator creates staff accounts and assigns roles (F1, T22). */
  createStaffUser(actor: Actor, input: CreateStaffUserInput): StaffUserCreated {
    assertAuthorized(actor, "MANAGE_USERS", null);
    const roles = this.validateRoles(input.roles);
    const { db } = this.infra;
    const userId = newId();
    const email = input.email.trim().toLowerCase();
    const secret = generateTotpSecret();

    try {
      db.transaction(() => {
        db.prepare(
          `INSERT INTO users (id, email, display_name, password_hash, mfa_secret, mfa_enabled, created_at)
           VALUES (?, ?, ?, ?, ?, 1, ?)`,
        ).run(userId, email, input.displayName.trim(), hashPassword(input.password), secret, this.infra.clock.now().toISOString());
        const insertRole = db.prepare("INSERT INTO role_assignments (id, user_id, store_id, role) VALUES (?, ?, ?, ?)");
        for (const r of roles) insertRole.run(newId(), userId, r.storeId, r.role);
        this.audit.record({
          actor,
          storeId: null,
          action: "USER_CREATED",
          entityType: "user",
          entityId: userId,
          after: { email, displayName: input.displayName.trim(), roles },
        });
      })();
    } catch (err) {
      if (isUniqueViolation(err)) throw errors.conflict("A user with this email already exists");
      throw err;
    }

    return { user: this.getStaffUser(userId), mfaSetup: { secret, otpauthUri: otpauthUri(secret, email) } };
  }

  /** Stores the caller works in; System Administrators (MANAGE_STORES) see every active store. */
  listStores(actor: Actor): StoreView[] {
    const user = requireUser(actor);
    const all = authorize(actor, "MANAGE_STORES", null).allowed;
    const ids = new Set(user.roles.map((r) => r.storeId));
    const rows = this.infra.db
      .prepare("SELECT id, name, address, postal_code, timezone FROM stores WHERE active = 1 ORDER BY name")
      .all() as { id: string; name: string; address: string; postal_code: string; timezone: string }[];
    return rows
      .filter((s) => all || ids.has(null) || ids.has(s.id))
      .map((s) => ({ id: s.id, name: s.name, address: s.address, postalCode: s.postal_code, timezone: s.timezone }));
  }

  listStaffUsers(actor: Actor): StaffUserView[] {
    assertAuthorized(actor, "MANAGE_USERS", null);
    const ids = this.infra.db.prepare("SELECT id FROM users ORDER BY email").all() as { id: string }[];
    return ids.map(({ id }) => this.getStaffUser(id));
  }

  /** Re-activate a LOCKED account and clear its failed-attempt counter (T21 recovery). */
  unlockUser(actor: Actor, userId: string): StaffUserView {
    assertAuthorized(actor, "MANAGE_USERS", null);
    const before = this.getStaffUser(userId);
    if (before.status !== "LOCKED") throw errors.conflict("Only a locked account can be unlocked");
    const { db } = this.infra;
    db.transaction(() => {
      db.prepare("UPDATE users SET status = 'ACTIVE', failed_login_count = 0 WHERE id = ?").run(userId);
      this.audit.record({
        actor,
        storeId: null,
        action: "USER_UNLOCKED",
        entityType: "user",
        entityId: userId,
        before: { status: "LOCKED" },
        after: { status: "ACTIVE" },
      });
    })();
    return this.getStaffUser(userId);
  }

  // ---- internals -------------------------------------------------------------

  private recordFailedAttempt(user: UserRow, reason: string): void {
    const { db } = this.infra;
    const attempts = user.failed_login_count + 1;
    const lock = attempts >= MAX_FAILED_LOGINS;
    db.transaction(() => {
      db.prepare("UPDATE users SET failed_login_count = ?, status = ? WHERE id = ?").run(
        attempts,
        lock ? "LOCKED" : user.status,
        user.id,
      );
      this.auditAttempt("LOGIN_FAILED", user.id, { reason, failedAttempts: attempts });
      if (lock) this.auditAttempt("ACCOUNT_LOCKED", user.id, { failedAttempts: attempts });
    })();
  }

  private auditAttempt(action: string, userId: string, after: Record<string, unknown>): void {
    this.audit.record({ actor: AUTH_SERVICE, storeId: null, action, entityType: "user", entityId: userId, after });
  }

  private validateRoles(roles: CreateStaffUserInput["roles"]): RoleAssignment[] {
    const unique = new Map<string, RoleAssignment>();
    const storeExists = this.infra.db.prepare("SELECT 1 FROM stores WHERE id = ? AND active = 1");
    for (const r of roles) {
      if (r.role === "SYSTEM_ADMIN" && r.storeId !== null) {
        throw errors.validation("SYSTEM_ADMIN applies to all stores; storeId must be null");
      }
      if (r.role !== "SYSTEM_ADMIN") {
        if (r.storeId === null) throw errors.validation(`${r.role} must be assigned to a specific store`);
        if (!storeExists.get(r.storeId)) throw errors.validation(`Unknown or inactive store "${r.storeId}"`);
      }
      unique.set(`${r.role}:${r.storeId}`, { role: r.role, storeId: r.storeId });
    }
    return [...unique.values()];
  }

  private loadRoles(userId: string): RoleAssignment[] {
    const rows = this.infra.db
      .prepare("SELECT role, store_id FROM role_assignments WHERE user_id = ? ORDER BY role, store_id")
      .all(userId) as { role: Role; store_id: string | null }[];
    return rows.map((r) => ({ role: r.role, storeId: r.store_id }));
  }

  private getStaffUser(userId: string): StaffUserView {
    const user = this.infra.db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as UserRow | undefined;
    if (!user) throw errors.notFound("User");
    return { ...this.toActorView(user, this.loadRoles(userId)), status: user.status, createdAt: user.created_at };
  }

  private toActorView(user: UserRow, roles: RoleAssignment[]): ActorView {
    return { userId: user.id, email: user.email, displayName: user.display_name, roles };
  }
}

function requireUser(actor: Actor): Extract<Actor, { kind: "USER" }> {
  if (actor.kind !== "USER") throw errors.forbidden("Only staff users have a profile");
  return actor;
}
