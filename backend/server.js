const crypto = require("crypto");
const http = require('http');
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const { createChatListener } = require('./chat');
const { createMissionEngine } = require('./mission-engine');
const { createRealtimeLayer, getAllowedOrigins } = require('./realtime');
const { createGameSessionManager } = require('./game-session');
const { createSessionChatRouter } = require('./session-chat-router');
const { createSessionMissionRegistry } = require('./session-mission-registry');
const { COOKIE, TTL, readBrowserCookie, createBrowserSessionManager } = require('./browser-session');
const browserSessions = createBrowserSessionManager();
const chatListeners = new Map();
const missionEngine = createMissionEngine();
let realtimeLayer;
let sessionChatRouter;
let sessionMissionRegistry;
let overlayAccess;
const gameSessionManager = createGameSessionManager({
  onLifecycleEvent(event) {
    if (!sessionMissionRegistry) return;
    const changed = sessionMissionRegistry.handleLifecycleEvent(event);
    overlayAccess?.revalidate();
    realtimeLayer?.revalidate();
    if (event.type === 'activated' && changed && realtimeLayer) {
      realtimeLayer.emitSessionMissionState(
        event.session.id,
        sessionMissionRegistry.getPublicState(event.session.id),
      );
    }
  },
});

function handleMissionChatMessage({ displayName, text }) {
  const result = missionEngine.handleChatMessage(text);
  if (result.type === 'incorrect') console.log(`Incorrect answer from ${displayName}`);
  if (result.type === 'success') {
    console.log(`Vault unlocked by ${displayName}`);
    realtimeLayer.broadcastMissionCompleted();
  }
}

function routeIncomingChatMessage({ broadcasterUserId, displayName, text }) {
  const routing = sessionChatRouter.routeChat({
    broadcasterUserId,
    message: { displayName, text },
  });
  if (routing.route !== 'session') return routing;

  const outcome = sessionMissionRegistry.processChat({
    sessionId: routing.sessionId,
    missionId: routing.missionId,
    text: routing.text,
  });
  if (outcome.result.type === 'incorrect') {
    console.log(`Incorrect session answer from ${displayName}`);
  }
  if (outcome.result.type === 'success') {
    console.log(`Session vault unlocked by ${displayName}`);
    realtimeLayer.emitSessionMissionCompleted(routing.sessionId, outcome.publicState);
  }
  return { ...routing, missionResult: outcome.result };
}

const app = express();
overlayAccess = require('./overlay-access').createOverlayAccess({ manager: gameSessionManager });
app.use('/api/sessions', require('./session-api').createSessionApi({
  browserSessions, manager: gameSessionManager, origins: getAllowedOrigins(), overlayAccess,
}));
const httpServer = http.createServer(app);
sessionMissionRegistry = createSessionMissionRegistry({ sessionManager: gameSessionManager });
realtimeLayer = createRealtimeLayer({ httpServer, missionEngine, browserSessions,
  sessionManager: gameSessionManager, missionRegistry: sessionMissionRegistry, overlayAccess });
sessionChatRouter = createSessionChatRouter({
  sessionManager: gameSessionManager,
  legacyHandler: handleMissionChatMessage,
});
const PORT = 3000;
const TWITCH_AUTHORIZE_URL = "https://id.twitch.tv/oauth2/authorize";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_USERS_URL = "https://api.twitch.tv/helix/users";
const OAUTH_STATE_COOKIE = "collabquest_oauth_state";
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const REQUIRED_CHAT_SCOPE = "user:read:chat";
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;
const userTokenStore = new Map();
const tokenRefreshes = new Map();

