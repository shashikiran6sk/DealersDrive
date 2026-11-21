-- At most one welcome grant per dealership, whichever way it was activated.
-- Its own migration: Postgres cannot use an enum value in the transaction that added it.
CREATE UNIQUE INDEX "credit_transactions_one_welcome_grant"
  ON "credit_transactions"("dealerId") WHERE "reason" = 'WELCOME_GRANT';
