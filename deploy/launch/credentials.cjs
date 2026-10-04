// AWS credential_process: the host renews this scoped session every minute.
process.stdout.write(require('node:fs').readFileSync('/run/aws/session.json', 'utf8'));
