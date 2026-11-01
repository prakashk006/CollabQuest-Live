const ENDPOINT = 'wss://eventsub.wss.twitch.tv/ws';
const MIN_KEEPALIVE_GRACE_MS = 1000;
const MAX_KEEPALIVE_GRACE_MS = 5000;

// Dependencies are injectable so tests never contact Twitch.
function createChatListener({ userId, clientId, getToken, Socket = WebSocket,
  request = fetch, log = console.log, now = Date.now, setTimer = setTimeout,
  clearTimer = clearTimeout, random = Math.random, onChatMessage = () => {} }) {
  let stopped = false, current, pending, retry, attempts = 0;
  const sockets = new Set();
  const seen = new Set();
  function dispose(c) {
    if (!c) return;
    sockets.delete(c);
    clearTimer(c.timer);
    c.abort.abort();
    c.socket.close();
  }
  function stop() {
    stopped = true;
    clearTimer(retry);
    for (const c of [...sockets]) dispose(c);
  }
  function phase(c, value) {
    c.phase = value;
    log(`[EventSub] phase=${value}`);
  }
  function fail(c, category) {
    if (stopped || !sockets.has(c)) return;
    log(`[EventSub] failure=${category} phase=${c.phase}`);
    for (const item of [...sockets]) dispose(item);
    current = pending = undefined;
    clearTimer(retry);
    const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)) + random() * 500;
    log(`[EventSub] retry_delay_ms=${delay}`);
    retry = setTimer(() => connect(ENDPOINT, false), delay);
    retry.unref?.();
  }
  function schedule(c, milliseconds, onTimeout) {
    clearTimer(c.timer);
    c.timer = setTimer(onTimeout, milliseconds);
    c.timer.unref?.();
  }
  function armConnectionTimeout(c) {
    schedule(c, 10000, () => fail(c, 'connection_timeout'));
  }
  function armKeepaliveWatchdog(c) {
    const remaining = c.keepaliveDeadline - now();
    if (remaining <= 0) {
      fail(c, 'keepalive_timeout');
      return;
    }
    schedule(c, remaining, () => armKeepaliveWatchdog(c));
  }
  function recordValidMessage(c) {
    c.lastMessageAt = now();
    const grace = Math.min(MAX_KEEPALIVE_GRACE_MS,
      Math.max(MIN_KEEPALIVE_GRACE_MS, c.timeout * 0.2));
    c.keepaliveDeadline = c.lastMessageAt + c.timeout + grace;
    armKeepaliveWatchdog(c);
  }
  function connect(url, migration) {
    if (stopped) return;
    let socket;
    log('[EventSub] phase=connecting');
    try { socket = new Socket(url); } catch {
      log(`[EventSub] failure=${migration ? 'reconnect_error' : 'websocket_error'} phase=connecting`);
      log('[EventSub] retry_delay_ms=30000');
      retry = setTimer(() => connect(ENDPOINT, false), 30000);
      retry.unref?.();
      return;
    }
    const c = { socket, abort: new AbortController(), welcomed: false, timeout: 10000, phase: 'connecting' };
    sockets.add(c);
    if (migration) pending = c; else current = c;
    armConnectionTimeout(c);
    socket.addEventListener('open', () => {
      if (!stopped && sockets.has(c)) phase(c, 'open');
    });
    socket.addEventListener('error', () => fail(c, 'websocket_error'));
    socket.addEventListener('close', ({ code }) => {
      // Keep close diagnostics even when an earlier error already removed this socket.
      if (Number.isInteger(code)) log(`[EventSub] close_code=${code}`);
      if (pending && current === c) { dispose(c); current = undefined; }
      else fail(c, 'websocket_closed');
    });
    socket.addEventListener('message', async ({ data }) => {
      if (stopped || !sockets.has(c)) return;
      let category = 'invalid_event';
      try {
        const { metadata: m, payload: p } = JSON.parse(data);
        if (m.message_type === 'session_welcome' && !c.welcomed) {
          c.welcomed = true;
          if (!p.session.id) throw new Error();
          phase(c, 'welcomed');
          c.timeout = (p.session.keepalive_timeout_seconds || 10) * 1000;
          recordValidMessage(c);
          if (migration) {
            const old = current;
            current = c;
            pending = undefined;
            dispose(old);
            attempts = 0;
            phase(c, 'listening');
            return; // Twitch transfers subscriptions during migration.
          }
          category = 'token_refresh_error';
          const token = await getToken(userId);
          if (!sockets.has(c)) return;
          phase(c, 'subscribing');
          category = 'subscription_http_error';
          const response = await request('https://api.twitch.tv/helix/eventsub/subscriptions', {
            method: 'POST', signal: c.abort.signal,
            headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId,
              'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'channel.chat.message', version: '1',
              condition: { broadcaster_user_id: userId, user_id: userId },
              transport: { method: 'websocket', session_id: p.session.id } }),
          });
          if (!sockets.has(c)) return;
          if (response.status !== 202 && Number.isInteger(response.status)) {
            log(`[EventSub] failure=subscription_http_error http_status=${response.status}`);
          }
          if ([401, 403].includes(response.status)) {
            log('Chat authorization failed; authorize again.'); stop(); return;
          }
          if (response.status !== 202) throw new Error();
          attempts = 0;
          phase(c, 'listening');
        } else if (m.message_type === 'session_keepalive') {
          recordValidMessage(c);
        } else if (m.message_type === 'session_reconnect' && !pending) {
          category = 'reconnect_error';
          const url = new URL(p.session.reconnect_url);
          if (url.protocol !== 'wss:' || url.hostname !== 'eventsub.wss.twitch.tv' || url.username || url.password) throw new Error();
          recordValidMessage(c);
          clearTimer(c.timer);
          connect(p.session.reconnect_url, true);
        } else if (m.message_type === 'revocation') {
          recordValidMessage(c);
          log('Chat subscription revoked; authorize again.'); stop();
        } else if (m.message_type === 'notification') {
          if (!p.subscription || !p.event) throw new Error();
          recordValidMessage(c);
          if (seen.has(m.message_id)) return;
          seen.add(m.message_id);
          if (seen.size > 1000) seen.delete(seen.values().next().value);
          const e = p.event;
          if (p.subscription.type === 'channel.chat.message' && e.broadcaster_user_id === userId &&
              typeof e.chatter_user_name === 'string' && typeof e.message?.text === 'string') {
            const clean = s => s.replace(/[\x00-\x1f\x7f-\x9f]/g, ' ');
            onChatMessage({
              // Use the authenticated subscription context, not event-supplied identity.
              broadcasterUserId: userId,
              displayName: clean(e.chatter_user_name),
              text: clean(e.message.text),
            });
          }
        }
      } catch { fail(c, category); }
    });
  }
  connect(ENDPOINT, false);
  return { stop };
}
module.exports = { createChatListener };
