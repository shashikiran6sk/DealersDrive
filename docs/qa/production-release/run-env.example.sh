# Environment for the harness. Copy, adjust, and `source` before running a campaign.
# Every value is a local, synthetic default — never point these at a shared or production system.
export CERT_API=http://localhost:4000      # API, rate limits off
export CERT_API_RL=http://localhost:4001   # API, rate limits on
export CERT_API_S3=http://localhost:4005   # API booted with STORAGE_DRIVER=r2 against fake-s3.mjs
export CERT_WEB=http://localhost:3000      # web app against CERT_API
export CERT_DB=postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive_cert
export CERT_ADMIN_EMAIL=cert-admin@example.test
export CERT_PLAYWRIGHT=/path/to/node_modules/playwright/index.mjs
export CERT_API_LOG=/path/to/api-4000.log
