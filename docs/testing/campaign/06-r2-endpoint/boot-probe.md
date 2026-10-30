# Real-process production boot probe (BUG-NEW-013)

`NODE_ENV=production`, `STORAGE_DRIVER=r2`, every other production requirement set with
probe values (no real credentials). No MinIO listening on localhost:9000 in this run.

| Build | S3_ENDPOINT | Outcome |
| --- | --- | --- |
| main `c80d1b2` | omitted | env validation **accepted**; boot dialled `127.0.0.1:9000` (ECONNREFUSED). With a MinIO on localhost — as in the certification environment — it boots. |
| main `c80d1b2` | `http://localhost:9000` | same — accepted, dialled loopback |
| fix | omitted | **refused at validation**: `S3_ENDPOINT: must be the public HTTPS endpoint of the R2 account in production — the default is a local MinIO address.` exit 1 |
| fix | `http://localhost:9000` | refused at validation, same message |
| fix | `https://example-account-id.r2.cloudflarestorage.com` | validation passed; boot proceeded to the storage readiness check (fails here only because the probe account is fictitious) |
