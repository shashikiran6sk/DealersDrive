-- Execute once as RDS master through a trusted TLS/operator session.
-- Passwords are deliberately absent. Set interactively with \password or
-- parameterized operator tooling; never commit them or print connection URLs.
CREATE ROLE dd_owner LOGIN;
CREATE ROLE dd_runtime LOGIN;
GRANT CONNECT ON DATABASE dealersdrive TO dd_owner, dd_runtime;
GRANT CREATE ON DATABASE dealersdrive TO dd_owner;
ALTER SCHEMA public OWNER TO dd_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO dd_runtime;
CREATE SCHEMA pgboss AUTHORIZATION dd_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE dd_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dd_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE dd_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO dd_runtime;
-- For an existing migrated database, also grant current objects explicitly:
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dd_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dd_runtime;
