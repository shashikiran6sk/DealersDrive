#!/bin/bash
set -euo pipefail
cd /workspace/DealersDrive
docker network create --internal pino-local-check >/dev/null
trap 'docker rm -f pino-local-receiver pino-runtime-false pino-runtime-true >/dev/null 2>&1 || true; docker network rm pino-local-check >/dev/null 2>&1 || true' EXIT
docker run -d --name pino-local-receiver --network pino-local-check --mount type=bind,src=/tmp/pino-docker-receiver.mjs,dst=/receiver.mjs,readonly node:24-bookworm-slim node /receiver.mjs >/dev/null
for mode in false true; do
  name="pino-runtime-$mode"
  docker run -d --name "$name" --network pino-local-check --log-driver=json-file --workdir /tmp --env-file /tmp/pino-docker-test.env -e "GRAFANA_CLOUD_LOGS_ENABLED=$mode" \
    --mount type=bind,src=/workspace/DealersDrive/node_modules,dst=/app/node_modules,readonly \
    --mount type=bind,src=/workspace/DealersDrive/apps/api/node_modules,dst=/app/apps/api/node_modules,readonly \
    --mount type=bind,src=/workspace/DealersDrive/apps/api/dist,dst=/app/apps/api/dist,readonly \
    --mount type=bind,src=/workspace/DealersDrive/apps/api/package.json,dst=/app/apps/api/package.json,readonly \
    --mount type=bind,src=/workspace/DealersDrive/apps/api/tests/unit/platform/telemetry/fixtures/logger-runtime.mjs,dst=/app/apps/api/fixture.mjs,readonly \
    node:24-bookworm-slim node /app/apps/api/fixture.mjs >/dev/null
  for attempt in {1..30}; do
    if docker logs "$name" 2>/dev/null | rg -q fixturePort; then break; fi
    sleep 1
  done
  port=$(docker logs "$name" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{for(const l of s.trim().split("\n")){const o=JSON.parse(l);if(o.fixturePort)console.log(o.fixturePort)}})')
  docker exec "$name" node -e "fetch('http://127.0.0.1:$port/dealers/test-id',{headers:{'x-trace-id':'docker-test-trace'}}).then(async r=>{if(r.status!==200)process.exit(1);await r.text();console.log('HTTP 200')})"
  docker stop --time 20 "$name" >/dev/null
  docker logs "$name" > "/tmp/pino-docker-$mode.jsonl"
  node -e 'const fs=require("fs"),assert=require("assert/strict");const rows=fs.readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse).filter(r=>r.level);assert(rows.some(r=>r.msg==="runtime info"&&r.level===30));assert(rows.some(r=>r.traceId==="docker-test-trace"&&r.route==="/dealers/:id"));assert(!JSON.stringify(rows).includes("secret-"));console.log(JSON.stringify({mode:process.argv[2],stdoutRecords:rows.length,traceId:"verified",redaction:"verified"}))' "/tmp/pino-docker-$mode.jsonl" "$mode"
done
docker logs pino-local-receiver
