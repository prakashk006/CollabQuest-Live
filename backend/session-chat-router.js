function createSessionChatRouter({ sessionManager, legacyHandler }) {
  if (!sessionManager || typeof sessionManager.findSessionByParticipant !== 'function') {
    throw new TypeError('sessionManager is required');
  }
  if (typeof legacyHandler !== 'function') throw new TypeError('legacyHandler is required');

  return {
    routeChat({ broadcasterUserId, message }) {
      if (typeof broadcasterUserId !== 'string' || !/^\d{1,32}$/.test(broadcasterUserId)) {
        return { route: 'rejected', reason: 'invalid_broadcaster' };
      }
      if (!message || typeof message !== 'object'
          || typeof message.displayName !== 'string' || typeof message.text !== 'string') {
        return { route: 'rejected', reason: 'invalid_message' };
      }

      const session = sessionManager.findSessionByParticipant(broadcasterUserId);
      if (!session) {
        return {
          route: 'legacy',
          result: legacyHandler({
            broadcasterUserId,
            displayName: message.displayName,
            text: message.text,
          }),
        };
      }

      const participant = session.participants.find(
        item => item.twitchUserId === broadcasterUserId,
      );
      if (!participant || !['A', 'B'].includes(participant.role)) {
        return { route: 'rejected', reason: 'invalid_membership', sessionId: session.id };
      }
      if (session.status !== 'active') {
        return { route: 'rejected', reason: 'session_inactive', sessionId: session.id };
      }

      // This is routing context only. A later phase will attach a distinct mission
      // engine instance to each session and consume this context.
      return {
        route: 'session',
        sessionId: session.id,
        missionId: session.missionId,
        broadcasterUserId,
        role: participant.role,
        displayName: message.displayName,
        text: message.text,
      };
    },
  };
}

module.exports = { createSessionChatRouter };
