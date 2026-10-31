// Задачник SRM: раздаёт файлы приложения и пропускает запросы к базе (/sb/*) на Supabase.
// Так приложение работает даже там, где адреса *.supabase.co недоступны. Без внешних зависимостей.
'use strict';
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path');
const UPSTREAM = new URL(process.env.SUPABASE_UPSTREAM || 'https://qlyqgltoumxixteerqak.supabase.co');
const ROOT = __dirname, PORT = +process.env.PORT || 8080;
const lib = UPSTREAM.protocol === 'https:' ? https : http;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
const HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection', 'te', 'trailer'];
const PUBLIC = new Set(['index.html', 'app.js', 'styles.css', 'sw.js', 'wood-wheels.js', 'rounded-selects.js', 'document-gen.js', 'manifest.webmanifest', 'favicon.ico', 'favicon-32.png', 'favicon-48.png', 'icon-192.png', 'icon-512.png', 'icon-1024.png', 'apple-touch-icon.png']);

function upstreamOptions(req, sub) {
  const headers = { ...req.headers };
  HOP.forEach(h => delete headers[h]);
  headers.host = UPSTREAM.host;
  delete headers['x-forwarded-host'];
  return { protocol: UPSTREAM.protocol, hostname: UPSTREAM.hostname, port: UPSTREAM.port || undefined, method: req.method, path: sub, headers, servername: UPSTREAM.hostname };
}

function proxy(req, res, sub) {
  const up = lib.request(upstreamOptions(req, sub), r => {
    const h = { ...r.headers }; HOP.forEach(k => delete h[k]);
    res.writeHead(r.statusCode, h);
    r.pipe(res);
  });
  up.setTimeout(30000, () => up.destroy(new Error('timeout')));
  up.on('error', e => { if (!res.headersSent) { res.writeHead(502, { 'content-type': 'application/json' }); } res.end(JSON.stringify({ message: 'Нет связи с базой: ' + e.message })); });
  req.pipe(up);
}

function serveStatic(req, res, p) {
  let name = decodeURIComponent(p.replace(/^\/+/, '')) || 'index.html';
  if (!PUBLIC.has(name)) name = 'index.html';
  fs.readFile(path.join(ROOT, name), (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(name);
    res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': name === 'index.html' || name === 'sw.js' ? 'no-cache' : 'public, max-age=3600', 'x-content-type-options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (u.pathname === '/sb' || u.pathname.startsWith('/sb/')) return proxy(req, res, u.pathname.slice(3) + u.search || '/');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res, u.pathname);
});

// WebSocket (Realtime): /sb/realtime/v1/websocket → wss://<project>.supabase.co/realtime/v1/websocket
server.on('upgrade', (req, socket, head) => {
  const u = new URL(req.url, 'http://x');
  if (!u.pathname.startsWith('/sb/')) return socket.destroy();
  const opts = upstreamOptions(req, u.pathname.slice(3) + u.search);
  opts.headers.connection = 'Upgrade'; opts.headers.upgrade = req.headers.upgrade || 'websocket';
  const up = lib.request(opts);
  up.on('upgrade', (r, upSocket, upHead) => {
    let lines = ['HTTP/1.1 101 Switching Protocols'];
    for (const [k, v] of Object.entries(r.headers)) (Array.isArray(v) ? v : [v]).forEach(x => lines.push(k + ': ' + x));
    socket.write(lines.join('\r\n') + '\r\n\r\n');
    if (upHead && upHead.length) socket.write(upHead);
    if (head && head.length) upSocket.write(head);
    upSocket.pipe(socket); socket.pipe(upSocket);
    const end = () => { upSocket.destroy(); socket.destroy(); };
    upSocket.on('error', end); socket.on('error', end); upSocket.on('close', end); socket.on('close', end);
  });
  up.on('response', r => { socket.end('HTTP/1.1 ' + r.statusCode + ' ' + r.statusMessage + '\r\n\r\n'); });
  up.on('error', () => socket.destroy());
  up.end();
});

server.listen(PORT, '0.0.0.0', () => console.log('Задачник SRM: порт ' + PORT + ', база ' + UPSTREAM.host));
