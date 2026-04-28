# Security Specification - FreelanceFlow

## Data Invariants
1. A **Project** must belong to an authenticated user (`userId`).
2. A **Transaction** must belong to an authenticated user (`userId`).
3. A **Goal** must belong to an authenticated user (`userId`).
4. A **Note** must belong to an authenticated user (`userId`).
5. A **Workout** must belong to an authenticated user (`userId`).
6. A **Client** must belong to an authenticated user (`userId`).
7. An **Invoice** must belong to an authenticated user (`userId`).
8. No user can read, update, or delete another user's data.
9. Timestamps (`createdAt`, `updatedAt`) must be server-generated or validated against `request.time`.

## The "Dirty Dozen" Payloads
1. **Identity Spoofing**: Attempt to create a project with `userId` of another user.
2. **Resource Poisoning**: Use a document ID larger than 128 characters or containing malicious characters.
3. **Ghost Fields**: Add `isAdmin: true` to a user profile or transaction.
4. **State Shortcutting**: Update an invoice status from 'Draft' to 'Paid' without proper fields.
5. **Type Poisoning**: Set `amount` in a transaction to a string "1.0M".
6. **Negative Balance**: Set a workout `sets` to -5.
7. **Orphaned Writes**: Create an invoice for a client that doesn't exist.
8. **PII Leak**: Attempt to list all users' notes.
9. **Denial of Wallet**: Send a 1MB string in the `exercise` field of a workout.
10. **Timestamp Fraud**: Set `createdAt` to a future date from the client.
11. **Immutable Violation**: Change the `userId` of an existing project during update.
12. **Query Scraping**: Attempt to list all transactions without a `userId` filter.
