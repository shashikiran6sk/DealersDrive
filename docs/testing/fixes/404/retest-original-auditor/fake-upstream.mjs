import http from 'node:http';
const [, , port, status] = process.argv;
http
  .createServer((req, res) => {
    res.writeHead(Number(status), { 'Content-Type': 'application/problem+json' });
    res.end(
      JSON.stringify({
        type: 'about:blank',
        title: 'Boom',
        status: Number(status),
        code: Number(status) === 503 ? 'SERVICE_UNAVAILABLE' : 'INTERNAL',
        detail:
          'SECRET-CANARY db password=hunter2 at Object.<anonymous> (/srv/app/node_modules/x.js:1:1)',
      }),
    );
  })
  .listen(Number(port), () => console.log('fake upstream', port, status));
