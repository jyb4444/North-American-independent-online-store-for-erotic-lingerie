# Account deletion operations

The storefront records a deletion request but does not automatically erase an account. An administrator must keep the request in `processing` until these steps are completed.

1. Verify the requester through the authenticated request record. Never accept a deletion request by ordinary email alone.
2. Identify legal or financial records that must be retained, including orders, refunds, chargebacks, tax records, fraud evidence, and return records. Record the retention basis without copying sensitive data into the audit note.
3. Export only the audit evidence needed to demonstrate that the request was handled.
4. Delete or anonymize non-retained customer data: profile, addresses, wishlist, cart snapshot, local referral relationship, pending notifications, uploaded review media, and unneeded reviews. Preserve order and payment records only where the documented retention basis requires it, and replace customer-facing identifiers when allowed.
5. Delete the Supabase Auth user only after dependent data has been handled. Confirm that sign-in and password recovery no longer work.
6. Remove or anonymize the corresponding Shopify customer record when Shopify retention requirements permit it. Verify that deleting it does not corrupt required order records.
7. In Admin Operations, enter at least 20 characters of processing evidence, type the exact attestation `DELETE COMPLETED`, and complete the request. The status transition, operator, and timestamp are written to the operations audit log.

The completion control is an operator attestation; it does not delete data itself. Never use it before every applicable step above has been completed and verified. Track the statutory response deadline and keep the customer informed throughout processing.
