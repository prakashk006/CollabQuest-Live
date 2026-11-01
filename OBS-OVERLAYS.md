# Streamer OBS overlays

Start these in separate PowerShell terminals:

```powershell
Set-Location 'C:\Users\THANGA PRAKASH\CollabQuest-Live\backend'
node server.js
```

```powershell
Set-Location 'C:\Users\THANGA PRAKASH\CollabQuest-Live\frontend'
npm run dev
```

1. In each account's authenticated Chrome profile, open http://localhost:5173 and create/join the same session. Both participants must be active.
2. Each participant clicks **Copy OBS Overlay Link** in their own dashboard. Initial generation creates a new link and revokes that participant's previous link; repeat copying in the mounted component reuses the generated link. Allow clipboard access if prompted, or use the temporary read-only field and Ctrl+C fallback.
3. In OBS Studio, add a Browser Source, paste the entire copied URL (including its fragment), and set width **1920**, height **1080**. Keep Local file unchecked. No OBS login is needed.
4. The prakashhzbuilds source should show Role A's symbol sequence only. The therawarmzz source should show Role B's mapping only. Neither overlay contains login controls or invite codes. Each URL can also be opened in a signed-out Chrome window to verify cookie-independent access.
5. Send the correct answer through either participant's Twitch chat. Both overlays should show UNLOCKED and 100%, with the completion animation. A late-loaded source should show the current completed state immediately.
6. Click **Revoke OBS Link** for one account. Its source should clear the clue and show unavailable; the other should continue working. Copy a replacement link and update the source URL to restore it.
7. Test participant departure: both old links must become invalid, including after the participant rejoins. Stop the backend to check that disconnected overlays clear their clues when the connection loss is detected. Restart and create new links.

The public http://localhost:5173/overlay remains available with its existing behavior.

## Access boundaries

Anyone possessing an overlay URL can view that role's stream-visible clue until expiry or revocation. Treat it as a read-only bearer credential. Do not share the URL on stream, paste it into third-party services, or commit OBS scene exports containing it. A displayed clue is intentionally visible to that stream's viewers.

Links expire after eight hours, are held only in server memory (hashed), and are invalidated on server restart. Credentials cannot act as browser login cookies, modify sessions, choose roles, or obtain Twitch tokens. Session membership and role are checked on every connection and before session broadcasts; lifecycle changes and expiry also disconnect existing sources. Only the requesting socket receives its clue. Shared mission events retain the id/title/status whitelist.

The URL fragment is not sent in HTTP request URLs. Socket.IO carries the credential in its connection-auth packet for both polling and WebSocket transport. Origin validation remains enabled; always load the page from the trusted localhost:5173 origin, not a local file or 127.0.0.1. The page uses no third-party resources or browser storage. Referrer policy is no-referrer; API and Socket.IO responses use no-store. Vite development and preview servers also use these headers. A future production static host must retain these headers and use HTTPS/WSS. These localhost instructions assume backend, frontend and OBS are on the same computer; remote deployment is not configured here.

## Automated verification

```powershell
Set-Location 'C:\Users\THANGA PRAKASH\CollabQuest-Live\backend'
Get-ChildItem *.js | ForEach-Object { node --check $_.FullName }
Set-Location 'C:\Users\THANGA PRAKASH\CollabQuest-Live\frontend'
npm run build
```

Automated backend tests were intentionally removed; the historical 45-test pass is not current test coverage. Current verification uses syntax/import checks, isolated startup and frontend build. Actual OBS rendering and Twitch delivery require the manual checks above.
