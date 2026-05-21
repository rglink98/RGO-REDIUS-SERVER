# Security Specification for ISP Radius Manager

## Data Invariants
1. Only authenticated admins can read and write to any collection.
2. Transactions must be linked to a valid customer.
3. Package prices must be positive numbers.
4. Timestamps (createdAt, updatedAt) must be set using request.time.

## The "Dirty Dozen" Payloads
1. **Unauthorized Read**: An unauthenticated user attempts to read the `customers` collection.
2. **Unauthorized Write**: An unauthenticated user attempts to create a `package`.
3. **Identity Spoofing**: A user attempts to create a document in `admins` to elevate their privilege (if admin logic is implemented).
4. **Invalid Type**: Attempting to set `monthlyBill` as a string instead of a number.
5. **Missing Required Fields**: Creating a `customer` without a `username`.
6. **Negative Amount**: Creating a `transaction` with a negative `amount`.
7. **Future Timestamp**: Setting `date` to a future time manually instead of server time.
8. **Resource Poisoning**: Sending a 1MB string as a customer's `address`.
9. **Status Hijacking**: Setting a customer status to an invalid value like "premium_unlimited_free".
10. **Orphaned Transaction**: Creating a `transaction` with a non-existent `customerId`.
11. **Shadow Field**: Adding `isSuperAdmin: true` to a customer document.
12. **Status Skipping**: Modifying restricted fields in bulk without following the action-based update pattern.

## The Test Runner (Mock)
A `firestore.rules.test.ts` would verify that these payloads return `PERMISSION_DENIED`. For now, I will proceed to generate the rules based on these invariants.
