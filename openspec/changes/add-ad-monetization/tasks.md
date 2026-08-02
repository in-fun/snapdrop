# Tasks

There is no test runner. Every verification step below is manual and in-browser. Unless stated otherwise, run `npm start` and open `http://localhost:3000`.

The policy research and the viewport arithmetic are settled in `design.md` — see *Policy basis* and *Viewport thresholds*. These tasks apply those decisions; they do not re-derive them.

## 1. Prerequisites — external configuration

- [ ] 1.1 Spot-check that the *Policy basis* table in `design.md` still holds. It was verified 2026-08-02; open the five linked sources and confirm nothing has changed. This is a confirmation, not research — but if the refresh prohibition has lifted, stop and reopen the proposal, because the revenue model changes with it.
- [ ] 1.2 Confirm `snap-drop.net` is a verified, approved, serving-eligible site in the AdSense account.
- [ ] 1.3 Create two **fixed-size** display ad units — one for `top` at 320×50, one for `bottom` at 728×90. Do not create responsive units; see the layout-stability decision in `design.md`. Record the publisher ID (`ca-pub-…`) and both slot IDs.
- [ ] 1.4 Enable *Privacy & messaging* → GDPR message and US-state regulations message. Confirm the GDPR message is marked IAB TCF v2.2 certified.

## 2. Publisher declaration

