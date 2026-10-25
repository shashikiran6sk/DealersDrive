# Owner acceptance and manual activation

A platform AdminMember with SALES_REP prepares a dealership's application and
listings through an admin session. This is separate from the dealership's
DealerMember OWNER. Missing dealership agreement names that owner and Dealer
Login; it never asks staff to accept on the dealer's behalf. The HTTP status and
error code remain unchanged.

A saved DRAFT dealership now shows its owner the existing one-time legal gate
before document loading or onboarding submission. Acceptance requires no document
upload and does not change business details, document status or dealership state.
After acceptance the requested onboarding location resumes, and the agreement is
not repeated at final review. An admin can then use the existing manual document
verification exception. The admin's disclaimer is not the dealer's agreement.

Acceptance and permissions are still enforced server-side. The manual exception
never records acceptance for another person and never marks documents verified.
API tests pin preview off so local development settings cannot change unrelated
fixtures; acceptance scenarios enable it explicitly.
