// Online matchmaking over WebSockets. This connects browsers on different PCs through Render.
export function createMatchmaking({ onPlayersChanged, onMatchFound, onPeerState, onPeerEvent, onConnectionStatus } = {}) {
  let socket = null;
  let searching = false;
  let matched = false;
  let destroyed = false;
  let connectTimer = null;
  let latestState = null;
  let peerId = null;
  const id = globalThis.crypto?.randomUUID?.() || `player-${Math.random().toString(36).slice(2)}-${Date.now()}`;

  const webSocketUrl = () => {
    const url = new URL('/ws', window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString();
  };
  const send = message => {
    if (socket?.readyState === WebSocket.OPEN) {
      try { socket.send(JSON.stringify(message)); return true; } catch { return false; }
    }
    return false;
  };
  const setStatus = (status, message = '') => onConnectionStatus?.(status, message);

  function connect() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
    destroyed = false;
    setStatus('connecting', 'Verbinde mit dem Online-Matchmaking …');
    try { socket = new WebSocket(webSocketUrl()); }
    catch (error) { setStatus('error', 'WebSocket konnte nicht gestartet werden.'); return; }

    clearTimeout(connectTimer);
    connectTimer = setTimeout(() => {
      if (socket?.readyState !== WebSocket.OPEN) setStatus('error', 'Der Online-Server antwortet noch nicht. Bitte später erneut versuchen.');
    }, 18000);

    socket.addEventListener('open', () => {
      clearTimeout(connectTimer);
      setStatus('connected', 'Mit Online-Server verbunden.');
      if (searching && !matched) send({ type: 'join-queue' });
    });
    socket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (!message || typeof message.type !== 'string') return;
      if (message.type === 'connected') {
        setStatus('connected', 'Mit Online-Server verbunden.');
      } else if (message.type === 'queue-status') {
        if (searching && !matched) {
          onPlayersChanged?.(1);
          setStatus('queue', 'Warte online auf einen zweiten Spieler …');
        }
      } else if (message.type === 'match-found') {
        if (matched) return;
        matched = true; searching = false; peerId = message.peerId || null;
        onPlayersChanged?.(2);
        setStatus('matched', 'Spieler gefunden. Match startet …');
        onMatchFound?.({ matchId: message.matchId, peerId, playerNumber: message.playerNumber });
      } else if (message.type === 'state') {
        if (!peerId || message.from === peerId) onPeerState?.(message.from, message.state);
      } else if (message.type === 'action') {
        if (!peerId || message.from === peerId) onPeerEvent?.(message.action, message.payload, message.from);
      } else if (message.type === 'peer-disconnected') {
        peerId = null;
        setStatus('peer-disconnected', 'Der andere Spieler hat die Verbindung getrennt.');
        onPeerEvent?.('peer-disconnected', {}, message.from);
      } else if (message.type === 'queue-error') {
        setStatus('error', message.message || 'Matchmaking-Fehler.');
      }
    });
    socket.addEventListener('error', () => setStatus('error', 'Verbindung fehlgeschlagen. Prüfe, ob die Render-App online ist.'));
    socket.addEventListener('close', () => {
      clearTimeout(connectTimer);
      if (!destroyed) {
        setStatus('disconnected', matched ? 'Verbindung zum Match verloren.' : 'Verbindung zum Online-Server verloren.');
        if (searching) onPlayersChanged?.(1);
      }
      socket = null;
    });
  }

  function startSearch() {
    if (searching || matched) return;
    searching = true;
    onPlayersChanged?.(1);
    connect();
    if (socket?.readyState === WebSocket.OPEN) send({ type: 'join-queue' });
  }

  function stopSearch() {
    // startMatch calls this after the server confirms a pair; keep that room connection alive.
    if (matched) { searching = false; return; }
    if (!searching) return;
    searching = false;
    send({ type: 'cancel-queue' });
    setStatus('idle', 'Matchmaking abgebrochen.');
  }

  function sendState(state) {
    latestState = state;
    if (matched) send({ type: 'state', state });
  }
  function sendAction(action, payload) {
    if (matched) send({ type: 'action', action, payload });
  }
  function destroy() {
    destroyed = true;
    clearTimeout(connectTimer);
    if (!matched && searching) send({ type: 'cancel-queue' });
    searching = false;
    try { socket?.close(1000, 'page closed'); } catch {}
    socket = null;
  }
  window.addEventListener('beforeunload', destroy, { once: true });
  return { id, startSearch, stopSearch, sendState, sendAction, getPeerCount: () => matched ? 2 : 1, destroy };
}
