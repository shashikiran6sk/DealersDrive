SELECT 'users', count(*) FROM users UNION ALL
SELECT 'dealers', count(*) FROM dealers UNION ALL
SELECT 'dealers_by_status', count(DISTINCT status||':'||id) FROM dealers UNION ALL
SELECT 'members', count(*) FROM dealer_members UNION ALL
SELECT 'owner_active', count(*) FROM dealer_members WHERE role='OWNER' AND status='ACTIVE' UNION ALL
SELECT 'invitations', count(*) FROM dealer_invitations UNION ALL
SELECT 'listings', count(*) FROM listings UNION ALL
SELECT 'enquiries', count(*) FROM enquiries UNION ALL
SELECT 'saved', count(*) FROM saved_vehicles UNION ALL
SELECT 'documents', count(*) FROM dealer_documents UNION ALL
SELECT 'audit', count(*) FROM audit_logs UNION ALL
SELECT 'sessions', count(*) FROM sessions UNION ALL
SELECT 'admin_members', count(*) FROM admin_members UNION ALL
SELECT 'tickets', count(*) FROM support_tickets UNION ALL
SELECT 'migrations', count(*) FROM _prisma_migrations;
SELECT md5(string_agg(id::text||status::text||coalesce("verificationStatus"::text,''), ',' ORDER BY id)) dealers_hash FROM dealers;
SELECT md5(string_agg(id::text||status::text||"dealerId"::text, ',' ORDER BY id)) listings_hash FROM listings;
SELECT md5(string_agg(id::text||role::text||status::text||"dealerId"::text||"userId"::text, ',' ORDER BY id)) members_hash FROM dealer_members;
SELECT md5(string_agg(id::text||status::text||"listingId"::text||"customerId"::text||coalesce("contactedById"::text,'')||coalesce("closedById"::text,''), ',' ORDER BY id)) enquiries_hash FROM enquiries;
SELECT count(*) AS listing_search_rows FROM listing_search;
