# 5% deposit release and rollback

This change adds `DEPOSIT_05` for new PayOS attempts while retaining `DEPOSIT_50` as a permanent legacy value. It does not rewrite existing payment rows or require destructive SQL. Hibernate currently manages the schema with `ddl-auto=update`; the enum is stored as text, so the application change is additive.

## Safe rollout order

1. Deploy the backend first and verify health, quote endpoints, payment tests, and logs in a non-production environment.
2. Confirm the deployed backend accepts `DEPOSIT_05`, still reads `DEPOSIT_50`, and rejects a new 50% request with `POLICY_CHANGED` unless it exactly resumes an active persisted legacy attempt.
3. Deploy the frontend only after backend compatibility is confirmed. The frontend defaults new attempts to 5% and obtains every displayed amount from a backend quote.
4. Use sandbox/test PayOS credentials and an authorized test account. Do not run a real charge as part of deployment verification.
5. Monitor provider mismatches, manual-review/reconciliation counts, quote failures, and payment-option distribution. Never auto-resolve blocked attempts.

## Compatibility guarantees

- Existing 50% attempts keep their stored option, voucher, amount, remaining amount, order identity, checkout link, and status.
- Webhooks and reconciliation compare provider money to the persisted attempt amount, not today's policy.
- Active attempts lock the option and voucher in the continuation UI.
- A closed historical attempt may be followed by a new 5% attempt only through the existing zero-money closure and retry gates.

## Rollback

If the new frontend must be withdrawn, roll back or disable the frontend 5% selection first. Keep a backend version that can deserialize and reconcile both `DEPOSIT_05` and `DEPOSIT_50`; transactions created during the rollout must remain readable forever. Do not remove either enum value, rewrite payment rows, regenerate provider links, or recalculate persisted amounts.

If the backend itself has an incident, stop new checkout initiation at the edge/UI and continue webhook/reconciliation handling on a compatible backend. Restore a backend release containing `DEPOSIT_05` support before reopening checkout. Manual-review and paid transaction evidence must remain untouched throughout rollback.

Production merge, deployment, database changes, and real payments require explicit owner approval.
