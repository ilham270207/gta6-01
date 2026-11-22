// SOLMAR HEAT — tiny static dev server (Node 22, standard library only).
// Serves this directory on http://localhost:8080 so the game can be played and
// screenshotted locally. No dependencies, no network requests beyond localhost.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const port = Number.parseInt(process.env.PORT ?? '8080', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.md': 'text/plain; charset=utf-8',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let path = normalize(join(here, decodeURIComponent(url.pathname)));
  if (!path.startsWith(resolve(here))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  // The game lives in game/, but serve it at the root for convenience.
  if (url.pathname === '/') path = join(here, 'game', 'index.html');
  if (!existsSync(path)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(res);
});

server.listen(port, () => {
  console.log(`SOLMAR HEAT dev server: http://localhost:${port}  (game at / and /game/)`);
});
