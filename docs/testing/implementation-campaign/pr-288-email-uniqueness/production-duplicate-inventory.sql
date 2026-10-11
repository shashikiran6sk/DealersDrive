-- READ-ONLY. Run by an authorised operator against a production READ REPLICA or a
-- restored snapshot BEFORE promoting the API that carries migration
-- 20261009160000_dealer_primary_email. The migration aborts (and changes nothing)
-- if any of these three counts is non-zero. Outputs counts only — no addresses.
BEGIN READ ONLY;

-- 1. user accounts whose emails collide after trim + lowercase
SELECT count(*) AS user_email_conflict_groups FROM (
  SELECT lower(btrim(email)) FROM users WHERE nullif(btrim(email), '') IS NOT NULL
  GROUP BY 1 HAVING count(*) > 1) g;

-- 2. dealerships with more than one ACTIVE owner
SELECT count(*) AS multi_owner_dealers FROM (
  SELECT "dealerId" FROM dealer_members WHERE role = 'OWNER' AND status = 'ACTIVE'
  GROUP BY 1 HAVING count(*) > 1) g;

-- 3. approximate primary-identity collisions: unowned applications by contact
--    email, owned dealerships by the owner's verified Google / account email
WITH primary_email AS (
  SELECT d.id, lower(btrim(coalesce(
           (SELECT o.email FROM dealer_members m JOIN oauth_identities o ON o."userId" = m."userId"
             WHERE m."dealerId" = d.id AND m.role = 'OWNER' AND m.status = 'ACTIVE'
               AND o.provider = 'GOOGLE' AND o."emailVerified" ORDER BY o."createdAt", o.id LIMIT 1),
           (SELECT u.email FROM dealer_members m JOIN users u ON u.id = m."userId"
             WHERE m."dealerId" = d.id AND m.role = 'OWNER' AND m.status = 'ACTIVE' LIMIT 1),
           d."contactEmail"))) AS e
  FROM dealers d)
SELECT count(*) AS primary_email_conflict_groups FROM (
  SELECT e FROM primary_email WHERE nullif(e, '') IS NOT NULL GROUP BY e HAVING count(*) > 1) g;

ROLLBACK;
