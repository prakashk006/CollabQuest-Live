const { Server } = require('socket.io');
const { readBrowserCookie } = require('./browser-session');

const DEFAULT_DEVELOPMENT_ORIGIN = 'http://localhost:5173';
const MAX_CLIENTS = 50;

function sessionRoom(sessionId) {
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(sessionId)) {
    throw new TypeError('invalid session ID');
  }
  return `session:${sessionId}`;
}

function sanitizeMissionState(state) {
  if (!state || typeof state.id !== 'string' || typeof state.title !== 'string'
      || !['active', 'completed'].includes(state.status)) {
    throw new TypeError('invalid public mission state');
  }
  return { id: state.id, title: state.title, status: state.status };
}

function getAllowedOrigins(value = process.env.SOCKET_IO_ORIGINS) {
  if (!value) return [DEFAULT_DEVELOPMENT_ORIGIN];

  const origins = [...new Set(value.split(',').map(origin => origin.trim()).filter(Boolean))];
  if (origins.length === 0) throw new Error('SOCKET_IO_ORIGINS must contain an origin');
  for (const origin of origins) {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error('SOCKET_IO_ORIGINS must contain exact HTTP or HTTPS origins');
    }
  }
  return origins;
}

function createRealtimeLayer({ httpServer, missionEngine, ServerClass = Server,
  browserSessions, sessionManager, missionRegistry, overlayAccess,
  allowedOrigins = getAllowedOrigins(), maxClients = MAX_CLIENTS }) {
  const io = new ServerClass(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
    allowRequest: (req, done) => done(null, allowedOrigins.includes(req.headers.origin)),
    maxHttpBufferSize: 10_000,
    perMessageDeflate: false,
    serveClient: false,
  });
  let completionBroadcast = false;
  io.engine.on?.('headers', headers => {
    headers['Cache-Control'] = 'no-store';
    headers['Referrer-Policy'] = 'no-referrer';
  });
  const clients = new Map();
  function revalidate() {
    for (const [socket, record] of clients) {
      if (record.overlay) {
        const access = overlayAccess?.resolve(record.credential);
        const state = access && missionRegistry.getPublicState(access.sessionId);
        if (!state) { clients.delete(socket); socket.disconnect(true); continue; }
        if (!record.room) {
          record.room = sessionRoom(access.sessionId);
          socket.join(record.room);
          socket.emit('overlay:clue', access.clue);
          socket.emit('mission:state', sanitizeMissionState(state));
        }
        continue;
      }
      const user = browserSessions.resolve(record.credential);
      let session = null;
      try { session = user && sessionManager.findSessionByParticipant(user.id); } catch { /* Fail closed. */ }
      const room = session?.status === 'active' ? sessionRoom(session.id) : null;
      if (record.room && record.room !== room) {
        clients.delete(socket);
        socket.disconnect(true);
        continue;
      }
      if (room && !record.room) {
        const state = missionRegistry.getPublicState(session.id);
        if (!state) continue;
        socket.join(room);
        record.room = room;
        socket.emit('mission:state', sanitizeMissionState(state));
      }
    }
  }
  browserSessions?.onRevoke(revalidate);
  overlayAccess?.onRevoke(revalidate);

  io.use((socket, next) => {
    if (io.engine.clientsCount > maxClients) return next(new Error('server_capacity'));
    if (!allowedOrigins.includes(socket.handshake?.headers?.origin)) return next(new Error('origin_denied'));
    if (Object.hasOwn(socket.handshake?.auth || {}, 'overlayCredential')
        && !overlayAccess?.resolve(socket.handshake.auth.overlayCredential)) return next(new Error('overlay_unavailable'));
    return next();
  });

  io.on('connection', socket => {
    if (Object.hasOwn(socket.handshake?.auth || {}, 'overlayCredential')) {
      clients.set(socket, { overlay: true, credential: socket.handshake.auth.overlayCredential, room: null });
      socket.on('disconnect', () => clients.delete(socket));
      revalidate();
      return;
    }
    if (browserSessions) {
      clients.set(socket, { credential: readBrowserCookie(socket.handshake?.headers?.cookie), room: null });
      socket.on('disconnect', () => clients.delete(socket));
      revalidate();
      if (clients.get(socket)?.room) return;
    }
    socket.emit('mission:state', missionEngine.getPublicState());
  });

  return {
    revalidate,
    broadcastMissionCompleted() {
      const state = missionEngine.getPublicState();
      if (state.status !== 'completed' || completionBroadcast) return false;
      completionBroadcast = true;
      revalidate();
      if (browserSessions) {
        for (const [socket, record] of clients) if (!record.room) socket.emit('mission:completed', state);
      } else io.emit('mission:completed', state);
      return true;
    },

    emitSessionMissionState(sessionId, state) {
      revalidate();
      io.to(sessionRoom(sessionId)).emit('mission:state', sanitizeMissionState(state));
    },

    emitSessionMissionCompleted(sessionId, state) {
      revalidate();
      io.to(sessionRoom(sessionId)).emit('mission:completed', sanitizeMissionState(state));
    },
  };
}

module.exports = { createRealtimeLayer, getAllowedOrigins };
