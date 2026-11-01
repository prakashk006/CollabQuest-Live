class GameSessionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GameSessionError';
    this.code = code;
  }
}

function requireIdentifier(value, fieldName) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value)) {
    throw new GameSessionError('INVALID_INPUT', `${fieldName} is invalid`);
  }
  return value;
}

function requireTwitchUserId(value, fieldName = 'twitchUserId') {
  if (typeof value !== 'string' || !/^\d{1,32}$/.test(value)) {
    throw new GameSessionError('INVALID_INPUT', `${fieldName} is invalid`);
  }
  return value;
}

function requireRole(value) {
  if (value !== 'A' && value !== 'B') {
    throw new GameSessionError('INVALID_INPUT', 'role must be A or B');
  }
  return value;
}

function safeDisplayName(value) {
  if (typeof value !== 'string') {
    throw new GameSessionError('INVALID_INPUT', 'displayName is invalid');
  }
  const normalized = value
    .replace(/[\x00-\x1f\x7f-\x9f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized || normalized.length > 25) {
    throw new GameSessionError('INVALID_INPUT', 'displayName is invalid');
  }
  return normalized;
}

function participantFrom(input, role) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new GameSessionError('INVALID_INPUT', 'participant is invalid');
  }
  return {
    twitchUserId: requireTwitchUserId(input.twitchUserId),
    displayName: safeDisplayName(input.displayName),
    role: requireRole(role),
  };
}

function cloneSession(session) {
  return {
    id: session.id,
    missionId: session.missionId,
    status: session.status,
    hostTwitchUserId: session.hostTwitchUserId,
    participants: session.participants.map(participant => ({ ...participant })),
  };
}

function createGameSessionManager({ onLifecycleEvent = () => {} } = {}) {
  if (typeof onLifecycleEvent !== 'function') {
    throw new TypeError('onLifecycleEvent must be a function');
  }
  const sessions = new Map();
  const findStoredSessionByParticipant = twitchUserId =>
    [...sessions.values()].find(session =>
      session.participants.some(participant => participant.twitchUserId === twitchUserId));

  return {
    createSession({ sessionId, missionId, host, role, actorTwitchUserId }) {
      const id = requireIdentifier(sessionId, 'sessionId');
      const validMissionId = requireIdentifier(missionId, 'missionId');
      const participant = participantFrom(host, role);
      const actor = requireTwitchUserId(actorTwitchUserId, 'actorTwitchUserId');
      if (actor !== participant.twitchUserId) {
        throw new GameSessionError('UNAUTHORIZED', 'actor cannot create for another user');
      }
      if (sessions.has(id)) {
        throw new GameSessionError('SESSION_EXISTS', 'session already exists');
      }
      if (findStoredSessionByParticipant(participant.twitchUserId)) {
        throw new GameSessionError('USER_ALREADY_ASSIGNED', 'user already belongs to a session');
      }

      const session = {
        id,
        missionId: validMissionId,
        status: 'waiting',
        hostTwitchUserId: participant.twitchUserId,
        participants: [participant],
      };
      sessions.set(id, session);
      onLifecycleEvent({ type: 'created', session: cloneSession(session) });
      return cloneSession(session);
    },

    joinSession({ sessionId, participant: input, role, actorTwitchUserId }) {
      const id = requireIdentifier(sessionId, 'sessionId');
      const participant = participantFrom(input, role);
      const actor = requireTwitchUserId(actorTwitchUserId, 'actorTwitchUserId');
      if (actor !== participant.twitchUserId) {
        throw new GameSessionError('UNAUTHORIZED', 'actor cannot join for another user');
      }
      const session = sessions.get(id);
      if (!session) throw new GameSessionError('SESSION_NOT_FOUND', 'session was not found');
      if (session.participants.some(item => item.twitchUserId === participant.twitchUserId)) {
        throw new GameSessionError('DUPLICATE_USER', 'user already belongs to this session');
      }
      if (findStoredSessionByParticipant(participant.twitchUserId)) {
        throw new GameSessionError('USER_ALREADY_ASSIGNED', 'user already belongs to a session');
      }
      if (session.participants.length >= 2) {
        throw new GameSessionError('SESSION_FULL', 'session already has two participants');
      }
      if (session.participants.some(item => item.role === participant.role)) {
        throw new GameSessionError('ROLE_TAKEN', 'role is already assigned');
      }

      session.participants.push(participant);
      session.status = 'active';
      onLifecycleEvent({ type: 'activated', session: cloneSession(session) });
      return cloneSession(session);
    },

    getSession(sessionId) {
      const id = requireIdentifier(sessionId, 'sessionId');
      const session = sessions.get(id);
      return session ? cloneSession(session) : null;
    },

    findSessionByParticipant(twitchUserId) {
      const userId = requireTwitchUserId(twitchUserId);
      const session = findStoredSessionByParticipant(userId);
      return session ? cloneSession(session) : null;
    },

    leaveSession({ sessionId, twitchUserId, actorTwitchUserId }) {
      const id = requireIdentifier(sessionId, 'sessionId');
      const userId = requireTwitchUserId(twitchUserId);
      const actor = requireTwitchUserId(actorTwitchUserId, 'actorTwitchUserId');
      if (actor !== userId) {
        throw new GameSessionError('UNAUTHORIZED', 'actor cannot remove another user');
      }
      const session = sessions.get(id);
      if (!session) throw new GameSessionError('SESSION_NOT_FOUND', 'session was not found');
      if (!session.participants.some(item => item.twitchUserId === userId)) {
        throw new GameSessionError('NOT_A_PARTICIPANT', 'user does not belong to this session');
      }

      if (userId === session.hostTwitchUserId) {
        const closedSession = cloneSession(session);
        sessions.delete(id);
        onLifecycleEvent({ type: 'closed', session: closedSession });
        return { sessionDeleted: true, session: null };
      }

      session.participants = session.participants.filter(item => item.twitchUserId !== userId);
      session.status = 'waiting';
      onLifecycleEvent({ type: 'inactive', session: cloneSession(session) });
      return { sessionDeleted: false, session: cloneSession(session) };
    },
  };
}

module.exports = { GameSessionError, createGameSessionManager };
