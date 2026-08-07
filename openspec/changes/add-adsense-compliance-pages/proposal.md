## Why

The AdSense application for `snap-drop.net` was rejected under "Meet AdSense program policies" — Google's generic bucket, which names no specific violation. Inspection of the live origin found concrete, verifiable failures against stated policy:

- **The AdSense verification snippet is absent from the served HTML.** `grep -c "adsbygoogle.js"` against the live origin returns `0`. The loader tag is never in the document: `public/scripts/placements.js:59` injects it at runtime and only when a placement is enabled, while both placements ship `enabled: false` with the placeholder slot `0000000000`, which the same file explicitly suppresses. Google's first stated reason a site is not ready to show ads is that the code was not pasted between `<head>` and `</head>` on the correct domain. The reviewer's crawler went looking for the snippet and found nothing. This is a mechanical blocker that no amount of content work resolves.
- **No privacy policy exists anywhere on the origin.** Live `/config` returns `"privacypolicy_button": {}`, so the About dialog's policy button (`public/index.html:723`) stays `hidden`. A clearly labeled, accessible privacy policy disclosing third-party ad cookies is a stated AdSense requirement, not a judgment call. This alone is disqualifying.
- **The origin has exactly one indexable URL.** `server/server.js:57-59` registers a catch-all `app.use((req, res) => res.redirect(301, '/'))`. Verified: `/privacy`, `/terms`, `/about`, `/contact`, `/sitemap.xml`, and arbitrary garbage paths all 301 to `/` and return byte-identical bodies. There is no 404 and no second page.
- **The one page is empty to a crawler.** All UI copy is injected client-side from `lang/en.json` into empty `data-i18n-key` elements. Stripping scripts and SVG from the served HTML leaves the language-selector labels and the string "Enable JavaScript — SnapDrop works only with JavaScript". The only hardcoded prose is ~120 words inside `<x-about>` (`public/index.html:736-762`), invisible until the ⓘ icon is clicked.
- **No terms or acceptable-use policy.** An unmoderated file-transfer service with public internet rooms reads to a reviewer as a file-sharing site, a category Google restricts around facilitating unauthorized distribution of copyrighted material. Nothing on the origin signals otherwise.
- **Content is duplicative.** As a Snapdrop/PairDrop fork, the page is near-identical to `snapdrop.net`, `pairdrop.net`, and a long tail of other clone domains, with no original material to distinguish it.

`public/ads.txt` is correct and correctly served, and the origin's TLS and HTTP→HTTPS and apex→www redirects are healthy; none of these is implicated.

The rejection email itself names no specific violation — it is a template whose only diagnostic signal is a "focus on your content" tip. The findings above are what the site fails when checked against the four causes Google's own "not ready to show ads" page enumerates: missing ad code (fails), site reachability and SSL (passes), insufficient content and navigation (fails), and policy violations (fails, via the absent privacy policy).

The app page is thin *by design* and must stay that way. `CONTRIBUTING.md` mandates radical simplicity and that the main transfer flow is never obstructed, and the in-flight `add-ad-monetization` change already encodes non-obstruction as a hard requirement. So the fix is explicitly **not** to bloat the app shell with SEO copy. The governing principle of this change is: **leave the app page pristine and put the content beside it, at its own URLs.**

This unblocks resubmission. Resubmitting the current site would fail again — the confirmation checkbox on the rejection screen changes nothing about the origin.

## What Changes

- Add four hand-authored static HTML content pages under `public/`, served at extensionless URLs:
  - `/about` — what SnapDrop is, who operates the instance, contact address, and honest attribution to the upstream Snapdrop/PairDrop projects.
  - `/how-it-works` — original technical prose on WebRTC transfer, signaling, device pairing, public rooms, and NAT traversal. This is the substantive, non-duplicative content the origin currently lacks. Note the live signalling server reports `wsFallback: false` and a STUN-only `iceServers`, so this deployment runs no TURN relay and no WebSocket fallback — the page must say what actually happens (the transfer fails) rather than describe a relay that does not exist.
  - `/privacy` — what the instance does and does not collect, the fact that file contents never traverse the server, and third-party advertising and cookie disclosure.
  - `/terms` — acceptable use, prohibition on transferring infringing or unlawful material, and disclaimer of warranty.
