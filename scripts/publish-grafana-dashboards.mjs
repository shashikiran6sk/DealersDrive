import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const required = ['GRAFANA_URL', 'GRAFANA_SERVICE_ACCOUNT_TOKEN', 'GRAFANA_PROMETHEUS_UID'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}`);
}

const baseUrl = new URL(process.env.GRAFANA_URL);
const token = process.env.GRAFANA_SERVICE_ACCOUNT_TOKEN;
const dashboardDirectory = join(
  dirname(dirname(fileURLToPath(import.meta.url))),
  'observability/grafana/dashboards',
);
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function grafana(path, init) {
  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    headers: { ...headers, ...init?.headers },
  });
  if (!response.ok) {
    throw new Error(`Grafana ${response.status} ${response.statusText}: ${await response.text()}`);
  }
  return response.json();
}

let folderUid = 'dealers-drive-observability';
const existingFolder = await fetch(new URL(`/api/folders/${folderUid}`, baseUrl), { headers });
if (existingFolder.status === 404) {
  const created = await grafana('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ uid: folderUid, title: 'Dealers Drive Observability' }),
  });
  folderUid = created.uid;
} else if (!existingFolder.ok) {
  throw new Error(
    `Unable to inspect Grafana folder: ${existingFolder.status} ${await existingFolder.text()}`,
  );
}

const files = (await readdir(dashboardDirectory)).filter((file) => file.endsWith('.json')).sort();
for (const file of files) {
  let source = await readFile(join(dashboardDirectory, file), 'utf8');
  source = source.replaceAll('${DS_PROMETHEUS}', process.env.GRAFANA_PROMETHEUS_UID);
  if (source.includes('${DS_LOKI}')) {
    if (!process.env.GRAFANA_LOKI_UID) {
      throw new Error(`${file} requires GRAFANA_LOKI_UID`);
    }
    source = source.replaceAll('${DS_LOKI}', process.env.GRAFANA_LOKI_UID);
  }

  const dashboard = JSON.parse(source);
  delete dashboard.__inputs;
  await grafana('/api/dashboards/db', {
    method: 'POST',
    body: JSON.stringify({
      dashboard,
      folderUid,
      overwrite: true,
      message: 'Publish Dealers Drive observability dashboards',
    }),
  });
  console.log(`Published ${dashboard.title}`);
}
