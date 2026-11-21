-- Free credits a dealership gets once, when it is first approved.
ALTER TYPE "CreditReason" ADD VALUE IF NOT EXISTS 'WELCOME_GRANT';