- [ ] 2.1 Create `public/ads.txt` containing the AdSense authorization line for the publisher account from 1.3, per the [Ads.txt guide](https://support.google.com/adsense/answer/12171612): `google.com, pub-…, DIRECT, f08c47fec0942fa0`. The publisher ID is 16 digits and `f08c47fec0942fa0` is Google's TAG certification ID, the same for every publisher.
- [ ] 2.2 Do **not** add `ads.txt` to `relativePathsToCache` in `public/service-worker.js`. It is crawled, not fetched by the app; precaching only risks serving a stale copy.
- [ ] 2.3 Verify: `curl -i http://localhost:3000/ads.txt` returns `200` with a `text/plain` content type and the expected line, served from the origin root rather than a subpath.

## 3. Ad manager module

- [ ] 3.1 Create `public/scripts/ad-manager.js` defining `class AdManager`, following the existing class-plus-`Events`-bus convention rather than an IIFE. Put the configuration constant at the top: publisher ID, per-placement slot ID and size, per-placement `enabled` flag, and a global `enabled` flag. Commit the real identifiers.
- [ ] 3.2 Implement `reserve()`: fully synchronous, no network access, no third-party code. It evaluates the suppression matrix and either leaves a placement at `display: none` or reveals it at its final dimensions.
- [ ] 3.3 Implement the suppression matrix in `reserve()`, failing closed on anything not positively cleared — `matchMedia('(display-mode: standalone)')`, `minimal-ui`, `fullscreen`; webview / in-app browser detection; `navigator.onLine === false`; viewport height below 480px; viewport width below 320px; `bottom` below 1024px width or 800px height; per-placement and global `enabled: false`.
- [ ] 3.4 Confirm the arithmetic behind those thresholds against reality: measure the rendered `footer` height on a 360×640 phone and a 1280×800 desktop and check it against the ≈150px `design.md` derives. If it differs by more than ~20px, recompute the 480px floor from the measured value and update the *Viewport thresholds* section. If it matches, change nothing.
- [ ] 3.5 Implement `load()`: inject the AdSense tag as `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-…" crossorigin="anonymous">` — publisher ID in the query string, `async`, `crossorigin="anonymous"` — wrapped in try/catch. Await nothing, and return nothing any caller can await.
- [ ] 3.6 Push one `adsbygoogle` request per enabled placement, exactly once. Guard the push so a placement already requested can never be requested again, whatever calls in.
- [ ] 3.7 Implement the fast path of fill detection: a `MutationObserver` on each `<ins>` element's `data-ad-status`, collapsing the placement to `display: none` on `unfilled`.
- [ ] 3.8 Implement the guarantee path: a timeout of at most 5 seconds after each request that collapses any placement not confirmed filled. This must be sufficient on its own — `data-ad-status` is undocumented and may change, so the timeout is the real safety net and the observer only makes the common case faster.
- [ ] 3.9 Implement drag transparency: listen on `window` for `dragenter` and `dragover`, adding a class that sets `pointer-events: none` on all placement containers; remove it on `drop`, on `dragend`, and via a ~150ms idle timer reset by each `dragover`. The idle timer is required — `dragleave` on `window` is unreliable when the pointer crosses between elements, and without it an abandoned drag leaves ads permanently unclickable.
- [ ] 3.10 Implement session-stable suppression on `resize` and `orientationchange`: a rendered placement crossing below its gate is hidden and its space returned; a suppressed placement is never revealed and never triggers a request. Debounce so rapid resizing cannot thrash the layout.
- [ ] 3.11 Read the finished module and confirm no code path — timer, visibility handler, connectivity handler, resize handler, `Events` subscription, or transfer callback — can issue a second ad request for a placement. Leave a comment at the push site saying so; this is the requirement most easily broken by a later well-meaning edit.

## 4. Markup

- [ ] 4.1 Add the `top` placement container to `public/index.html` between `</header>` and `<div id="center">`, containing the label element and the `<ins class="adsbygoogle">` element with the 320×50 slot from 1.3.
- [ ] 4.2 Add the `bottom` placement container between `#center` and `<footer>`, same structure, with the 728×90 slot.
- [ ] 4.3 Confirm neither container is a descendant of `#center`. `#center` scrolls internally, and a placement inside it could scroll out of view — losing the permanent viewability the whole approach rests on.
- [ ] 4.4 Give each label a `data-i18n-key` pointing at the key added in §7. Do not inline the English string in markup.
- [ ] 4.5 Add `<link rel="stylesheet" type="text/css" href="styles/ads.css">` to `<head>` next to `styles-main.css`. It must be a direct link rather than a deferred style: `reserve()` runs before fade-in and needs the dimensions already applied.
- [ ] 4.6 Add `<script src="scripts/ad-manager.js" defer></script>` to the script block at the bottom of `index.html`, before `main.js`, so the class is defined when `PairDrop`'s constructor runs.

## 5. Styles and wiring

- [ ] 5.1 Create `public/styles/ads.css`: placements `display: none` by default; **`flex: 0 0 auto`** on every placement container; fixed width and height per breakpoint (320×50 narrow, 728×90 from the desktop breakpoint); `overflow: hidden`; minimum separation from the header control row; muted label style; `body.dark-theme` variants via descendant selectors rather than a `MutationObserver`; and the drag class applying `pointer-events: none`.
- [ ] 5.2 Verify `flex: 0 0 auto` actually holds. On a 360×640 phone with both placements rendered, measure each container and confirm it matches its declared height exactly. Without this, the flex column silently compresses placements and every layout guarantee in the spec fails quietly.
- [ ] 5.3 Give placements a `z-index` no higher than 2, matching `#center` and `footer`. Existing layers run to 20 for `header` and 32 and 40 for overlays. Open the receive-request, receive-file, send-text, and pair-device dialogs with a placement rendered and confirm each dialog and its buttons render above the placement and stay clickable.
- [ ] 5.4 Construct the manager in `PairDrop`'s constructor alongside `themeUI` / `headerUI` / `centerUI` / `footerUI`, and call `reserve()` there — before the fade-in sequence in `initialize()`.
- [ ] 5.5 Call `load()` from `hydrate()`. Confirm `deferredStyles` and `deferredScripts` in `main.js` are unchanged, and that the non-resolving catch block at [main.js:155-166](public/scripts/main.js#L155-L166) is left as-is. That bug is real but out of scope; this change routes around it rather than through it.

## 6. Service worker and versioning

- [ ] 6.1 Add `scripts/ad-manager.js` and `styles/ads.css` to `relativePathsToCache` in `public/service-worker.js`.
- [ ] 6.2 Change `cacheVersion` from `v1.11.2` to `v1.11.2-sd.1`. Do not use `v1.11.3` — the unmerged `feat/ad-banner` branch already claimed it. Do not use `v1.12.0` — that collides with upstream's eventual release. The `-sd.N` suffix marks a fork-local shell revision on an upstream base.
- [ ] 6.3 Leave `version` in `package.json` and the about-page string at [index.html:671](public/index.html#L671) unchanged. They track upstream release lineage; `cacheVersion`'s only contract is uniqueness, and coupling the two is convention rather than requirement.
- [ ] 6.4 Verify the cross-origin passthrough at [service-worker.js:153-159](public/service-worker.js#L153-L159) is unmodified, and that ad requests appear in DevTools → Network without a service-worker annotation.

## 7. Localization

- [ ] 7.1 Add an `advertisement` key to `public/lang/en.json` with the value `Advertisement`. The [ad placement policies](https://support.google.com/adsense/answer/1346295) permit only "Advertisement" or "Sponsored Links" as label wordings, and prohibit misleading headings; do not invent alternatives.
- [ ] 7.2 Verify the `data-i18n-key` wiring renders the label in English, then switch the language selector to a locale with no translation for the key and confirm it falls back to English rather than rendering an empty element or a raw key.

## 8. Verification — behaviour

Each item maps to scenarios in `specs/monetization/spec.md`.

- [ ] 8.1 **Startup isolation.** With placements enabled, block `pagead2.googlesyndication.com` via DevTools → Network request blocking, then repeat with a real ad blocker extension. Confirm the console reaches "UI hydrated", peer discovery works, and a full file transfer completes between two devices on the same network. Repeat with the domain throttled so the request hangs rather than fails, and confirm hydration still completes on its normal timeline.
- [ ] 8.2 **Layout stability.** Record a DevTools performance trace across load with a placement filling. Confirm no layout shift entries attributable to the placement, that header, `#center`, and footer coordinates are identical before and after the ad renders, and that nothing visibly pops in or resizes during the fade-in sequence.
- [ ] 8.3 **No-fill collapse.** Force no-fill by blocking the domain, then again by temporarily pointing a placement at an invalid slot ID. Confirm the placement collapses within 5 seconds in both cases, leaves no visible box or border, returns its space to `#center`, and does not oscillate.
- [ ] 8.4 **Collapse without the fill signal.** Temporarily disable the `data-ad-status` observer and confirm unfilled placements still collapse on the timeout alone, while filled placements are unaffected. This proves the guarantee path is genuinely independent of an undocumented attribute.
- [ ] 8.5 **Drag transparency.** Drag a file from the desktop and release it directly on a filled placement. Confirm the file reaches the send flow and the browser does not navigate to the file. Repeat by dragging across the placement onto the peer canvas and confirm the drop highlight is unchanged. Then abandon a drag outside the window, return, and click an ad to confirm it is still clickable.
- [ ] 8.6 **Suppression — installed PWA.** Install the PWA and launch it standalone on both desktop and Android. Confirm zero `googlesyndication` requests, no placement rendered, and no reserved space.
- [ ] 8.7 **Suppression — offline.** With the PWA installed, go offline and launch. Confirm normal operation, no placements, no ad requests.
- [ ] 8.8 **Suppression — viewport.** On a phone in landscape (below 480px height), confirm `top` is suppressed and the peer discovery area keeps its full height. Below 320px width, confirm `top` is suppressed rather than clipped. Below 1024px width or 800px height, confirm `bottom` is suppressed. Check each boundary from both sides — one pixel above and below — so an off-by-one in the comparison shows up here rather than in production.
- [ ] 8.9 **Session-stable suppression.** Load in portrait with a placement filled, rotate to landscape, and confirm it hides with no new ad request. Rotate back and confirm it stays hidden for the rest of the session. Resize a desktop window back and forth across the `bottom` gate and confirm the same in both directions.
- [ ] 8.10 **No refresh.** Leave the page open for 10 minutes with DevTools → Network recording, backgrounding and restoring the tab, toggling connectivity off and on, and completing a transfer partway through. Confirm exactly one ad request per enabled placement across the whole session. Open a second tab and confirm it requests independently without causing a request in the first.
- [ ] 8.11 **Delineation.** Confirm the "Advertisement" label renders, `top` clears the header control row by the minimum separation, and no placement overlaps the pair-device, join-room, theme, install, or about controls. Tab from the header through to the peer discovery area and confirm focus passes the placement without being trapped. Check both light and dark themes and confirm no bright rectangle appears in dark mode.
- [ ] 8.12 **Consent.** Load the site through a EEA-region VPN. Confirm the application renders and becomes usable *before* the Google consent message appears, that no personalized ad request precedes a decision, and that the peer discovery area and transfer controls stay reachable while the message is displayed. Decline consent and confirm the app remains fully functional with only non-personalized or no ads requested.
- [ ] 8.13 **Cross-device transfer.** With both placements filled, complete a file transfer in each direction between two devices on the same network, and once through a public room. Confirm no regression in discovery time, transfer speed, or dialog behaviour.
- [ ] 8.14 **Service worker upgrade.** Load the site on the old cache version, deploy the change, reload twice, and confirm the new shell activates with markup and assets from the same revision — no placement container present without `ads.css`, and no `ad-manager.js` 404.

## 9. Staged rollout

- [ ] 9.1 Deploy with global `enabled: false`. Confirm zero third-party ad requests and a layout identical to the pre-change build. This proves the kill switch before it is needed.
- [ ] 9.2 Enable `top` only. Deploy and re-run 8.1 through 8.5 and 8.10 against production.
- [ ] 9.3 Let `top` run for at least seven days before changing anything, and record session RPM, fill rate, viewability rate, and impressions per session. These numbers are the baseline for two later decisions: whether `bottom` adds revenue, and whether refresh is worth migrating demand sources for.
- [ ] 9.4 Enable `bottom`. Deploy, re-verify 8.8 and 8.9, and after a further seven days compare session RPM against the 9.3 baseline. Impressions per session should approach two; if session RPM does not rise roughly in proportion, `bottom` is cannibalizing `top` and should be switched back off.
- [ ] 9.5 Confirm `https://snap-drop.net/ads.txt` returns 200 and the AdSense dashboard reports no `ads.txt` warning.
- [ ] 9.6 Check the AdSense Policy Center after the first full week for any placement, invalid-traffic, or content violation, and record the outcome.
