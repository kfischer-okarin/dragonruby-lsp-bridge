const http = require('http');

process.stdin.on('data', (data) => {
  const request = http.request(
    'http://localhost:9001',
    { method: 'POST' },
    (response) => {
      const bodyChunks = [];

      response.on('data', (chunk) => {
        bodyChunks.push(chunk);
      });

      response.on('end', () => {
        process.stdout.write(Buffer.concat(bodyChunks));
      });
    }
  );
  request.setHeader('Content-Type', 'application/json');
  request.write(data);
  request.end();
});