function getTwitchConfig() {
  const config = {
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
    redirectUri: process.env.TWITCH_REDIRECT_URI,
  };
  const variableNames = {
    clientId: "TWITCH_CLIENT_ID",
    clientSecret: "TWITCH_CLIENT_SECRET",
    redirectUri: "TWITCH_REDIRECT_URI",
  };
  const missing = Object.entries(config)
    .filter(([, value]) => !value || !value.trim())
    .map(([key]) => variableNames[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(", ")}`);
  }

  let redirectUrl;
  try {
    redirectUrl = new URL(config.redirectUri);
  } catch {
    throw new Error("TWITCH_REDIRECT_URI must be a valid URL");
  }

  if (!redirectUrl.pathname.endsWith("/auth/twitch/callback")) {
    throw new Error("TWITCH_REDIRECT_URI must point to /auth/twitch/callback");
  }

  return config;
}

function stateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: OAUTH_STATE_MAX_AGE_MS,
    path: "/auth/twitch/callback",
  };
}

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const cookie of cookieHeader.split(";")) {
    const separatorIndex = cookie.indexOf("=");
    if (separatorIndex === -1) continue;
    const cookieName = cookie.slice(0, separatorIndex).trim();
    if (cookieName !== name) continue;

    try {
      return decodeURIComponent(cookie.slice(separatorIndex + 1).trim());
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function statesMatch(receivedState, storedState) {
  if (typeof receivedState !== "string" || typeof storedState !== "string") {
    return false;
  }

  const received = Buffer.from(receivedState);
  const stored = Buffer.from(storedState);
  return received.length === stored.length && crypto.timingSafeEqual(received, stored);
}

function parseTokenResponse(tokenData, fallbackScopes = []) {
  const scopes = Array.isArray(tokenData.scope) ? tokenData.scope : fallbackScopes;
  const expiresIn = Number(tokenData.expires_in);

  if (typeof tokenData.access_token !== "string" || !tokenData.access_token) {
    throw new Error("Twitch token response did not include an access token");
  }
  if (typeof tokenData.refresh_token !== "string" || !tokenData.refresh_token) {
    throw new Error("Twitch token response did not include a refresh token");
  }
  if (!Number.isFinite(expiresIn) || expiresIn < 0) {
    throw new Error("Twitch token response included an invalid expiry");
  }
  if (!scopes.includes(REQUIRED_CHAT_SCOPE)) {
    throw new Error(`Twitch token is missing the required ${REQUIRED_CHAT_SCOPE} scope`);
  }

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + expiresIn * 1000,
    scopes: [...scopes],
  };
}

async function refreshUserAccessToken(userId) {
  const storedToken = userTokenStore.get(userId);
  if (!storedToken) {
    throw new Error("No Twitch tokens are stored for this user");
  }

  const config = getTwitchConfig();
  const refreshBody = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: storedToken.refreshToken,
  });
  const response = await fetch(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: refreshBody,
  });

  if (!response.ok) {
    throw new Error(`Twitch token refresh failed with status ${response.status}`);
  }

  const refreshedData = await response.json();
  // Twitch can rotate refresh tokens. If it does not return a new one, retain the old one.
  const refreshedToken = parseTokenResponse(
    {
      ...refreshedData,
      refresh_token: refreshedData.refresh_token || storedToken.refreshToken,
    },
    storedToken.scopes,
  );
  userTokenStore.set(userId, refreshedToken);
  return refreshedToken.accessToken;
}

async function getValidUserAccessToken(userId) {
  const storedToken = userTokenStore.get(userId);
  if (!storedToken) {
    throw new Error("No Twitch tokens are stored for this user");
  }

  if (Date.now() < storedToken.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
    return storedToken.accessToken;
  }

  if (!tokenRefreshes.has(userId)) {
    const refresh = refreshUserAccessToken(userId).finally(() => {
      tokenRefreshes.delete(userId);
    });
    tokenRefreshes.set(userId, refresh);
  }
  return tokenRefreshes.get(userId);
}

app.get("/", (req, res) => {
  res.send("CollabQuest Live Backend is Running!");
});

app.get('/auth/me', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.vary('Origin');
  const origin = req.headers.origin;
  if (origin) {
    if (!getAllowedOrigins().includes(origin)) return res.status(403).json({ error: 'origin_denied' });
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
  }
  const user = browserSessions.resolve(readBrowserCookie(req.headers.cookie));
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  return res.json({ user });
});

app.get("/auth/twitch", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("Referrer-Policy", "no-referrer");

  let config;
  try {
    config = getTwitchConfig();
  } catch (error) {
    console.error(`OAuth configuration error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }

  const state = crypto.randomBytes(32).toString("base64url");
  res.cookie(OAUTH_STATE_COOKIE, state, stateCookieOptions());

  const authorizationUrl = new URL(TWITCH_AUTHORIZE_URL);
  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("scope", REQUIRED_CHAT_SCOPE);

  return res.redirect(authorizationUrl.toString());
});

