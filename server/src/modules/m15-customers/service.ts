/**
 * M15 Customer Accounts and Notices (F2, F23)
 * Subparts: CustomerAuth, SubscriptionService, NotificationWorker
 * Tests: T20, T23, T47 · Iteration 5
 *
 * - Search never requires an account (F2); registration only unlocks subscriptions.
 * - Notices contain the product name and store only: no health details, no quantities (T47).
 * - Unsubscribed -> no further notices (T20). Guests cannot subscribe (T47).
 */
import { notImplemented } from "../../core/errors";
import type { Infra } from "../../context";

export interface SubscriptionView {
  id: string;
  storeProductId: string;
  status: "ACTIVE" | "NOTIFIED" | "UNSUBSCRIBED";
}

export class CustomerService {
  constructor(private readonly infra: Infra) {}

  registerCustomer(input: { email: string; password: string }): { customerId: string } {
    throw notImplemented("M15 customer registration");
  }

  /** DDS: subscribe(customer, product, store) -> Subscription. */
  subscribe(customerId: string, storeProductId: string): SubscriptionView {
    throw notImplemented("M15 subscribe");
  }

  unsubscribe(customerId: string, subscriptionId: string): SubscriptionView {
    throw notImplemented("M15 unsubscribe");
  }

  /** DDS: sendBackInStock() -> Summary. Run by the worker via adapters.mail. */
  async sendBackInStock(): Promise<{ sent: number }> {
    throw notImplemented("M15 back-in-stock notices");
  }
}
