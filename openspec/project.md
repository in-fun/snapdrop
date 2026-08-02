# Project Context

## Purpose

SnapDrop is a browser-based, peer-to-peer file transfer app — an AirDrop alternative that works across platforms with no setup and no signup. Files move directly between devices over WebRTC; the server only brokers discovery and signalling.

## Tech Stack

- **Client:** vanilla JavaScript, no framework, no bundler. Plain IIFE scripts loaded with `defer` from `public/index.html`.
- **Server:** Node.js WebSocket signalling server in `server/`.
- **Offline:** service worker (`public/service-worker.js`) with a hard-coded same-origin asset cache list, keyed on `cacheVersion`.
- **Deploy:** Docker / fly.io (`fly.toml`, `docker-compose*.yml`).
- **i18n:** JSON translation files in `public/lang/` covering 30+ locales.

## Project Conventions

- **No build step for `public/`.** Assets are served as-is. Anything requiring compilation is out of keeping with the project.
- **Adding or removing any file under `public/` requires updating `relativePathsToCache` in `public/service-worker.js` and bumping `cacheVersion`.** Skipping the version bump leaves returning users on a stale shell.
- Theming is driven by a `dark-theme` class on `document.body`; components observe it rather than reading media queries directly.
- User-facing strings belong in `public/lang/*.json`, not inline in markup.
- The app must remain fully functional offline as an installed PWA.

## Constraints

- **Core transfer flow is sacrosanct.** Peer discovery, pairing, drag-and-drop, and transfer progress must never be blocked, overlaid, or delayed by peripheral features.
- **This repository is a fork that owns its own deployment.** Deployment-specific configuration — analytics identifiers, advertising publisher IDs, hosted-service branding — is committed here rather than injected at deploy time. These values are public by construction; hiding them costs a config-injection mechanism and buys nothing. Secrets are still secrets and never belong in the tree.
- Third-party scripts must fail silently; no external dependency may break the app when blocked or unreachable.

## Deployments

- `snap-drop.net` — the public hosted instance this repository is optimized for, and the deployment whose configuration lives in the tree.
- Self-hosted instances — supported, but not the target the repository is tuned for. Features carrying deployment-specific configuration should stay switchable so a self-hoster can turn them off.
