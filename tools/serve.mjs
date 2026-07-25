import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Math.max(1, Number(process.env.PORT) || 8080);
const host = process.env.HOST || '0.0.0.0';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.sql': 'application/sql; charset=utf-8',
};

const server = createServer((request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const candidate = resolve(root, `.${normalize(pathname)}`);
    if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return send(response, 403, 'Forbidden');
    let file = candidate;
    if (!existsSync(file) || !statSync(file).isFile()) {
      const acceptsHtml = String(request.headers.accept || '').includes('text/html');
      if (!acceptsHtml) return send(response, 404, 'Not found');
      file = join(root, 'index.html');
    }
    const extension = extname(file).toLowerCase();
    response.statusCode = 200;
    response.setHeader('Content-Type', MIME[extension] || 'application/octet-stream');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (file.endsWith(`${sep}sw.js`)) {
      response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.setHeader('Service-Worker-Allowed', '/');
    }
    if (request.method === 'HEAD') return response.end();
    createReadStream(file).pipe(response);
  } catch (error) {
    send(response, 500, error?.message || 'Server error');
  }
});

server.listen(port, host, () => {
  console.log(`Chronicles of Eldoria is available at http://localhost:${port}`);
  console.log('Press Ctrl+C to stop the local server.');
});

function send(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.end(body);
}