app.get("/auth/twitch/callback", async (req, res) => {
  res.set("Cache-Control", "no-store");

  const cookieOptions = stateCookieOptions();
  const storedState = readCookie(req, OAUTH_STATE_COOKIE);
  res.clearCookie(OAUTH_STATE_COOKIE, {
    httpOnly: cookieOptions.httpOnly,
    sameSite: cookieOptions.sameSite,
    secure: cookieOptions.secure,
    path: cookieOptions.path,
  });

  if (!statesMatch(req.query.state, storedState)) {
    return res.status(400).json({ error: "Invalid or expired OAuth state" });
  }
  if (typeof req.query.error === "string") {
    return res.status(400).json({ error: "Twitch authorization was denied" });
  }
  if (typeof req.query.code !== "string" || !req.query.code.trim()) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  let config;
  try {
    config = getTwitchConfig();
  } catch (error) {
    console.error(`OAuth configuration error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }

  try {
    const tokenBody = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: req.query.code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    });
    const tokenResponse = await fetch(TWITCH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    });

    if (!tokenResponse.ok) {
      console.error(`Twitch token exchange failed with status ${tokenResponse.status}`);
      return res.status(502).json({ error: "Twitch token exchange failed" });
    }

    const tokenData = await tokenResponse.json();
    let parsedToken;
    try {
      parsedToken = parseTokenResponse(tokenData);
    } catch (error) {
      console.error(`Invalid Twitch token response: ${error.message}`);
      return res.status(502).json({ error: "Invalid response from Twitch" });
    }

    const userResponse = await fetch(TWITCH_USERS_URL, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Client-Id": config.clientId,
      },
    });
    if (!userResponse.ok) {
      console.error(`Twitch profile request failed with status ${userResponse.status}`);
      return res.status(502).json({ error: "Unable to retrieve Twitch profile" });
    }

    const userData = await userResponse.json();
    const user = Array.isArray(userData.data) ? userData.data[0] : undefined;
    if (!user) {
      console.error("Twitch profile response did not include a user");
      return res.status(502).json({ error: "Invalid profile response from Twitch" });
    }

    userTokenStore.set(user.id, parsedToken);
    chatListeners.get(user.id)?.stop();
    chatListeners.set(user.id, createChatListener({ userId: user.id,
      clientId: config.clientId, getToken: getValidUserAccessToken,
      onChatMessage: routeIncomingChatMessage }));

    browserSessions.revoke(readBrowserCookie(req.headers.cookie));
    const browserId = browserSessions.create({ id: user.id,
      displayName: typeof user.display_name === 'string' ? user.display_name : user.id });
    res.cookie(COOKIE, browserId, { httpOnly: true, sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production', path: '/', maxAge: TTL });
    return res.json({
      message: "Twitch authorization succeeded",
      user: {
        id: user.id,
        login: user.login,
        displayName: user.display_name,
        profileImageUrl: user.profile_image_url,
      },
      notice:
        "Tokens are stored temporarily in server memory. This is not a production login session.",
    });
  } catch (error) {
    console.error('Twitch OAuth request failed');
    return res.status(502).json({ error: "Unable to complete Twitch authorization" });
  }
});

if (require.main === module) {
  httpServer.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
module.exports.getValidUserAccessToken = getValidUserAccessToken;
module.exports.clearStoredTokensForTests = () => {
  for (const listener of chatListeners.values()) listener.stop();
  chatListeners.clear();
  userTokenStore.clear();
  tokenRefreshes.clear();
};
