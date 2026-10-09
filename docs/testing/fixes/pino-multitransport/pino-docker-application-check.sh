#!/bin/bash
set -euo pipefail
docker network create --internal pino-application-check >/dev/null
docker network connect pino-application-check pino-regression-postgres
trap 'docker rm -f pino-local-receiver pino-app-false pino-app-true pino-worker-true >/dev/null 2>&1 || true; docker network disconnect pino-application-check pino-regression-postgres >/dev/null 2>&1 || true; docker network rm pino-application-check >/dev/null 2>&1 || true' EXIT
docker run -d --name pino-local-receiver --network pino-application-check --mount type=bind,src=/tmp/pino-docker-receiver.mjs,dst=/receiver.mjs,readonly node:24-bookworm-slim node /receiver.mjs >/dev/null
mounts=(
  --mount type=bind,src=/workspace/DealersDrive/node_modules,dst=/app/node_modules,readonly
  --mount type=bind,src=/workspace/DealersDrive/apps/api/node_modules,dst=/app/apps/api/node_modules,readonly
  --mount type=bind,src=/workspace/DealersDrive/apps/api/dist,dst=/app/apps/api/dist,readonly
  --mount type=bind,src=/workspace/DealersDrive/apps/api/package.json,dst=/app/apps/api/package.json,readonly
  --mount type=bind,src=/workspace/DealersDrive/packages/contracts,dst=/app/packages/contracts,readonly
)
for mode in false true; do
  name="pino-app-$mode"
  docker run -d --name "$name" --network pino-application-check --log-driver=json-file --workdir /tmp --env-file /tmp/pino-docker-test.env \
    -e "GRAFANA_CLOUD_LOGS_ENABLED=$mode" -e DATABASE_URL=postgresql://dealersdrive:dealersdrive@pino-regression-postgres:5432/pino_logger_runtime \
    -e NODE_ENV=test -e APP_ENV=local -e STORAGE_DRIVER=local -e CACHE_DRIVER=memory -e MAIL_DRIVER=console -e PHONE_OTP_DRIVER=fake \
    -e SHUTDOWN_DRAIN_MS=0 -e GIT_SHA=96e799020855ea53ee48cdb4510b46734b68e9ac "${mounts[@]}" \
    node:24-bookworm-slim node /app/apps/api/dist/index.js >/dev/null
  ready=false
  for attempt in {1..30}; do
    if docker exec "$name" node -e "fetch('http://127.0.0.1:4000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then ready=true; break; fi
    sleep 1
  done
  if [ "$ready" != true ]; then docker logs "$name"; exit 1; fi
  docker exec "$name" node --input-type=module -e "
    import assert from 'node:assert/strict';
    const ready=await fetch('http://127.0.0.1:4000/health/ready');
    assert.equal(ready.status,200);
    const normal=await fetch('http://127.0.0.1:4000/v1/config/public',{headers:{'x-trace-id':'docker-application-trace'}});
    assert.equal(normal.status,200); await normal.text();
    const missing=await fetch('http://127.0.0.1:4000/missing-test');assert.equal(missing.status,404); await missing.text();
    const metrics=await fetch('http://127.0.0.1:4000/internal/metrics',{headers:{authorization:'Bearer test-metrics-token-0123456789abcdef'}});
    assert.equal(metrics.status,200);assert((await metrics.text()).includes('dealers_drive_http_requests_total'));
    console.log('Actual API readiness, normal request, 404, and authenticated metrics PASS');"
  if [ "$mode" = true ]; then
    for attempt in {1..20}; do
      if docker logs pino-local-receiver 2>/dev/null | rg -q /v1/config/public; then break; fi
      sleep 1
    done
    docker logs pino-local-receiver | rg -q /v1/config/public
  fi
  docker stop --time 20 "$name" >/dev/null
  docker logs "$name" > "/tmp/pino-docker-app-$mode.jsonl"
  node -e 'const fs=require("fs"),assert=require("assert/strict");const rows=fs.readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse);assert(rows.some(r=>r.msg==="dealers-drive api listening"&&r.level===30));assert(rows.some(r=>r.traceId==="docker-application-trace"&&r.status_code===200));assert(rows.every(r=>typeof r.level==="number"));console.log(JSON.stringify({mode:process.argv[2],actualApiStdoutRecords:rows.length,requestTrace:"verified",numericLevels:"verified"}))' "/tmp/pino-docker-app-$mode.jsonl" "$mode"
done
docker run -d --name pino-worker-true --network pino-application-check --log-driver=json-file --workdir /tmp --env-file /tmp/pino-docker-test.env \
  -e GRAFANA_CLOUD_LOGS_ENABLED=true -e JOBS_ENABLED=true -e DATABASE_URL=postgresql://dealersdrive:dealersdrive@pino-regression-postgres:5432/pino_logger_runtime \
  -e NODE_ENV=test -e APP_ENV=local -e STORAGE_DRIVER=local -e CACHE_DRIVER=memory -e MAIL_DRIVER=console -e PHONE_OTP_DRIVER=fake \
  "${mounts[@]}" node:24-bookworm-slim node /app/apps/api/dist/worker.js >/dev/null
for attempt in {1..30}; do
  if docker logs pino-worker-true 2>/dev/null | rg -q 'dealers-drive worker started'; then break; fi
  sleep 1
done
for attempt in {1..20}; do
  if docker logs pino-local-receiver 2>/dev/null | rg -q 'dealers-drive worker started'; then break; fi
  sleep 1
done
docker logs pino-local-receiver | rg -q 'dealers-drive worker started'
docker stop --time 20 pino-worker-true >/dev/null
docker logs pino-worker-true > /tmp/pino-docker-worker.jsonl
node -e 'const fs=require("fs"),assert=require("assert/strict");const rows=fs.readFileSync("/tmp/pino-docker-worker.jsonl","utf8").trim().split("\n").map(JSON.parse);assert(rows.some(r=>r.msg==="dealers-drive worker started"&&r.level===30));assert(rows.every(r=>typeof r.level==="number"));console.log(JSON.stringify({actualWorkerStdoutRecords:rows.length,numericLevels:"verified"}))'
docker logs pino-local-receiver
