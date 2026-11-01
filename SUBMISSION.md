# CollabQuest Live

**Two Streamers. Two Communities. One Shared Mission.**

## One-sentence pitch

CollabQuest Live turns two Twitch communities into one puzzle-solving team by giving each streamer a different clue and synchronizing the shared victory across their dashboards and OBS overlays.

## Problem

Two creators can stream together while their audiences remain separate spectators. We wanted a shared objective that makes exchanging information across communities useful and turns live chat into a game input.

## Solution

Two authenticated streamers create and join a collaborative session. Each receives one role-specific clue for The Locked Vault. Their communities combine the clues and submit an answer through Twitch chat. A correct answer completes only that session's mission and updates both dashboards and both OBS overlays in real time.

## Features built

- Two independent Twitch account logins and channel chat listeners.
- Authenticated session creation and joining with roles A and B.
- One fixed mission with different symbol-order and symbol-value clues.
- Chat answer validation, incorrect-answer rejection and once-only completion.
- Isolated per-session mission state and authorized Socket.IO rooms.
- React dashboards and transparent, role-specific OBS Browser Sources.
- Read-only overlay links with expiration, revocation and cookie-independent access.
- Existing public single-streamer overlay retained.

## Technology stack and Twitch integration

Node.js 24, Express 5, React, Vite, Socket.IO and OBS Browser Sources. Twitch Authorization Code OAuth requests `user:read:chat`; the server stores and refreshes user tokens in memory. Helix Users identifies the account. EventSub WebSockets deliver `channel.chat.message` notifications after Helix subscription creation. Trusted broadcaster context routes answers into the appropriate collaborative session. Neither dashboards nor overlays receive Twitch tokens.

## How Codex was used

Development proceeded through small, reviewed phases in Codex: authentication, chat reception, mission parsing, real-time dashboard, OBS overlay, independent streamer identities, session isolation, private clues and overlay authorization. Codex implemented modules, wrote mocked tests, investigated connection/clipboard failures, and helped prepare submission materials. The developer supplied requirements and verified the complete flow using real Twitch accounts and OBS. Actual thread footage is included in the planned demo.

## What makes it innovative

The interaction spans two channels: each community has useful information the other needs. Role-specific overlays bring those clues into the broadcast itself, while a shared mission instance gives both audiences the same visible success moment. The prototype combines asymmetric clues, Twitch chat input and synchronized broadcast output without requiring viewers to install a separate game client. It does not enforce a contribution from both chats; either chat may submit the combined answer.

## Current limitations

One fixed demo mission; no mission authoring or AI-generated puzzles. Sessions, tokens and credentials are in memory and disappear on restart. The application runs locally and has not been deployed. Source access reveals the fixed puzzle solution. Role authorization controls runtime access, but a clue intentionally shown on stream is not secret from its viewers. Overlay URLs are bearer capabilities and must remain private. This is not a production-readiness claim.

## Future roadmap

Add more collaborative missions, durable state, secure remote hosting, production token lifecycle handling, broader abuse controls and improved session recovery. Extend testing and accessibility as the experience grows.

## Submission handoff

- Event: Codex × TwitchCon Hackathon 2026 (provided by the developer).
- Working deadline: November 2, 2026, 2:00 PM Pacific Time (provided by the developer; confirm in the organizer's submission portal).
- Attach the final repository URL and an under-three-minute demo video in the submission form after reviewing both for secrets.
- Initial Git publication is prepared locally after a staged-file security review. Pushing the repository and submitting the entry remain manual tasks; no deployment is included.
- Use README.md for setup and DEMO-CHECKLIST.md for the recording sequence.

## Preparation validation — November 1, 2026

- HISTORICAL: 45 backend tests passed before all 10 test files were intentionally removed. Automated backend coverage is no longer included; npm test does not run that former suite.
- PASS: Current backend syntax checks passed for all 10 production modules; 24 imports resolved; isolated startup returned HTTP 200 with environment-file loading disabled.
- PASS: `npm run build` in frontend — Vite production build completed, 70 modules transformed.
- PASS: Git's ignore engine, using temporary Git metadata outside this project, confirmed exclusion of backend environment files, frontend local environment files, node_modules, dist, build and coverage paths.
- The initial commit must pass a staged-content scan for credentials and private overlay URLs; only placeholder environment configuration is eligible for staging.
- WARNING: Pattern scans are not a comprehensive secret scanner, dependency audit or production security assessment. Only backend/.env.example was inspected and standardized to safe placeholders/public configuration; real environment files remain unread and excluded.
- Repository publication requires a reviewed local initial commit followed by a separate manual push. No existing Git history was present at the start of preparation.
- Remaining manual work: record/review the demo, verify judge access to repository/video links, confirm the organizer's deadline and form requirements, and submit. No deployment was performed.
