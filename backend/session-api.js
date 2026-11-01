const express = require('express');
const { randomBytes, randomUUID } = require('node:crypto');
const { readBrowserCookie } = require('./browser-session');
const { LOCKED_VAULT } = require('./mission-engine');

function createSessionApi({ browserSessions, manager, origins, overlayAccess, now = Date.now }) {
  const router = express.Router(), invites = new Map(), limits = new Map();
  function prune() {
    for (const [code, id] of invites) {
      if (manager.getSession(id)?.status !== 'waiting') invites.delete(code);
    }
    for (const [id, limit] of limits) if (limit.until <= now()) limits.delete(id);
  }
  function view(user) {
    prune();
    const session = manager.findSessionByParticipant(user.id);
    if (!session) return { session: null };
    let inviteCode;
    if (session.hostTwitchUserId === user.id && session.status === 'waiting') {
      inviteCode = [...invites].find(([, id]) => id === session.id)?.[0];
      if (!inviteCode) { inviteCode = randomBytes(16).toString('hex'); invites.set(inviteCode, session.id); }
    }
    return { session: { id: session.id, status: session.status, missionId: session.missionId,
      participants: session.participants.map(p => ({ displayName: p.displayName, role: p.role })) },
    ...(inviteCode ? { inviteCode } : {}) };
  }
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store'); res.vary('Origin');
    if (!origins.includes(req.headers.origin)) return res.status(403).json({ error: 'Request not permitted.' });
    res.set('Access-Control-Allow-Origin', req.headers.origin);
    res.set('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET, POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type, X-CollabQuest-CSRF');
      return res.sendStatus(204);
    }
    req.identity = browserSessions.resolve(readBrowserCookie(req.headers.cookie));
    if (!req.identity) return res.status(401).json({ error: 'Please connect Twitch again.' });
    if (req.method !== 'GET') {
      if (req.headers['x-collabquest-csrf'] !== '1' || !req.is('application/json')) {
        return res.status(403).json({ error: 'Request not permitted.' });
      }
      prune();
      const key = req.identity.id;
      const limit = limits.get(key) || { count: 0, until: now() + 60000 };
      limits.set(key, limit);
      if (++limit.count > 10) return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
    }
    next();
  });
  router.use(express.json({ limit: '1kb' }));
  router.get('/current', (req, res) => res.json(view(req.identity)));
  router.post('/overlay-link', (req, res) => {
    const { credential, expiresAt } = overlayAccess.create(req.identity.id);
    res.set('Referrer-Policy', 'no-referrer');
    res.json({ url: `${req.headers.origin}/streamer-overlay#${credential}`, expiresAt });
  });
  router.post('/overlay-revoke', (req, res) => {
    overlayAccess.revokeUser(req.identity.id);
    res.json({ revoked: true });
  });
  router.get('/clue', (req, res) => {
    const session = manager.findSessionByParticipant(req.identity.id);
    const participant = session?.participants.find(p => p.twitchUserId === req.identity.id);
    if (session?.status !== 'active' || session.missionId !== LOCKED_VAULT.id
        || !['A', 'B'].includes(participant?.role)) {
      return res.status(403).json({ error: 'No active session clue available.' });
    }
    return res.json({ title: LOCKED_VAULT.title, role: participant.role,
      clue: participant.role === 'A' ? LOCKED_VAULT.clueA : LOCKED_VAULT.clueB });
  });
  router.post('/create', (req, res) => {
    const user = req.identity;
    manager.createSession({ sessionId: randomUUID(), missionId: 'locked-vault',
      host: { twitchUserId: user.id, displayName: user.displayName }, role: 'A', actorTwitchUserId: user.id });
    res.status(201).json(view(user));
  });
  router.post('/join', (req, res) => {
    prune();
    const code = req.body?.inviteCode;
    const id = typeof code === 'string' && /^[a-f0-9]{32}$/.test(code) ? invites.get(code) : null;
    if (!id) return res.status(400).json({ error: 'Unable to join. Check your invite and membership.' });
    const user = req.identity;
    manager.joinSession({ sessionId: id, participant: { twitchUserId: user.id, displayName: user.displayName },
      role: 'B', actorTwitchUserId: user.id });
    invites.delete(code);
    res.json(view(user));
  });
  router.post('/leave', (req, res) => {
    const user = req.identity, session = manager.findSessionByParticipant(user.id);
    if (session) manager.leaveSession({ sessionId: session.id, twitchUserId: user.id, actorTwitchUserId: user.id });
    prune(); res.json({ session: null });
  });
  router.use((error, req, res, next) => res.status(400).json({ error: 'Unable to complete request. Check your invite and membership.' }));
  return router;
}
module.exports = { createSessionApi };
