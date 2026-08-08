## Context

`snap-drop.net` serves a single URL. `server/server.js` registers a catch-all `app.use((req, res) => res.redirect(301, '/'))` at line 57, so every path that is not a static file 301s to the root — verified against the live origin for `/privacy`, `/terms`, `/about`, `/sitemap.xml`, and arbitrary paths. A side effect of that ordering is that `app.get('/')` on line 61 is unreachable dead code; the root is served by `express.static`'s default `index.html` behavior instead.

The app shell is thin to a crawler by construction. All UI copy is injected client-side by `localization.js` into elements carrying `data-i18n-key`, so the served HTML contains only the language-selector labels, a `<noscript>`-style JavaScript notice, and ~120 words of hardcoded prose inside `<x-about>` that is invisible until the ⓘ icon is clicked.

This is not a defect to repair. The app is a single-purpose utility, and `CONTRIBUTING.md` mandates radical simplicity with the main transfer flow never obstructed; the in-flight `add-ad-monetization` change encodes non-obstruction as a hard requirement of the `monetization` capability. Adding SEO copy to the shell would violate the project's own bar and degrade the product for the sake of a reviewer. The design therefore adds an informational layer *beside* the app rather than inside it.

Relevant constraints from the codebase:

- **No build step for `public/`.** Assets are served as-is; anything requiring compilation is out of keeping.
- **The service worker hard-fails on redirects.** `fromNetwork` in `public/service-worker.js` throws `"Fetch is redirect. Abort usage and cache!"` whenever `response.redirected` is true, and `updateCache` does the same. Any same-origin URL that redirects is broken for clients with the service worker installed. This constraint drives the URL strategy below.
- **Cache-list churn is expensive.** Adding a file to `relativePathsToCache` obliges a `cacheVersion` bump, which forces every returning user to re-download the whole app shell.
- **Express 4.18.2**, `express.static` available with its documented `extensions`, `fallthrough`, and `index` options.

## Goals / Non-Goals

**Goals:**

- Give the origin real pages, at real URLs, carrying original prose — enough that an AdSense reviewer sees a site rather than an app.
- Satisfy the two stated, checkable AdSense requirements: an accessible privacy policy with the specific ad-cookie disclosures, and content that is original rather than replicated from the upstream fork.
- Return honest HTTP status codes: 200 for pages that exist, 404 for paths that do not.
- Leave the app shell, the transfer flow, and the installed-PWA experience byte-for-byte unaffected in behavior.
- Keep the whole thing small enough that a self-hoster can read it in one sitting and delete what they do not want.

**Non-Goals:**

- Server-side rendering of the app shell, or pre-rendering its localized strings.
- A build step, static-site generator, templating engine, or Markdown pipeline.
- Translating page bodies into the other 37 locales.
- Any change to peer discovery, pairing, public rooms, WebRTC transfer, or the signaling protocol.
- Chasing search rankings. The target is policy eligibility and genuine user reference material, not traffic.

## Decisions

### D1 — Four hand-authored static HTML files, no generator

`public/about.html`, `public/how-it-works.html`, `public/privacy.html`, `public/terms.html`. Plain HTML, served as-is by the existing static middleware.

*Alternatives considered.* A Markdown-at-runtime renderer adds a dependency and per-request work for four documents that change a few times a year. A static-site generator adds the build step the project explicitly forbids for `public/`. Rendering the existing `docs/*.md` is worse than either: that text is upstream PairDrop's, so publishing it would reproduce the exact duplicate-content problem being solved.

At four documents, templating costs more than the duplication it removes. Hand-authored HTML is the floor.

### D2 — Extensionless URLs via `extensions: ['html']`, and no redirects anywhere

`app.use(express.static(publicPathAbs, { extensions: ['html'] }))`. A request for `/privacy` finds no such file, appends `.html`, and serves `privacy.html` **directly with 200** — serve-static's documented behavior is to serve, not to redirect.

Both `/privacy` and `/privacy.html` therefore return 200. Rather than redirect one to the other, each page declares `<link rel="canonical" href="https://www.snap-drop.net/privacy">`, which is the standard way to resolve duplicate URLs and costs one line per page.

*Why not redirect.* This is the load-bearing decision. The service worker throws on any redirected response, so redirecting `.html` → extensionless would break those URLs for every client with the service worker installed. `rel=canonical` achieves the same de-duplication with zero redirects.

*Alternatives considered.* Four explicit `app.get('/privacy', ...)` handlers: more code, identical result, and it puts page routing in the server where the pages themselves are static. One `extensions` option beats four route handlers.

