const { createMissionEngine } = require('./mission-engine');

class SessionMissionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SessionMissionError';
    this.code = code;
  }
}

function createSessionMissionRegistry({ sessionManager }) {
  if (!sessionManager || typeof sessionManager.getSession !== 'function') {
    throw new TypeError('sessionManager is required');
  }
  const missions = new Map();

  function requireActiveSession(sessionId, missionId) {
    const session = sessionManager.getSession(sessionId);
    if (!session) throw new SessionMissionError('SESSION_NOT_FOUND', 'session was not found');
    if (session.status !== 'active') {
      throw new SessionMissionError('SESSION_INACTIVE', 'session is not active');
    }
    if (missionId && missionId !== session.missionId) {
      throw new SessionMissionError('MISSION_MISMATCH', 'mission does not match session');
    }
    if (session.missionId !== 'locked-vault') {
      throw new SessionMissionError('UNSUPPORTED_MISSION', 'mission is not supported');
    }
    return session;
  }

  function getOrCreate(sessionId, missionId) {
    const session = requireActiveSession(sessionId, missionId);
    const existing = missions.get(session.id);
    if (existing) return existing;
    const entry = { missionId: session.missionId, engine: createMissionEngine() };
    missions.set(session.id, entry);
    return entry;
  }

  return {
    handleLifecycleEvent({ type, session }) {
      if (!session || typeof session.id !== 'string') return false;
      if (type === 'activated') {
        if (session.missionId !== 'locked-vault') return false;
        getOrCreate(session.id, session.missionId);
        return true;
      }
      if (type === 'created' || type === 'inactive' || type === 'closed') {
        return missions.delete(session.id);
      }
      return false;
    },

    processChat({ sessionId, missionId, text }) {
      if (typeof text !== 'string') {
        throw new SessionMissionError('INVALID_MESSAGE', 'chat text is invalid');
      }
      const entry = getOrCreate(sessionId, missionId);
      const result = entry.engine.handleChatMessage(text);
      return { result, publicState: entry.engine.getPublicState() };
    },

    getPublicState(sessionId) {
      requireActiveSession(sessionId);
      const entry = missions.get(sessionId);
      return entry ? entry.engine.getPublicState() : null;
    },

    has(sessionId) {
      return missions.has(sessionId);
    },
  };
}

module.exports = { SessionMissionError, createSessionMissionRegistry };
