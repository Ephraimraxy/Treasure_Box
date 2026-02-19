# Treasure Box – Fintech Transaction Integrity Audit (Paystack + Wallet)

Date: 2026-02-17

This report focuses on **financial integrity**, **wallet consistency**, **Paystack reliability**, **webhook safety**, **reconciliation**, and **admin transparency**.

## Current Architecture (Before Fixes)

- **Wallet model**: Single `User.balance` (virtual wallet) with `Transaction` rows used as a history log.
- **No separate**:
  - Available vs ledger vs pending balances (no dedicated pending/hold balance).
  - Double-entry ledger table.
- **Withdrawal flow**:
  - User balance was **decremented before** writing the withdrawal `Transaction` record → risk of “money disappears” if transaction insert fails.
  - Automated withdrawals could mark `SUCCESS` immediately after transfer initiation (provider status can be queued; final state should be webhook-confirmed).
- **Paystack webhook**:
  - Signature validation exists and deposit webhook re-queries Paystack (good).
  - Missing transfer webhook handlers for `transfer.success` / `transfer.failed` (withdrawals not finalized reliably).

## Risk Level (Current)

### **Critical**
- Non-atomic balance mutation (debit without immutable transaction row).
- Withdrawals could be marked successful without final confirmation.
- Missing transfer webhook finalization → pending withdrawals can become “stuck”.

### **High**
- No persistent webhook event store (idempotency relies only on status checks).
- No formal reconciliation job for stuck pending transactions.
- No double-entry ledger (hard to prove balances, audit trails are weaker).

## Fixes Implemented Immediately (This Patch)

### 1) Atomic withdrawal debit + transaction creation (prevents missing money)

**File**: `server/src/routes/transaction.routes.ts`

- Withdrawal now uses `prisma.$transaction(...)` to:
  - **Debit wallet** using `updateMany(where: balance >= amount)` to prevent race conditions/double spending.
  - **Create the withdrawal transaction row** in the same DB transaction.
- If transfer initiation fails (auto mode), the system:
  - Marks transaction `FAILED`
  - Refunds wallet
  - Notifies user

### 2) Transfer webhook support (finalizes withdrawals + refunds)

**File**: `server/src/routes/payment.routes.ts`

- Added support for:
  - `transfer.success`
  - `transfer.failed`
  - `transfer.reversed`
- Behavior:
  - `transfer.success` → mark withdrawal `SUCCESS` + notify user + health timestamps
  - `transfer.failed/reversed` → mark `FAILED` + refund wallet + notify user + health timestamps

### 3) Admin approval now initiates transfer but does not “fake success”

**File**: `server/src/routes/admin.routes.ts`

- Approval initiates Paystack transfer and stores:
  - `paystackReference`
  - `transferCode`
  - `transferStatus`
  - `transferResponse`
- Transaction stays `PENDING` until transfer webhook finalizes.
- Prevents **double-approval / double-transfer** by blocking approvals if meta already contains approval/transfer fields.
- Pending approvals list excludes already-approved/processing items.

### 4) Store Paystack verification metadata for deposits (audit trail)

**File**: `server/src/routes/payment.routes.ts`

- On `/verify/:reference` and `charge.success` webhook:
  - transaction meta gets a `paystack` object with key verification fields
  - includes `verifiedAt` and `verificationSource`

## What’s Still Needed (Next Phases)

### Phase 1 – Wallet Architecture
- Add **double-entry ledger** table (immutable):
  - debit/credit entries per transaction
  - enforce “no balance change without ledger entry”
- Add **pending/hold** balance model (or ledger-based derived balance) so pending withdrawals don’t look like “missing funds”.

### Phase 2/3 – Paystack Hardening
- Persist webhook events (DB) for true idempotency + audit:
  - `WebhookEvent` table (event id, type, reference, payload hash)
- Store raw Paystack payloads (safe subset) per transaction.

### Phase 4 – Failed/Interrupted Handling
- Requery worker:
  - every 5 minutes: requery `PENDING` withdrawals (by reference/transfer_code)
  - auto-resolve stuck states + refund when provider says failed

### Phase 5/6 – Admin Transparency & Manual Controls
- Transaction explorer (search by tx id, user id, paystack ref, amount, date, status)
- Transaction details page:
  - old/new balance (requires ledger)
  - paystack raw responses
  - webhook timeline
- Admin actions with reason logging:
  - manual refund, requery, force fail/success, freeze wallet, add admin note

### Phase 7 – Reconciliation
- Daily Paystack reconciliation:
  - compare Paystack transaction/transfer lists with internal DB records
  - flag mismatches

## Summary

The **highest-risk “money can disappear” scenarios** were addressed first:
- atomic debit + transaction record creation
- withdrawal finalization through Paystack transfer webhooks
- removal of premature success marking

Next step is implementing a **ledger-based wallet** and persistent webhook/audit event storage to reach full fintech-grade standards.





