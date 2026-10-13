import { createServer } from 'node:http';
import assert from 'node:assert/strict';
createServer((req, res) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => {
    assert.equal(req.url, '/loki/api/v1/push');
    assert.equal(
      req.headers.authorization,
      'Basic ' + Buffer.from('test-instance:test-only-loki-token').toString('base64'),
    );
    const streams = JSON.parse(data).streams;
    const records = streams.map((s) => JSON.parse(s.values[0][1]));
    assert(records.every((r) => typeof r.level === 'number'));
    assert(!JSON.stringify(records).includes('secret-'));
    console.log(
      JSON.stringify({
        received: records.length,
        levels: records.map((r) => r.level),
        messages: records.map((r) => r.msg),
        routes: records.filter((r) => r.msg === 'request completed').map((r) => r.route),
        authentication: 'verified',
        redaction: 'verified',
      }),
    );
    res.writeHead(204).end();
  });
}).listen(3100, '0.0.0.0', () => console.log('TEST_RECEIVER_READY'));
