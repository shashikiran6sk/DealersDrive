-- The ledger needs an append order that is monotonic *within* a transaction.
--
-- `createdAt` is not: Postgres gives every statement in one transaction the
-- same `now()`, so two movements committed together tie, and "the newest row"
-- — which is where the running balance is read from — becomes ambiguous. A
-- bigserial cannot tie.

ALTER TABLE credit_transactions
  ADD COLUMN seq BIGSERIAL NOT NULL;

CREATE UNIQUE INDEX credit_transactions_seq_key ON credit_transactions (seq);
CREATE INDEX credit_transactions_dealer_seq_idx
  ON credit_transactions ("dealerId", seq DESC);
