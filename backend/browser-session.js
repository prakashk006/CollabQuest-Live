const { randomBytes } = require('node:crypto');
const COOKIE = 'collabquest_browser';
const TTL = 8 * 60 * 60 * 1000;
function readBrowserCookie(header = '') {
  const values = header.split(';').map(v => v.trim()).filter(v => v.startsWith(`${COOKIE}=`));
  return values.length === 1 ? values[0].slice(COOKIE.length + 1) : null;
}
function createBrowserSessionManager({ now = Date.now, ttl = TTL } = {}) {
  const records = new Map(), listeners = new Set();
  function revoke(id) {
    const record = records.get(id);
    if (!record) return;
    clearTimeout(record.timer);
    records.delete(id);
    for (const fn of listeners) fn();
  }
  return {
    create(user) {
      if (typeof user.id !== 'string' || !user.id || typeof user.displayName !== 'string') throw new Error('Invalid identity');
      const id = randomBytes(32).toString('base64url');
      const timer = setTimeout(() => revoke(id), ttl); timer.unref();
      records.set(id, { id: user.id, displayName: user.displayName, expiresAt: now() + ttl, timer });
      return id;
    },
    resolve(id) {
      const record = records.get(id);
      if (!record || record.expiresAt <= now()) return null;
      return { id: record.id, displayName: record.displayName };
    },
    revoke,
    onRevoke(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
module.exports = { COOKIE, TTL, readBrowserCookie, createBrowserSessionManager };
