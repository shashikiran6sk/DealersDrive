-- Every dealership approved before welcome credits existed gets them once, now:
-- five credits, the default of billing.welcomeCredits. Written as a ledger row
-- like any other movement, on top of the dealership's newest row, and mirrored
-- onto dealers. Safe to run again: a dealership that has its grant is skipped.
WITH eligible AS (
  SELECT
    d."id",
    COALESCE(last."balanceAfter", 0) AS "balance",
    COALESCE(last."heldAfter", 0) AS "held"
  FROM "dealers" d
  LEFT JOIN LATERAL (
    SELECT t."balanceAfter", t."heldAfter"
    FROM "credit_transactions" t
    WHERE t."dealerId" = d."id"
    ORDER BY t."id" DESC
    LIMIT 1
  ) last ON TRUE
  WHERE d."approvedAt" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "credit_transactions" w
      WHERE w."dealerId" = d."id" AND w."reason" = 'WELCOME_GRANT'
    )
  ORDER BY d."id"
),
granted AS (
  INSERT INTO "credit_transactions"
    ("dealerId", "reason", "delta", "heldDelta", "balanceAfter", "heldAfter", "actorType", "note")
  SELECT "id", 'WELCOME_GRANT', 5, 0, "balance" + 5, "held", 'SYSTEM', NULL
  FROM eligible
  RETURNING "dealerId", "balanceAfter", "heldAfter"
)
UPDATE "dealers" d
SET "creditBalance" = g."balanceAfter", "creditsHeld" = g."heldAfter"
FROM granted g
WHERE d."id" = g."dealerId";