### D3 — Correct the route order; the catch-all becomes a real 404

New order: rate limiter → `express.static` (with `extensions`) → `/config` → `app.post('/')` → 404 handler. The final handler returns `public/404.html` with **status 404**, not a redirect. The `POST /` route and the reason it is needed are covered below.

`fallthrough` stays at its default `true` so unmatched static requests fall through to that handler.

*Safety check, and where it was wrong.* Pair and room links are query parameters on the current path — `_getPairUrl()` appends `?pair_key=`, `_getShareRoomUrl()` appends `?room_id=` (`public/scripts/ui.js:1395`, `:1792`) — and `start_url` is `./`. No client feature constructs a path-segment URL, so no *GET* depended on unknown paths resolving to the root.

That check was framed around paths and missed a method. The Web Share Target posts to `/` (`manifest.json`), and `express.static` answers GET and HEAD only, so `POST /` fell through to the new 404 where it previously hit the catch-all redirect and was downgraded to `GET /`. An installed client's service worker intercepts that POST before it reaches the network, so the normal path was unaffected — but the fallback for a worker that is not yet active or has been unregistered was gone. The routing therefore needs an explicit `app.post('/')` returning `303 See Other` to `/`, which is the correct status for a POST→GET transition and does not rely on the browser convention the old 301 depended on.

The general lesson, recorded because it generalises past this change: replacing a catch-all means auditing every **method** the origin previously absorbed, not only every path.

*Why it matters beyond AdSense.* Redirecting every unknown path to a 200 page is a soft 404. It tells crawlers that infinitely many URLs exist and all have the same content, which is its own quality signal against the origin.

The dead `app.get('/')` on line 61 is removed as part of the reordering.

### D4 — Content pages are excluded from the service worker cache entirely

Add the page paths, the shared stylesheet, and `sitemap.xml` to `relativePathsNotToCache` rather than to `relativePathsToCache`.

*Rationale.* These pages are not app shell. Offline access to a privacy policy has no value, while the cost of precaching is real: every copy edit would force a `cacheVersion` bump and a full shell re-download for all returning users. Worse, a *stale* cached policy is a compliance problem in exactly the case that matters — when a disclosure has just been updated. Excluding them means policy edits go live immediately, decoupled from app releases.

*What this does and does not buy.* The precache **list** does not change, so no content page ever forces a bump — now or when one is added later. It does not mean this change avoids a bump entirely: steps 3 and 4 of the migration edit `public/index.html`, which is precached, and a precached file that changes is invisible to returning users until `cacheVersion` moves. One bump is required, at the point `index.html` is first modified.

This follows the precedent already documented in the file for `ads.txt`: "Crawled by ad networks, never fetched by the app. Kept out of the precache and out of the runtime cache so no stale publisher declaration is served." The same reasoning applies verbatim.

*Implementation note.* `doNotCacheRequest` matches the path relative to the service-worker root against the list, so both URL forms need entries — `privacy` and `privacy.html`, and so on for each page. That is explicit and obvious at the cost of being a longer list; changing the matcher to a prefix test would be cleverer and less predictable.

Exact matching alone is not sufficient, though, and the first implementation was wrong here. The matcher must strip the query string and fragment before comparing: a reader referred by an ad or a search result arrives at `/privacy?gclid=…` or `?utm_source=…`, which failed the exact match and so was written into the versioned cache — pinning a stale policy for exactly the visitor this list exists to protect.

One residual gap is accepted rather than fixed, because closing it costs normalisation logic out of proportion to the risk: a percent-encoded variant (`/privacy%2ehtml`) still serves 200 and still misses the match.

Separately, and *not* caused by this change: `cache.match` and `cache.put` key on the full URL, so each distinct `?pair_key=` or `?room_id=` link caches its own copy of the shell. Running the old and new matchers side by side confirms the stripping neither causes nor worsens it — `/?pair_key=abc` is not excluded under either, because stripping the query yields `""`, which is no more present in the list than `"?pair_key=abc"` was. `{ignoreSearch: true}` on `cache.match` would fix the bloat if it ever matters. Recorded here only so a later reader does not misattribute it to the matcher change.

Separately, error responses must never be cached. Unknown paths previously redirected, and the worker threw on redirects, so 404 bodies were unreachable by the cache by accident. Returning a real 404 removed that accident and made them cacheable — a cached 404 outlives the condition that produced it, so `fromNetwork` and `updateCache` both need an explicit `response.ok` guard. The guard must sit *after* `resolve(response)`, so error pages are still served to the user and only the cache write is suppressed.

