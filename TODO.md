# Project TODOs

## Documentation standard

Write requirements as observable system behavior. Name the actor, input, conditions for success, and system response to rejected input. Define terms such as "valid" wherever their meaning affects behavior.

## Staff sign-in

- [ ] Send the sign-in code by email.
- [ ] Show the code field only after the server confirms the email was sent.

## Inventory movement documents

- [ ] Replace stored lot balances and the independent movement ledger with a live SQL view: sum GRN quantities minus GIN quantities per pharmacy, product and lot. Check availability and post issues atomically.
- [ ] Link commercial notes to invoices. Allow multiple GRNs for one purchase invoice. Keep invoice entry and physical count observations out of the stock calculation.
- [ ] Compare the physical count to an existing GRN. Implement manager-approved line corrections with a reason code, explanation, actor, timestamp, and old/new quantities. Commit the edit and audit together; reject stale or duplicate updates.
- [ ] Verify both outcomes: correct the first GRN to 8 and receive a later 2 on a second GRN, or correct the original 10 to 8 and close against an invoice for 8. A recount confirming the original quantity has zero stock effect.
- [ ] Update receipt, issue and correction cases during the separate test-plan rewrite.

- [ ] Receiving UI: select the GRN line and enter the physical count manually. Report unexpected products or unlisted lots separately. Omit barcode scanning and internal warehouse/location tracking.
