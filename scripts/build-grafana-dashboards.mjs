import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDirectory = join(repositoryRoot, 'observability/grafana/dashboards');
const prometheus = { type: 'prometheus', uid: '${DS_PROMETHEUS}' };
const loki = { type: 'loki', uid: '${DS_LOKI}' };
const selector = 'service="dealers-drive-api",environment=~"$environment"';
const dealerRoutes = '/v1/(dealers.*|search/dealers|locations|dealer.*|admin/dealers.*)';

function target(expr, legendFormat = '', refId = 'A') {
  return { expr, legendFormat, refId };
}

function panel(title, type, targets, options = {}) {
  return {
    title,
    type,
    datasource: options.datasource ?? prometheus,
    targets,
    gridPos: options.gridPos,
    fieldConfig: {
      defaults: {
        color: { mode: 'palette-classic' },
        ...(options.unit ? { unit: options.unit } : {}),
        ...(options.decimals === undefined ? {} : { decimals: options.decimals }),
        ...(options.thresholds ? { thresholds: options.thresholds } : {}),
      },
      overrides: [],
    },
    options: options.panelOptions ?? {
      legend: { displayMode: 'table', placement: 'bottom', calcs: ['lastNotNull'] },
      tooltip: { mode: 'multi', sort: 'desc' },
    },
  };
}

function layOut(panels) {
  const hasSummaryRow = panels.some((item) => item.type === 'stat');
  let statIndex = 0;
  let chartIndex = 0;

  return panels.map((item) => {
    if (item.gridPos) return item;
    if (item.type === 'stat') {
      const index = statIndex++;
      return { ...item, gridPos: { h: 5, w: 6, x: (index % 4) * 6, y: Math.floor(index / 4) * 5 } };
    }

    const index = chartIndex++;
    return {
      ...item,
      gridPos: {
        h: 9,
        w: 12,
        x: (index % 2) * 12,
        y: (hasSummaryRow ? 5 : 0) + Math.floor(index / 2) * 9,
      },
    };
  });
}

function dashboard(uid, title, panels, description, includeLoki = false) {
  const inputs = [
    {
      name: 'DS_PROMETHEUS',
      label: 'Grafana Cloud Metrics',
      type: 'datasource',
      pluginId: 'prometheus',
      pluginName: 'Prometheus',
    },
  ];
  if (includeLoki) {
    inputs.push({
      name: 'DS_LOKI',
      label: 'Grafana Cloud Logs',
      type: 'datasource',
      pluginId: 'loki',
      pluginName: 'Loki',
    });
  }

  return {
    __inputs: inputs,
    __requires: [
      { type: 'grafana', id: 'grafana', name: 'Grafana', version: '11.0.0' },
      { type: 'panel', id: 'timeseries', name: 'Time series', version: '' },
      { type: 'datasource', id: 'prometheus', name: 'Prometheus', version: '' },
      ...(includeLoki ? [{ type: 'datasource', id: 'loki', name: 'Loki', version: '' }] : []),
    ],
    annotations: { list: [] },
    description,
    editable: true,
    fiscalYearStartMonth: 0,
    graphTooltip: 1,
    id: null,
    links: [],
    liveNow: false,
    panels: layOut(panels),
    refresh: '30s',
    schemaVersion: 39,
    tags: ['dealers-drive', 'observability'],
    templating: {
      list: [
        {
          name: 'environment',
          label: 'Environment',
          type: 'query',
          datasource: prometheus,
          definition:
            'label_values(dealers_drive_http_requests_total{service="dealers-drive-api"}, environment)',
          query: {
            query:
              'label_values(dealers_drive_http_requests_total{service="dealers-drive-api"}, environment)',
            refId: 'environment',
          },
          includeAll: true,
          allValue: '.*',
          multi: true,
          refresh: 2,
          current: { text: 'production', value: 'production' },
        },
      ],
    },
    time: { from: 'now-6h', to: 'now' },
    timepicker: {},
    timezone: 'browser',
    title,
    uid,
    version: 1,
    weekStart: '',
  };
}

const status = `sum by (status_code) (rate(dealers_drive_http_requests_total{${selector}}[$__rate_interval]))`;
const requestRate = `sum(rate(dealers_drive_http_requests_total{${selector}}[$__rate_interval]))`;
const errorRatio = (matcher) =>
  `sum(rate(dealers_drive_http_requests_total{${selector},status_code=~"${matcher}"}[5m])) / clamp_min(sum(rate(dealers_drive_http_requests_total{${selector}}[5m])), 0.001)`;
