# PostgreSQL TLS

`DB_SSL_CA_FILE` is authoritative for Prisma and pg-boss. Remove URL SSL
parameters before passing an explicit verified CA configuration because node-pg
URL parsing can replace the supplied SSL object. Hostname/certificate rejection
stays enabled. Missing/unreadable CA fails startup rather than disabling TLS.
