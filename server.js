import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 10000);
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary'
};

const httpServer = http.createServer(async (req, res) => {
  try {
    const rawPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
    const requested = rawPath === '/' ? '/index.html' : rawPath;
    const safePath = path.normalize(requested).replace(/^([/\\]|\.\.(?:[/\\]|$))+/, '');
    const fullPath = path.join(__dirname, safePath);
    if (!fullPath.startsWith(__dirname + path.sep) && fullPath !== path.join(__dirname, 'index.html')) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    const data = await readFile(fullPath);
    res.writeHead(200, {
      'Content-Type': mime[path.extname(fullPath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Datei nicht gefunden. Bitte index.html und alle Projektdateien im Hauptverzeichnis lassen.');
  }
});

// Online matchmaking and peer-state relay. Render runs this inside the same Web Service as the game.
const wss = new WebSocketServer({ noServer: true, maxPayload: 24 * 1024 });
const waitingQueue = [];
const liveClients = new Set();
let nextPlayerNumber = 1;
const allowedActions = new Set(['chest-open', 'loot-collected', 'pickup-collected', 'player-damage', 'door-state', 'glass-break']);

function send(client, payload) {
  if (client?.readyState === WebSocket.OPEN) {
    try { client.send(JSON.stringify(payload)); } catch { /* connection is already closing */ }
  }
}
function removeFromQueue(client) {
  const index = waitingQueue.indexOf(client);
  if (index >= 0) waitingQueue.splice(index, 1);
  client.searching = false;
}
function pairWaitingPlayers() {
  while (waitingQueue.length >= 2) {
    const first = waitingQueue.shift();
    const second = waitingQueue.shift();
    if (!first || !second || first.readyState !== WebSocket.OPEN || second.readyState !== WebSocket.OPEN) {
      if (first?.readyState === WebSocket.OPEN) waitingQueue.unshift(first);
      if (second?.readyState === WebSocket.OPEN) waitingQueue.unshift(second);
      continue;
    }
    first.searching = false; second.searching = false;
    const matchId = `match-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    first.matchId = second.matchId = matchId;
    first.peer = second; second.peer = first;
    send(first, { type: 'match-found', matchId, peerId: second.playerId, playerNumber: 1 });
    send(second, { type: 'match-found', matchId, peerId: first.playerId, playerNumber: 2 });
  }
}
function validPlayerState(state) {
  return state && Number.isFinite(state.x) && Number.isFinite(state.y) && Number.isFinite(state.z) &&
    Math.abs(state.x) <= 5000 && Math.abs(state.y) <= 5000 && Math.abs(state.z) <= 5000 &&
    typeof state.phase === 'string' && state.phase.length <= 32 && Number.isFinite(state.yaw);
}
function handleMessage(client, raw) {
  let msg;
  try { msg = JSON.parse(raw.toString()); } catch { return; }
  if (!msg || typeof msg.type !== 'string') return;
  if (msg.type === 'join-queue') {
    if (client.matchId) return;
    if (!client.searching) {
      client.searching = true;
      waitingQueue.push(client);
    }
    send(client, { type: 'queue-status', players: 1 });
    pairWaitingPlayers();
    return;
  }
  if (msg.type === 'cancel-queue') {
    removeFromQueue(client);
    send(client, { type: 'queue-status', players: 0 });
    return;
  }
  if (!client.matchId || !client.peer || client.peer.readyState !== WebSocket.OPEN) return;
  if (msg.type === 'state' && validPlayerState(msg.state)) {
    send(client.peer, { type: 'state', from: client.playerId, state: {
      x: msg.state.x, y: msg.state.y, z: msg.state.z,
      yaw: msg.state.yaw, phase: msg.state.phase
    } });
  } else if (msg.type === 'action' && allowedActions.has(msg.action) && msg.payload && typeof msg.payload === 'object') {
    // Keep messages small and relay only supported gameplay events to the paired player.
    const payloadText = JSON.stringify(msg.payload);
    if (payloadText.length > 12_000) return;
    send(client.peer, { type: 'action', from: client.playerId, action: msg.action, payload: msg.payload });
  }
}

wss.on('connection', (ws, req) => {
  ws.playerId = `p${nextPlayerNumber++}-${Math.random().toString(36).slice(2, 7)}`;
  ws.searching = false; ws.matchId = null; ws.peer = null; ws.isAlive = true;
  liveClients.add(ws);
  send(ws, { type: 'connected', playerId: ws.playerId });
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => handleMessage(ws, raw));
  ws.on('close', () => {
    removeFromQueue(ws);
    liveClients.delete(ws);
    const peer = ws.peer;
    ws.peer = null; ws.matchId = null;
    if (peer && peer.readyState === WebSocket.OPEN) {
      peer.peer = null; peer.matchId = null;
      send(peer, { type: 'peer-disconnected', from: ws.playerId });
    }
  });
  ws.on('error', () => {});
});

httpServer.on('upgrade', (request, socket, head) => {
  let pathname = '/';
  try { pathname = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname; } catch {}
  if (pathname !== '/ws') { socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
});

const heartbeat = setInterval(() => {
  for (const client of liveClients) {
    if (client.isAlive === false) { client.terminate(); continue; }
    client.isAlive = false;
    try { client.ping(); } catch { client.terminate(); }
  }
}, 25_000);
heartbeat.unref();

httpServer.listen(port, '0.0.0.0', () => console.log(`ISLAND DROP mit Online-Matchmaking läuft auf Port ${port}`));
httpServer.on('close', () => { clearInterval(heartbeat); wss.close(); });
