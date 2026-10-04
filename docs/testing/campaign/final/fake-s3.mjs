// A stand-in S3 endpoint that answers every request 200 with an empty body —
// enough for the API's boot-time HeadBucket under STORAGE_DRIVER=minio, so the
// storage-router surface of an S3-driver deployment can be probed locally. It
// stores nothing and records the method/path of every request it receives.
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';

const port = Number(process.env.FAKE_S3_PORT ?? 9909);
const log = process.env.FAKE_S3_LOG ?? '/dev/null';
const seen = [];
createServer((req, res) => {
  seen.push(`${req.method} ${req.url?.split('?')[0]}`);
  writeFileSync(log, `${seen.join('\n')}\n`);
  req.resume();
  req.on('end', () => {
    res.writeHead(200, { 'content-type': 'application/xml', 'content-length': '0' });
    res.end();
  });
}).listen(port, '127.0.0.1');
