const { randomBytes, createHash } = require('node:crypto');
const { LOCKED_VAULT } = require('./mission-engine');

// Separate capability store: these credentials never resolve as browser identities.
function createOverlayAccess({ manager, now = Date.now, ttl = 8 * 60 * 60 * 1000,
  schedule = setTimeout, cancel = clearTimeout }) {
  const records = new Map(), listeners = new Set();
  const hash = value => createHash('sha256').update(value).digest('hex');
  function revoke(key) {
    const record = records.get(key);
    if (!record) return;
    cancel(record.timer); records.delete(key);
    for (const listener of listeners) listener();
  }
  function valid(record) {
    const session = manager.findSessionByParticipant(record.userId);
    return record.expiresAt > now() && session?.id === record.sessionId
      && session.status === 'active' && session.missionId === LOCKED_VAULT.id
      && session.participants.some(p => p.twitchUserId === record.userId && p.role === record.role);
  }
  function revokeUser(userId) {
    for (const [key, record] of records) if (record.userId === userId) revoke(key);
  }
  return {
    create(userId) {
      const session = manager.findSessionByParticipant(userId);
      const participant = session?.participants.find(p => p.twitchUserId === userId);
      if (session?.status !== 'active' || session.missionId !== LOCKED_VAULT.id
          || !['A', 'B'].includes(participant?.role)) throw new Error('overlay_unavailable');
      revokeUser(userId);
      const credential = randomBytes(32).toString('base64url'), key = hash(credential);
      const expiresAt = now() + ttl;
      const timer = schedule(() => revoke(key), ttl); timer?.unref?.();
      records.set(key, { userId, sessionId: session.id, role: participant.role, expiresAt, timer });
      return { credential, expiresAt };
    },
    resolve(credential) {
      if (typeof credential !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(credential)) return null;
      const key = hash(credential), record = records.get(key);
      if (!record) return null;
      if (!valid(record)) { revoke(key); return null; }
      return { sessionId: record.sessionId, clue: { title: LOCKED_VAULT.title,
        role: record.role, clue: record.role === 'A' ? LOCKED_VAULT.clueA : LOCKED_VAULT.clueB } };
    },
    revalidate() { for (const [key, record] of records) if (!valid(record)) revoke(key); },
    revokeUser,
    onRevoke(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
module.exports = { createOverlayAccess };
