-- Cross-instance shared state, so a rate limit means what it says.
--
-- Until now every fixed window was a `Map` in one Node process. That is exactly
-- correct for `pnpm dev` and exactly wrong for ECS: with N tasks behind the load
-- balancer, "5 enquiries per hour per IP" permits 5N, and nothing errors to say
-- so. Phone reveals are the case that matters — each one costs an SMS, so the
-- limiter is a spend control as much as an anti-scraping control (§9.2, §18).
--
-- These two tables are cache, not record. Nothing references them, nothing is
-- restored from a backup into them, and truncating them costs one window an
-- early reset. That is why they carry no FKs and no `id`.

-- One row per (limiter, subject) window. `key` is the whole identity, e.g.
-- `enquiries:203.0.113.9` or `reveal-hour:203.0.113.9`.
CREATE TABLE cache_counter (
  key      text        PRIMARY KEY,
  count    integer     NOT NULL,
  reset_at timestamptz NOT NULL
);

-- The sweeper deletes by expiry and nothing else reads this column, so one
-- index on it serves the only query that is not a primary-key lookup.
CREATE INDEX cache_counter_reset_at ON cache_counter (reset_at);

-- Bumped by whichever task writes a platform-config value, polled by all the
-- others. Without it an admin turning a feature off waits out a five-minute
-- in-process TTL on every task and has no way to make it faster (§30).
CREATE TABLE cache_version (
  namespace  text        PRIMARY KEY,
  version    bigint      NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