const httpQuantile = (quantile, extra = '') =>
  `histogram_quantile(${quantile}, sum by (le${extra ? `,${extra}` : ''}) (rate(dealers_drive_http_request_duration_seconds_bucket{${selector}}[$__rate_interval])))`;

const dashboards = [
  [
    'dealers-drive-api-overview',
    'Dealers Drive / API Overview',
    [
      panel('Request rate', 'stat', [target(requestRate)], { unit: 'reqps', decimals: 2 }),
      panel('5xx error rate', 'stat', [target(errorRatio('5..'))], {
        unit: 'percentunit',
        decimals: 2,
      }),
      panel('Availability', 'stat', [target(`max(dealers_drive_service_up{${selector}})`)], {
        decimals: 0,
      }),
      panel('p95 latency', 'stat', [target(httpQuantile(0.95))], { unit: 's' }),
      panel(
        'Traffic by method',
        'timeseries',
        [
          target(
            `sum by (method) (rate(dealers_drive_http_requests_total{${selector}}[$__rate_interval]))`,
            '{{method}}',
          ),
        ],
        { unit: 'reqps' },
      ),
      panel('HTTP status breakdown', 'timeseries', [target(status, '{{status_code}}')], {
        unit: 'reqps',
      }),
      panel(
        'Latency percentiles',
        'timeseries',
        [
          target(httpQuantile(0.5), 'p50', 'A'),
          target(httpQuantile(0.95), 'p95', 'B'),
          target(httpQuantile(0.99), 'p99', 'C'),
        ],
        { unit: 's' },
      ),
      panel(
        'Average / rolling min / rolling max',
        'timeseries',
        [
          target(
            `sum(rate(dealers_drive_http_request_duration_seconds_sum{${selector}}[$__rate_interval])) / clamp_min(sum(rate(dealers_drive_http_request_duration_seconds_count{${selector}}[$__rate_interval])), 0.001)`,
            'average',
            'A',
          ),
          target(
            `min(dealers_drive_http_request_extrema_seconds{${selector},quantile="0"})`,
            'minimum (5m)',
            'B',
          ),
          target(
            `max(dealers_drive_http_request_extrema_seconds{${selector},quantile="1"})`,
            'maximum (5m)',
            'C',
          ),
        ],
        { unit: 's' },
      ),
    ],
    'Traffic, availability, errors, and latency for the existing Dealers Drive API.',
  ],
  [
    'dealers-drive-endpoint-performance',
    'Dealers Drive / Endpoint Performance',
    [
      panel(
        'Request rate by endpoint',
        'timeseries',
        [
          target(
            `sum by (method, route) (rate(dealers_drive_http_requests_total{${selector}}[$__rate_interval]))`,
            '{{method}} {{route}}',
          ),
        ],
        { unit: 'reqps' },
      ),
      panel(
        'Request total by endpoint',
        'timeseries',
        [
          target(
            `sum by (method, route) (increase(dealers_drive_http_requests_total{${selector}}[$__range]))`,
            '{{method}} {{route}}',
          ),
        ],
        { decimals: 0 },
      ),
      panel(
        'Status codes by endpoint',
        'timeseries',
        [
          target(
            `sum by (method, route, status_code) (rate(dealers_drive_http_requests_total{${selector}}[$__rate_interval]))`,
            '{{method}} {{route}} · {{status_code}}',
          ),
        ],
        { unit: 'reqps' },
      ),
      panel(
        'p50 / p95 / p99 by endpoint',
        'timeseries',
        [
          target(httpQuantile(0.5, 'method,route'), 'p50 · {{method}} {{route}}', 'A'),
          target(httpQuantile(0.95, 'method,route'), 'p95 · {{method}} {{route}}', 'B'),
          target(httpQuantile(0.99, 'method,route'), 'p99 · {{method}} {{route}}', 'C'),
        ],
        { unit: 's' },
      ),
      panel(
        'Average response time by endpoint',
        'timeseries',
        [
          target(
            `sum by (method, route) (rate(dealers_drive_http_request_duration_seconds_sum{${selector}}[$__rate_interval])) / clamp_min(sum by (method, route) (rate(dealers_drive_http_request_duration_seconds_count{${selector}}[$__rate_interval])), 0.001)`,
            '{{method}} {{route}}',
          ),
        ],
        { unit: 's' },
      ),
      panel(
        'Rolling min / max by endpoint',
        'timeseries',
        [
          target(
            `dealers_drive_http_request_extrema_seconds{${selector},quantile=~"0|1"}`,
            '{{method}} {{route}} · q={{quantile}}',
          ),
        ],
        { unit: 's' },
      ),
      panel(
        'Average DB time per request',
        'timeseries',
        [
          target(
            `sum by (method, route) (rate(dealers_drive_http_request_db_duration_seconds_sum{${selector}}[$__rate_interval])) / clamp_min(sum by (method, route) (rate(dealers_drive_http_request_db_duration_seconds_count{${selector}}[$__rate_interval])), 0.001)`,
            '{{method}} {{route}}',
          ),
        ],
        { unit: 's' },
      ),
      panel(
        'Error ratio by endpoint',
        'timeseries',
        [
          target(
            `sum by (method, route) (rate(dealers_drive_http_requests_total{${selector},status_code=~"4..|5.."}[$__rate_interval])) / clamp_min(sum by (method, route) (rate(dealers_drive_http_requests_total{${selector}}[$__rate_interval])), 0.001)`,
            '{{method}} {{route}}',
          ),
        ],
        { unit: 'percentunit' },
      ),
    ],
    'Endpoint and method-level traffic, status, latency, errors, and database attribution.',
  ],
  [
    'dealers-drive-database-performance',
    'Dealers Drive / Database Performance',
    [
      panel(
        'Database operation rate',
        'timeseries',
        [
          target(
            `sum by (model, operation, outcome) (rate(dealers_drive_db_operations_total{${selector}}[$__rate_interval]))`,
            '{{model}}.{{operation}} · {{outcome}}',
          ),
        ],
        { unit: 'ops' },
      ),
      panel(
        'Database errors',
        'timeseries',
        [
          target(
            `sum by (model, operation) (increase(dealers_drive_db_errors_total{${selector}}[$__rate_interval]))`,
            '{{model}}.{{operation}}',
          ),
        ],
        { decimals: 0 },
      ),
      panel(
        'Slow database operations',
        'timeseries',
        [
          target(
            `sum by (model, operation) (increase(dealers_drive_db_slow_operations_total{${selector}}[$__rate_interval]))`,
            '{{model}}.{{operation}}',
          ),
        ],
        { decimals: 0 },
      ),
      panel(
        'Database p50 / p95 / p99',
        'timeseries',
        [
          target(
            `histogram_quantile(0.5, sum by (le, model, operation) (rate(dealers_drive_db_operation_duration_seconds_bucket{${selector}}[$__rate_interval])))`,
            'p50 · {{model}}.{{operation}}',
            'A',
          ),
          target(
            `histogram_quantile(0.95, sum by (le, model, operation) (rate(dealers_drive_db_operation_duration_seconds_bucket{${selector}}[$__rate_interval])))`,
            'p95 · {{model}}.{{operation}}',
            'B',
          ),
          target(
            `histogram_quantile(0.99, sum by (le, model, operation) (rate(dealers_drive_db_operation_duration_seconds_bucket{${selector}}[$__rate_interval])))`,
            'p99 · {{model}}.{{operation}}',
            'C',
          ),
        ],
        { unit: 's' },
      ),
      panel(
        'Request time vs attributed DB time',
        'timeseries',
        [
          target(
            `sum by (method, route) (rate(dealers_drive_http_request_duration_seconds_sum{${selector}}[$__rate_interval])) / clamp_min(sum by (method, route) (rate(dealers_drive_http_request_duration_seconds_count{${selector}}[$__rate_interval])), 0.001)`,
            'request · {{method}} {{route}}',
            'A',
          ),
          target(
            `sum by (method, route) (rate(dealers_drive_http_request_db_duration_seconds_sum{${selector}}[$__rate_interval])) / clamp_min(sum by (method, route) (rate(dealers_drive_http_request_db_duration_seconds_count{${selector}}[$__rate_interval])), 0.001)`,
            'database · {{method}} {{route}}',
            'B',
          ),
        ],
        { unit: 's' },
      ),
      panel(
        'Database operations per request',
        'timeseries',
        [
          target(
            `sum by (method, route) (rate(dealers_drive_http_request_db_operations_sum{${selector}}[$__rate_interval])) / clamp_min(sum by (method, route) (rate(dealers_drive_http_request_db_operations_count{${selector}}[$__rate_interval])), 0.001)`,
            '{{method}} {{route}}',
          ),
        ],
        { unit: 'short' },
      ),
    ],
    'Prisma operation volume, latency, errors, slow operations, and request-vs-database time.',
  ],
  [
    'dealers-drive-authentication-oauth',
    'Dealers Drive / Authentication & OAuth',
    [
      panel(
        'OAuth outcomes',
        'timeseries',
        [
          target(
            `sum by (audience, outcome) (rate(dealers_drive_oauth_attempts_total{${selector}}[$__rate_interval]))`,
            '{{audience}} · {{outcome}}',
          ),
        ],
        { unit: 'ops' },
      ),
      panel(
        'OAuth failures by reason',
        'timeseries',
        [
          target(
            `sum by (audience, reason) (increase(dealers_drive_oauth_attempts_total{${selector},outcome!="success"}[$__rate_interval]))`,
            '{{audience}} · {{reason}}',
          ),
        ],
        { decimals: 0 },
      ),
      panel(
        'Authentication API traffic',
        'timeseries',
        [
          target(
            `sum by (method, route) (rate(dealers_drive_http_requests_total{${selector},route=~"/v1/auth/.*"}[$__rate_interval]))`,
            '{{method}} {{route}}',
          ),
        ],
        { unit: 'reqps' },
      ),
      panel(
        'Authentication status codes',
        'timeseries',
        [
          target(
            `sum by (route, status_code) (rate(dealers_drive_http_requests_total{${selector},route=~"/v1/auth/.*"}[$__rate_interval]))`,
            '{{route}} · {{status_code}}',
          ),
        ],
        { unit: 'reqps' },
      ),
      panel(
        'Authentication p50 / p95 / p99',
        'timeseries',
        [
          target(
            `histogram_quantile(0.5, sum by (le, route) (rate(dealers_drive_http_request_duration_seconds_bucket{${selector},route=~"/v1/auth/.*"}[$__rate_interval])))`,
            'p50 · {{route}}',
            'A',
          ),
          target(
            `histogram_quantile(0.95, sum by (le, route) (rate(dealers_drive_http_request_duration_seconds_bucket{${selector},route=~"/v1/auth/.*"}[$__rate_interval])))`,
            'p95 · {{route}}',
            'B',
          ),
          target(
            `histogram_quantile(0.99, sum by (le, route) (rate(dealers_drive_http_request_duration_seconds_bucket{${selector},route=~"/v1/auth/.*"}[$__rate_interval])))`,
            'p99 · {{route}}',
            'C',
          ),
        ],
        { unit: 's' },
      ),
      panel(
        'Authentication error ratio',
        'timeseries',
        [
          target(
            `sum by (route) (rate(dealers_drive_http_requests_total{${selector},route=~"/v1/auth/.*",status_code=~"4..|5.."}[$__rate_interval])) / clamp_min(sum by (route) (rate(dealers_drive_http_requests_total{${selector},route=~"/v1/auth/.*"}[$__rate_interval])), 0.001)`,
            '{{route}}',
          ),
        ],
        { unit: 'percentunit' },
      ),
    ],
    'OAuth semantic results and authentication API traffic, errors, and latency.',
  ],
  [
    'dealers-drive-dealer-apis',
    'Dealers Drive / Dealer APIs',
    [
      panel(
        'Dealer API request rate',
        'timeseries',
        [
          target(
            `sum by (method, route) (rate(dealers_drive_http_requests_total{${selector},route=~"${dealerRoutes}"}[$__rate_interval]))`,
            '{{method}} {{route}}',
          ),
        ],
        { unit: 'reqps' },
      ),
      panel(
        'Dealer API status codes',
        'timeseries',
        [
          target(
            `sum by (route, status_code) (rate(dealers_drive_http_requests_total{${selector},route=~"${dealerRoutes}"}[$__rate_interval]))`,
            '{{route}} · {{status_code}}',
          ),
        ],
        { unit: 'reqps' },
      ),
      panel(
        'Directory, search, and portfolio',
        'timeseries',
        [
          target(
            `sum by (route) (rate(dealers_drive_http_requests_total{${selector},route=~"/v1/(dealers.*|search/dealers|locations)"}[$__rate_interval]))`,
            '{{route}}',
          ),
        ],
        { unit: 'reqps' },
      ),
      panel(
        'Dealer and admin actions',
        'timeseries',
        [
          target(
            `sum by (method, route) (rate(dealers_drive_http_requests_total{${selector},route=~"/v1/(dealer.*|admin/dealers.*)"}[$__rate_interval]))`,
            '{{method}} {{route}}',
          ),
        ],
        { unit: 'reqps' },
      ),
      panel(
        'Dealer API p50 / p95 / p99',
        'timeseries',
        [
          target(
            `histogram_quantile(0.5, sum by (le, route) (rate(dealers_drive_http_request_duration_seconds_bucket{${selector},route=~"${dealerRoutes}"}[$__rate_interval])))`,
            'p50 · {{route}}',
            'A',
          ),
          target(
            `histogram_quantile(0.95, sum by (le, route) (rate(dealers_drive_http_request_duration_seconds_bucket{${selector},route=~"${dealerRoutes}"}[$__rate_interval])))`,
            'p95 · {{route}}',
            'B',
          ),
          target(
            `histogram_quantile(0.99, sum by (le, route) (rate(dealers_drive_http_request_duration_seconds_bucket{${selector},route=~"${dealerRoutes}"}[$__rate_interval])))`,
            'p99 · {{route}}',
            'C',
          ),
        ],
        { unit: 's' },
      ),
      panel(
        'Dealer request vs DB time',
        'timeseries',
        [
          target(
            `sum by (route) (rate(dealers_drive_http_request_duration_seconds_sum{${selector},route=~"${dealerRoutes}"}[$__rate_interval])) / clamp_min(sum by (route) (rate(dealers_drive_http_request_duration_seconds_count{${selector},route=~"${dealerRoutes}"}[$__rate_interval])), 0.001)`,
            'request · {{route}}',
            'A',
          ),
          target(
            `sum by (route) (rate(dealers_drive_http_request_db_duration_seconds_sum{${selector},route=~"${dealerRoutes}"}[$__rate_interval])) / clamp_min(sum by (route) (rate(dealers_drive_http_request_db_duration_seconds_count{${selector},route=~"${dealerRoutes}"}[$__rate_interval])), 0.001)`,
            'database · {{route}}',
            'B',
          ),
        ],
        { unit: 's' },
      ),
    ],
    'Existing dealer directory, search, portfolio/details, dealer actions, and admin dealer actions. Vehicle/car search is excluded.',
  ],
  [
    'dealers-drive-errors',
    'Dealers Drive / Errors',
    [
      panel(
        'Meaningful 4xx',
        'timeseries',
        [
          target(
            `sum by (route, status_code) (rate(dealers_drive_http_requests_total{${selector},status_code=~"400|401|403|404|409|429"}[$__rate_interval]))`,
            '{{route}} · {{status_code}}',
          ),
        ],
        { unit: 'reqps' },
      ),
      panel(
        '5xx',
        'timeseries',
        [
          target(
            `sum by (route, status_code) (rate(dealers_drive_http_requests_total{${selector},status_code=~"5.."}[$__rate_interval]))`,
            '{{route}} · {{status_code}}',
          ),
        ],
        { unit: 'reqps' },
      ),
      panel(
        'Error ratio by endpoint',
        'timeseries',
        [
          target(
            `sum by (method, route) (rate(dealers_drive_http_requests_total{${selector},status_code=~"4..|5.."}[$__rate_interval])) / clamp_min(sum by (method, route) (rate(dealers_drive_http_requests_total{${selector}}[$__rate_interval])), 0.001)`,
            '{{method}} {{route}}',
          ),
        ],
        { unit: 'percentunit' },
      ),
      panel(
        'Database errors',
        'timeseries',
        [
          target(
            `sum by (model, operation) (increase(dealers_drive_db_errors_total{${selector}}[$__rate_interval]))`,
            '{{model}}.{{operation}}',
          ),
        ],
        { decimals: 0 },
      ),
      panel(
        'Correlated application logs',
        'logs',
        [
          {
            expr: `{service="dealers-drive-api",environment=~"$environment"} | json | status_code >= 400`,
            refId: 'A',
            queryType: 'range',
          },
        ],
        {
          datasource: loki,
          gridPos: { h: 13, w: 24, x: 0, y: 18 },
          panelOptions: {
            dedupStrategy: 'none',
            enableLogDetails: true,
            showCommonLabels: false,
            showLabels: false,
            showTime: true,
            sortOrder: 'Descending',
            wrapLogMessage: true,
          },
        },
      ),
    ],
    'HTTP and database error trends with structured Loki logs carrying matching trace IDs.',
    true,
  ],
];

await mkdir(outputDirectory, { recursive: true });
for (const definition of dashboards) {
  const [uid, title, panels, description, includeLoki] = definition;
  const model = dashboard(uid, title, panels, description, includeLoki);
  const json = await format(JSON.stringify(model), { parser: 'json' });
  await writeFile(join(outputDirectory, `${uid.replace('dealers-drive-', '')}.json`), json);
}

console.log(`Wrote ${dashboards.length} Grafana dashboards to ${outputDirectory}`);
