# Environment for the harness. Copy, adjust, and `source` before running a campaign.
# Every value is a local, synthetic default — never point these at a shared or production system.
export CERT_REPO_ROOT=/path/to/DealersDrive
export CERT_API=http://localhost:4000          # API, rate limits off
export CERT_API_RL=http://localhost:4001       # API, rate limits on
export CERT_API_DBDOWN=http://localhost:4002   # API whose database is unreachable
export CERT_API_S3=http://localhost:4005       # API with an S3 driver against fake-s3.mjs
export CERT_API_MSG91=http://localhost:4007    # API with PHONE_OTP_DRIVER=msg91 + fault preload
export CERT_WEB=http://localhost:3000          # web against CERT_API
export CERT_WEB_PROD=http://localhost:3001     # web with APP_ENV=production and a public origin
export CERT_WEB_DOWN=http://localhost:3002     # web whose API is unreachable
export CERT_WEB_PROXIED=http://localhost:3003  # web reaching the API through u04's proxy (:4010)
export CERT_DB=postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive_cert
export CERT_ADMIN_EMAIL=cert-admin@example.test
export CERT_STORAGE=/path/to/storage           # the API's STORAGE_LOCAL_DIR
export CERT_PLAYWRIGHT=/path/to/node_modules/playwright/index.mjs
export CERT_API_LOG=/path/to/api-4000.log      # comma-separated if the API was restarted
