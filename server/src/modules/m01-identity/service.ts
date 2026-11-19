/**
 * M01 Identity and Authorization (F1, F2)
 * Subparts: CredentialValidator, SessionService, RolePolicy (./rbac.ts)
 * Tests: T18, T21, T22 (related T06) · Iteration 1
 */
import type { ActorView, Role } from "@pharma/shared";
import { notImplemented } from "../../core/errors";
import type { Actor } from "../../core/types";
import type { Infra } from "../../context";
import type { AuditService } from "../m13-audit-reporting/service";

export interface LoginInput {
  email: string;
  password: string;
  /** One-time code from the MFA provider (required for staff). */
  otp: string;
}

export interface Session {
  token: string;
  expiresAt: string;
  actor: ActorView;
}

export interface CreateStaffUserInput {
  email: string;
  displayName: string;
  password: string;
  roles: { role: Role; storeId: string | null }[];
}

export class IdentityService {
  constructor(
    private readonly infra: Infra,
    private readonly audit: AuditService,
  ) {}

  /**
   * DDS: login(email, password, otp) -> Session
   * - Verify password (core/crypto verifyPassword) and OTP (adapters.mfa).
   * - Deny locked/disabled users; count failures; audit the attempt (T21).
   * - Store only sha256(token) in `sessions`.
   */
  login(input: LoginInput): Session {
    throw notImplemented("M01 login");
  }

  logout(token: string): void {
    throw notImplemented("M01 logout");
  }

  /** Look up an unexpired, unrevoked session by token hash and load role assignments. */
  resolveSession(token: string): Actor | null {
    throw notImplemented("M01 session lookup");
  }

  me(actor: Actor): ActorView {
    throw notImplemented("M01 current user");
  }

  /** System Administrator creates staff accounts and assigns roles (F1, T22). */
  createStaffUser(actor: Actor, input: CreateStaffUserInput): ActorView {
    throw notImplemented("M01 create staff user");
  }
}
