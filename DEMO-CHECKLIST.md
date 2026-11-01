# CollabQuest Live — under-three-minute demo

Target length: **2 minutes 45 seconds**, leaving 15 seconds of margin. Record the real working application; do not simulate Socket.IO updates.

## Before recording

- [ ] Run backend syntax/import checks and frontend production build; automated backend test files have been removed.
- [ ] Start the current backend and Vite frontend; verify ports 3000/5173.
- [ ] Authenticate prakashhzbuilds in Browser A and therawarmzz in Browser B (separate profile/Incognito).
- [ ] Prepare a fresh unsolved session. Confirm host A, joined participant B, and ACTIVE status.
- [ ] Configure two OBS Browser Sources privately at 1920 × 1080. Confirm A's symbols and B's mapping appear on their respective sources.
- [ ] Keep both source views available for a split-screen shot of synchronized completion.
- [ ] Hide browser address bars when showing callback/overlay pages. Close DevTools, OBS source properties, clipboard history, environment files and account settings.
- [ ] Select a safe excerpt of the actual Codex thread showing implementation or clearly labeled historical test results. Inspect it for credentials, private links, cookies and account settings before recording.
- [ ] If recording session joining, crop or mask the invite code. Set up OAuth and overlay URLs off camera.
- [ ] Confirm no private URL is visible in browser tab previews, tooltips, terminal output, scene names or desktop notifications.

## Shot list and narration

| Time | On-screen evidence | Suggested narration |
| --- | --- | --- |
| 0:00–0:15 | Dashboard branding | “CollabQuest Live: Two Streamers. Two Communities. One Shared Mission.” Explain that viewers collaborate rather than simply watch. |
| 0:15–0:35 | Two authenticated dashboards, account names visible | “These are two real Twitch accounts, each with an independent connection.” Do not show the OAuth callback URL or cookies. |
| 0:35–0:55 | Create/join result and ACTIVE session | “One streamer hosts, the other joins. They now share a mission.” Mask invite details if showing the interaction. |
| 0:55–1:20 | Role A and B dashboard clue cards | “A has the symbol order. B has the values. The communities combine their information.” |
| 1:20–1:40 | Two OBS source outputs, not source properties | “Each streamer can broadcast their own clue, with shared mission progress.” Show both ACTIVE / 0%. |
| 1:40–2:05 | Actual Twitch chat, then both source outputs | Enter `!answer 4729` live. Keep both overlays visible long enough to show UNLOCKED / 100%; show dashboards synchronizing too. |
| 2:05–2:25 | Safe excerpt of actual Codex development thread | Explain the phased implementation, historical mocked testing and debugging with real integration feedback. |
| 2:25–2:45 | Completed mission views | “A working local prototype with OAuth, EventSub, isolated sessions and read-only overlays. Next: more missions and persistent hosting.” |

## After recording

- [ ] Video is under 3:00; text and clues are legible, narration audible.
- [ ] Both overlays visibly show UNLOCKED / 100% after the live answer.
- [ ] Review every frame for secrets, OAuth codes/tokens, cookies, private overlay URLs and invite codes. Cut or mask any exposure; revoke any exposed overlay link before sharing.
- [ ] Do not upload OBS scene exports: they can contain private source URLs.
- [ ] Do not include environment files, browser profiles, logs, dependency folders or build output in a submission archive.
- [ ] Review the Git staging list and secret scan before publication. Confirm only intended files are included in the initial commit; never stage real environment files.
- [ ] Verify the final repository and video links are accessible to judges, then complete the official submission manually before the organizer-confirmed deadline.

## Recovery during rehearsal

If overlay creation returns 404, restart the updated backend. A restart invalidates browser sessions, collaborative sessions and overlay links: reconnect both accounts, recreate/join the session and replace both OBS URLs off camera. Clipboard rejection has a manual select-and-copy fallback. If a link expires or is revoked, generate a replacement in that participant's dashboard. Do not weaken authorization or expose secrets to save recording time.
