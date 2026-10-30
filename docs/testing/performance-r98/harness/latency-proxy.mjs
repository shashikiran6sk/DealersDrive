import http from 'node:http';

const TARGET = { host: '127.0.0.1', port: 4000 };
const state = { baseMs: Number(process.env.BASE_MS ?? 0), rules: [] };
const log = [];

function delayFor(method, path) {
  let extra = 0;
  for (const rule of state.rules) {
    if ((rule.method ?? method) === method && path.startsWith(rule.prefix)) extra += rule.ms;
  }
  return state.baseMs + extra;
}

http
  .createServer((req, res) => {
    if (req.url.startsWith('/__latency')) {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        if (req.method === 'POST') Object.assign(state, JSON.parse(body || '{}'));
        if (req.method === 'DELETE') log.length = 0;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ state, log }));
      });
      return;
    }
    const startedAt = Date.now();
    const path = req.url.split('?')[0];
    const wait = delayFor(req.method, path);
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      setTimeout(() => {
        const upstream = http.request(
          { ...TARGET, method: req.method, path: req.url, headers: req.headers },
          (up) => {
            res.writeHead(up.statusCode, up.headers);
            up.pipe(res);
            up.on('end', () =>
              log.push({
                t: startedAt,
                method: req.method,
                url: req.url,
                status: up.statusCode,
                ms: Date.now() - startedAt,
                rid: req.headers['x-request-id'] ?? null,
              }),
            );
          },
        );
        upstream.on('error', () => {
          res.statusCode = 502;
          res.end();
        });
        upstream.end(Buffer.concat(chunks));
      }, wait);
    });
  })
  .listen(4001, () => console.log('latency proxy on 4001'));