### D5 — A shared `styles/pages.css`, not inlined CSS

One small stylesheet shared by all pages, matching how the project already organizes styles (`styles-main.css`, `styles-deferred.css`, `placements.css`). It is excluded from the cache alongside the pages.

*Alternative considered.* Inlining ~40 lines of CSS into each page makes every page fully self-contained with no SW entry at all, which is tempting. Rejected because matching the existing project convention is worth more than self-containment, and a single stylesheet keeps the four pages visually consistent as they are edited.

The stylesheet is minimal prose styling — readable measure, system font stack, and the existing dark/light theme colors. Pages do not load the app's scripts, do not register anything, and have no JavaScript.

### D6 — Original prose, and honest attribution

Page bodies are written fresh for this deployment. `/how-it-works` carries the substantive original material: how WebRTC transfer works, what the signaling server does and does not see, device pairing, public rooms, and TURN fallback. This is genuinely differentiating content, because it describes *this* deployment's architecture rather than restating a feature list.

`/about` names the operator, gives a contact address, and states plainly that SnapDrop is a fork of Snapdrop and PairDrop with links to both. Attribution is the right thing to do under the licenses, and it also distinguishes the site from the clone domains it currently resembles.

### D7 — The privacy policy carries the disclosures AdSense specifically names

Per Google's "Required content" page, the policy must state that third-party vendors including Google use cookies to serve ads based on prior visits, that Google's advertising cookies enable it and its partners to serve ads based on visits to this site, and it must link to Google Ads Settings for opting out of personalized advertising, plus the NAI opt-out for other vendors.

The policy also states the facts that are true and unusually favorable here: file contents never traverse the server, transfers are peer-to-peer and encrypted in the browser, and the server relays signaling only. Accuracy is the point — this section is a genuine privacy disclosure, not boilerplate.

### D8 — Localization boundary: link labels are translated, page bodies are not

Footer link labels live in `public/lang/en.json` with `data-i18n-key` wiring, per project convention, and fall back to English for the other 37 locales like everything else. Page bodies are English-only.

*Rationale.* Maintaining legal text in 38 languages is not viable without a translation process, and a mistranslated privacy policy or terms document is worse than an English one — it makes claims the operator cannot verify. Each page states its English-only status in the footer.

### D10 — The verification snippet goes in `<head>` unconditionally, and ships after `/privacy`

`public/index.html` gains Google's verification snippet — `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7669832766470834" crossorigin="anonymous">` — as static markup in `<head>`, present on every page load regardless of placement configuration.

*Why it cannot stay lazy.* `placements.js` injects `AD_TAG_SRC` at runtime inside `load()`, which sits behind `loadDeferredAssets()`, and only for a placement that is enabled and carries a real slot. Today no placement qualifies, so the tag is never injected at all — verified: `grep -c "adsbygoogle.js"` on the live origin returns `0`. Even once a placement is enabled, a crawler that does not execute JavaScript, or that gives up before ~1.6 MB of deferred assets resolve, sees no snippet. Google's stated requirement is that the code sit between `<head>` and `</head>` in the served document. Lazy injection cannot satisfy that.

*This contradicts the `monetization` capability, and the contradiction is real.* Its **Suppression Contexts** requirement states that advertising must be suppressed with "no ad tag requested" in installed-PWA, webview, offline, and undersized-viewport contexts, and its disabled-by-configuration scenario asserts that "with everything disabled the served application makes no third-party ad request at all". An unconditional snippet violates every one of those.

The resolution is to narrow that requirement rather than weaken this one: separate **loading the library** from **issuing an ad request**. The snippet may load anywhere; `adsbygoogle.push()` must still not fire while suppressed, no placement may reserve space, and the layout must remain identical to a build with advertising disabled. That preserves everything the suppression requirement was actually protecting — layout stability, the offline PWA experience, and the transfer flow — while giving up only the "zero third-party bytes" property, which was a means rather than the end.

That narrowing is a `MODIFIED` delta against `monetization`. It cannot be written into this change's existing spec files and is recorded in the proposal as work to be created before implementation.

*Ordering.* The snippet ships **after** `/privacy` is live, never before. It sets third-party cookies, so publishing it on an origin with no policy covering them manufactures the exact violation this change exists to remove.