- Replace the catch-all 301 in `server/server.js` with real content-page routing and a genuine 404 response. **BREAKING** for anything relying on unknown paths redirecting to `/`.
- Add an explicit `POST /` route answering `303 See Other` to `/`. The static middleware serves `GET` and `HEAD` only, so removing the catch-all would otherwise drop the Web Share Target's network fallback for any client whose service worker is not currently controlling.
- Harden the service worker's cache-exclusion matcher: ignore query strings and fragments, so a reader arriving at `/privacy?gclid=…` still bypasses the cache, and never write error responses to the cache now that unknown paths return a real 404 instead of a redirect.
- Make the pages discoverable: persistent links in the app footer, cross-links between pages, a `sitemap.xml`, and a `Sitemap:` directive in `robots.txt`.
- Keep the pages out of the service worker's precache and runtime cache, following the documented `ads.txt` precedent, so copy edits ship without a `cacheVersion` bump.
- Wire the existing `PRIVACYPOLICY_BUTTON_*` configuration to the new `/privacy` page for the `snap-drop.net` deployment.
- Place the AdSense verification snippet unconditionally in the `<head>` of `public/index.html`, shipped only after `/privacy` is live, so the snippet never loads on an origin without a disclosure covering it. **BREAKING** for the `monetization` capability's suppression guarantee — see below.

Explicitly out of scope: server-side rendering of the app shell, a build step, a static-site generator, a Markdown pipeline, translating the content pages into the other 37 locales, and any change to peer discovery, pairing, or transfer.

## Capabilities

### New Capabilities

- `site-content`: The informational layer that exists alongside the transfer app — the content pages themselves, how they are addressed and served (extensionless URLs, canonical URLs, real 404s), how they are discovered (footer links, sitemap, robots), their caching policy, and the localization boundary between the app shell and the pages.

### Modified Capabilities

- `monetization`: The **Suppression Contexts** requirement currently guarantees that "no ad tag [is] requested" in every suppressing context and that "with everything disabled the served application makes no third-party ad request at all". An unconditional verification snippet in `<head>` contradicts that in every listed context — installed PWA, webview, offline, undersized viewport, and global disable. The requirement must be narrowed to distinguish *loading the tag* from *issuing an ad request*: the library may load, but no `adsbygoogle.push()` may occur while suppressed, and no placement may reserve space or render.

  The `monetization` capability is defined in the in-flight `add-ad-monetization` change and has no main spec under `openspec/specs/` yet, so this delta has no existing file to edit. `specs/monetization/spec.md` must be created before this change is implemented.

## Impact

- **`server/server.js`** — static-middleware options, route ordering, a new `POST /` route, and a 404 handler in place of the catch-all redirect. Note the existing `app.get('/')` handler at line 61 is unreachable dead code, registered after the catch-all `app.use`; the routing rework resolves that.
- **`public/`** — four new HTML pages plus a 404 page, one small shared stylesheet, `sitemap.xml`; edits to `robots.txt`, and to `index.html` for the footer links, a canonical URL, and the verification snippet.
- **`public/service-worker.js`** — new entries in `relativePathsNotToCache`, plus two behavioural changes: the matcher now strips query and fragment before comparing, and error responses are never cached. No content page enters the precache list, so none of them forces a `cacheVersion` bump — but the change does bump it once, because `index.html`, `styles-main.css`, and `lang/en.json` are precached and all three changed.
- **`public/lang/en.json`** — i18n keys for the new footer link labels only. Page bodies are English-only and live in the HTML.
- **Deployment** — `PRIVACYPOLICY_BUTTON_*` environment variables set for `snap-drop.net`. Self-hosters inherit the pages as editable static files; the operator-specific identity and contact details in them are theirs to replace or delete.
- **`public/index.html`** — the verification snippet in `<head>`, in addition to the footer links.
- **Dependencies** — none added, but the snippet introduces a third-party script (`pagead2.googlesyndication.com`) on every page load.
- **Blocks** — `add-ad-monetization` cannot deliver revenue until AdSense approves the origin, which requires this change to ship first.
- **Blocked by, in part** — no ad may actually render until `add-ad-monetization`'s consent work lands. The chosen sequence ships the snippet ahead of the CMP and accepts a window in which `adsbygoogle.js` loads for EEA/UK/Switzerland visitors with no consent signal and no ads serving. That window MUST close before any placement is enabled.