*Consent exposure, accepted deliberately.* The chosen sequence ships the snippet before `add-ad-monetization`'s CMP work lands, so for a period `adsbygoogle.js` loads for EEA/UK/Switzerland visitors with no consent signal — while no ad request is issued and no ad renders, because every placement stays disabled. The alternatives were rejected: CMP-first blocks resubmission on unfinished work in another change, and geo-gating the snippet adds server-side region detection to a codebase whose stated bar is radical simplicity. The mitigation is a hard gate, not a hope: **no placement may be enabled until the CMP is live.** `/privacy` must disclose the advertising script from the day the snippet ships, not from the day ads begin serving.

### D9 — Discovery

Footer links on the app shell (compact, one row, non-intrusive), reciprocal links between the content pages, a hand-maintained `public/sitemap.xml` listing the five canonical URLs, and a `Sitemap:` directive added to `robots.txt`. `PRIVACYPOLICY_BUTTON_ACTIVE`/`_LINK` are set for the `snap-drop.net` deployment so the existing About-dialog button points at `/privacy` — reusing the mechanism already built rather than adding a second one.

## Risks / Trade-offs

- **Footer links crowd the mobile layout, or worse, obstruct the transfer flow** → Links go in the existing `<footer>`, which is already outside the `#center` scroll region and outside the `#ad-top`/`#ad-bottom` placements. Keep them to one compact row at a small type size. Verify on a narrow viewport that the peer area and drop target are unaffected, since non-obstruction is a hard requirement of the `monetization` capability.
- **Removing the catch-all 301 breaks an unknown external link** → Analysis above shows no client feature constructs path URLs, so only third-party links to invented paths are affected, and those should 404 anyway. The 404 page links back to the app, so a human who lands there is one click from recovery.
- **Approval is not guaranteed.** Google names no specific violation, so this change addresses every failure that is verifiable rather than the one Google actually flagged. The privacy-policy absence and the single-URL origin are certain failures against stated policy; the content-volume judgment is a reviewer's call that four pages may still not satisfy → If rejected again, the next lever is depth of content on `/how-it-works` and a genuine FAQ, not more pages.
- **File-sharing category risk is mitigated, not eliminated.** `/terms` prohibiting infringing use signals intent, but the service remains unmoderated by design (the server cannot inspect what it never receives) → This is inherent to the product and is stated plainly in `/terms` and `/privacy` rather than obscured.
- **Self-hosters inherit operator-specific text.** The pages name the `snap-drop.net` operator and contact address → They are plain static files, trivially editable or deletable, and `/about` says so. Building a configuration mechanism for prose would cost far more than it returns.
- **The sitemap is hand-maintained and will drift** → Five URLs that change roughly never. Automation here would be over-engineering; the task list includes updating it whenever a page is added.

## Migration Plan

1. Ship the pages and `styles/pages.css` first — inert additions, reachable only by direct URL, no behavior change.
2. Ship the routing change (`extensions`, 404 handler, dead-route removal). This is the only step with rollback risk; verify `/`, `/privacy`, `/privacy.html`, `/config`, an unknown path, and a share-target POST before and after.
3. Ship discovery: footer links, `sitemap.xml`, `robots.txt`, and the `PRIVACYPOLICY_BUTTON_*` environment variables. `/privacy` is now live and linked.
4. Ship the verification snippet in `<head>`. Strictly after step 3 — the policy must be live and reachable before the script that requires it. Placements remain disabled.
5. Resubmit to AdSense only after steps 1–4 are live and verified on the deployed origin.
6. **Gate, not a step:** enabling any placement is blocked until `add-ad-monetization`'s CMP work is live. Approval does not lift this gate.

**Rollback:** each step is independent and reverts cleanly. Reverting step 2 restores the catch-all redirect; steps 1, 3, and 4 are additive. Step 4 in particular is a single `<script>` tag whose removal is instant and total — the useful property of putting it in static markup rather than behind runtime logic. No data migration, no persisted state, no `cacheVersion` change to unwind.

Note that step 4 does touch `public/index.html`, which **is** in the precache list, so it requires a `cacheVersion` bump. That is the one bump this change needs, and it belongs to step 4 alone — steps 1–3 leave the precache untouched.

## Open Questions

- Which contact address goes on `/about`? A reachable address is what reviewers look for, and it will receive spam once published. Needs an operator decision before `/about` can be finalized.
- Should `/how-it-works` absorb FAQ-style questions now, or does a separate `/faq` follow if the next review still finds the content thin? Deferred until the resubmission outcome is known — adding it later is cheap.
