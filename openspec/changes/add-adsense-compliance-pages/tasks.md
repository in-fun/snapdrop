## 1. Prerequisites

- [ ] 1.1 **Operator decision required before 2.2.** Choose the contact address published on `/about`. It must be an address that is actually monitored and that can absorb spam once indexed. Record the choice in this file before proceeding.
- [ ] 1.2 **Research step.** Re-read [AdSense Required content](https://support.google.com/adsense/answer/1348695) and [Eligibility requirements](https://support.google.com/adsense/answer/9724) at implementation time and note any wording changes since this change was written. Policy text moves; the disclosures in task 2.4 must match what the page says on the day the policy is written.
- [ ] 1.3 **Create the `monetization` delta before implementing group 6.** The verification snippet contradicts the `monetization` capability's Suppression Contexts requirement, which forbids any ad tag request while suppressed. That capability lives in the in-flight `add-ad-monetization` change with no main spec yet, so `specs/monetization/spec.md` does not exist in this change and must be created as a `MODIFIED` delta narrowing the requirement to distinguish loading the library from issuing an ad request. Run `openspec instructions specs --change add-adsense-compliance-pages --json` for the delta format.
- [ ] 1.4 Confirm the assumptions this change rests on still hold in the working tree: the catch-all redirect is at `server/server.js:57`, `app.get('/')` at line 61 is unreachable, `fromNetwork` in `public/service-worker.js` throws on `response.redirected`, and `express` is 4.x in `package.json`. If any has changed, stop and revise the design before writing code.

## 2. Content pages

- [ ] 2.1 Create `public/styles/pages.css`: readable measure (~65ch), system font stack, and the app's existing dark/light theme colors. Prose styling only — no layout framework, no JavaScript hooks. Keep it under ~60 lines.
- [ ] 2.2 Write `public/about.html`: what SnapDrop is, who operates this instance, the contact address from 1.1, a statement that SnapDrop is a fork of Snapdrop and PairDrop with links to both, and a note that operator details apply to this instance and should be replaced by self-hosters.
- [ ] 2.3 Write `public/how-it-works.html`: original prose covering WebRTC peer-to-peer transfer, what the signaling server does and does not see, device pairing via 6-digit code and QR, temporary public rooms, and TURN fallback and when it engages. This page carries the substantive original content — write it from the actual architecture in `server/` and `public/scripts/network.js`, not from `docs/*.md`.
- [ ] 2.4 Write `public/privacy.html` with a last-updated date, covering: third-party vendors including Google using cookies to serve ads based on prior visits; Google's advertising cookies serving ads based on visits to this site; a link to Google Ads Settings for opting out of personalized advertising; a link to the NAI opt-out; and accurate statements that file contents never traverse the server, transfers are browser-encrypted and peer-to-peer, the server relays signaling only, and what is retained when TURN relaying is used.
- [ ] 2.5 Write `public/terms.html`: prohibition on transferring material the user has no right to distribute or that is unlawful, disclaimer of warranty and liability for a free unmoderated service, and a plain statement that content is not and cannot be inspected server-side. Do not claim review or takedown capability the architecture cannot provide.
- [ ] 2.6 Write `public/404.html`: brief message and a link back to `/`.
- [ ] 2.7 Give every page from 2.2–2.6 a `<link rel="canonical">` pointing at its extensionless URL, a `<title>`, a meta description, reciprocal links to the other content pages and to `/`, and a footer note that the page is available in English only. Verify none of them references any file under `public/scripts/`.
- [ ] 2.8 **Verify (browser, 1 device):** open each page as a local file or via the dev server. Each renders styled and legible; DevTools Network shows no request to any app script; DevTools Console shows no errors; DevTools Application shows no service worker registered from these pages. Repeat with JavaScript disabled — text must be fully present.

## 3. Routing

- [ ] 3.1 In `server/server.js`, add `{ extensions: ['html'] }` to the `express.static` call.
- [ ] 3.2 Remove the unreachable `app.get('/', ...)` handler and its `console.log`. Move that log next to the `express.static` registration if the startup message is worth keeping.
- [ ] 3.3 Replace the catch-all `app.use((req, res) => res.redirect(301, '/'))` with a handler that sends `public/404.html` with status `404`. It must remain the last registered handler, after `express.static` and after `/config`.
- [ ] 3.4 **Verify (curl, dev server):** `GET /` returns 200 with the app shell; `GET /privacy` returns 200 with the policy body and no `Location` header; `GET /privacy.html` returns 200 with the same body; `GET /config` returns the JSON config; `GET /ads.txt` returns the publisher line; `GET /nonexistent-path-xyz` returns **404**, not 301. Confirm with `curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n'` on each.
- [ ] 3.5 **Verify no redirect chain:** `curl -sSI http://localhost:3000/privacy` shows a single `200` and no `301`/`302`. This is load-bearing — a redirect here breaks the page for every client with the service worker installed.

## 4. Service worker cache exclusion

- [ ] 4.1 Add to `relativePathsNotToCache` in `public/service-worker.js`, both URL forms for each page: `about`, `about.html`, `how-it-works`, `how-it-works.html`, `privacy`, `privacy.html`, `terms`, `terms.html`, `404`, `404.html`, plus `styles/pages.css` and `sitemap.xml`. Add a short comment explaining the exclusion, mirroring the existing `ads.txt` note.
- [ ] 4.2 Confirm `relativePathsToCache` is **unchanged** — no content page enters the precache. Do not bump `cacheVersion` in this group: nothing precached has changed yet. The bump belongs to group 5, where `public/index.html` is first modified. Note the reasoning in the commit message so the split is deliberate and reviewable.
- [ ] 4.3 **Verify (browser, 1 device):** load `/` and let the service worker install. Then navigate to `/privacy`. DevTools Application → Cache Storage: the `pairdrop-cache-*` entry contains no content-page URL. Network shows `/privacy` served from the network, not from the service worker cache.
- [ ] 4.4 **Verify staleness fix:** with the service worker installed, edit a visible sentence in `public/privacy.html`, restart the dev server without touching `cacheVersion`, reload `/privacy`. The edit appears. Reload `/` — the shell still loads from cache and does not re-download.
- [ ] 4.5 **Verify offline regression:** with the service worker installed, go offline in DevTools. `/` must still load the full app shell exactly as before. `/privacy` being unavailable offline is expected and correct.

## 5. Discovery

- [ ] 5.1 Add the four link-label keys to `public/lang/en.json` under a `footer` group consistent with the existing key naming. Do not add page body text to any locale file.
- [ ] 5.2 Add a compact one-row link list to the `<footer>` in `public/index.html`, wired with `data-i18n-key`/`data-i18n-attrs` per project convention. It must sit inside the existing `<footer>`, outside `#center`, and outside `#ad-top`/`#ad-bottom`.
- [ ] 5.3 Create `public/sitemap.xml` listing five canonical URLs: `/`, `/about`, `/how-it-works`, `/privacy`, `/terms`. Validate it against the Sitemaps protocol schema.
- [ ] 5.4 Add a `Sitemap: https://snap-drop.net/sitemap.xml` directive to `public/robots.txt`, keeping the existing allow-all policy.
- [ ] 5.5 Set `PRIVACYPOLICY_BUTTON_ACTIVE=true`, `PRIVACYPOLICY_BUTTON_LINK=/privacy`, and `PRIVACYPOLICY_BUTTON_TITLE` for the `snap-drop.net` deployment (`fly.toml` or fly secrets, matching how other button variables are set).
- [ ] 5.6 **Verify (browser, 1 device):** from `/`, every content page is reachable by following links only. `/config` returns a populated `privacypolicy_button` object and the About dialog shows the policy button linking to `/privacy`. Switch to a locale with no new keys (e.g. Tamil) and confirm the footer labels fall back to English with no empty elements or raw key names.
- [ ] 5.7 **Verify layout (browser, narrow viewport):** at 360px width, the footer links occupy one row, the peer discovery area and drop target are unchanged from before the change, and dragging a file onto the page is accepted by the drop target rather than the footer. Repeat with `#ad-top` and `#ad-bottom` force-enabled to confirm no interaction with the ad placements.
- [ ] 5.8 Bump `cacheVersion` in `public/service-worker.js`. This is the change's single bump, required because `public/index.html` — which is precached — was modified in 5.2. Without it, returning users keep the old shell and never see the footer links.

## 6. AdSense verification snippet

**Do not start this group until group 5 is deployed and `/privacy` is live on the origin.** The snippet sets third-party cookies; shipping it onto an origin with no policy covering them creates the violation this change exists to remove.

- [ ] 6.1 Add Google's verification snippet to `<head>` in `public/index.html` as static markup: `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7669832766470834" crossorigin="anonymous"></script>`. Copy the exact snippet from the AdSense console rather than hand-writing it, and confirm the publisher ID matches `public/ads.txt`.
- [ ] 6.2 Leave `placements.js` alone. Its runtime `AD_TAG_SRC` injection becomes redundant once the tag is in `<head>` — resolving that duplication belongs to `add-ad-monetization`, not here. Verify only that a double-load does not throw.
- [ ] 6.3 Bump `cacheVersion` again — `index.html` changed a second time.
- [ ] 6.4 **Verify presence (curl):** `curl -s https://snap-drop.net/ | grep -c "adsbygoogle.js"` returns at least `1`, and the match is inside `<head>` in the raw response, not injected by script. This is the exact check that returns `0` today.
- [ ] 6.5 **Verify suppression still holds (browser, 1 device):** with all placements disabled, load the shell. DevTools Network shows `adsbygoogle.js` requested, but no ad request beyond it and no `adsbygoogle.push()` call. No placement reserves space; the layout is pixel-identical to the pre-snippet build. Confirm in an installed PWA and in a narrow viewport too.
- [ ] 6.6 **Verify non-blocking (browser):** block `pagead2.googlesyndication.com` in DevTools request blocking, reload, and confirm the app reaches a fully usable transfer-capable state with no console error surfaced to the user. Repeat with the domain hanging (throttled to offline after request start).
- [ ] 6.7 **Verify offline shell (browser):** with the service worker installed, go offline. The shell must still load from cache and function; the failed snippet request must not break hydration.
- [ ] 6.8 **Gate — do not enable any placement.** Enabling a placement requires `add-ad-monetization`'s CMP work to be live first. Record here that placements remain `enabled: false` at the end of this group, and that AdSense approval does not lift this gate.

## 7. Regression verification

- [ ] 7.1 **Verify transfer flow (2 devices, same network):** open the app on both, confirm mutual discovery, send a file and a text message in each direction. Behavior must be identical to before the change.
- [ ] 7.2 **Verify pairing (2 devices, different networks):** generate a pair link, confirm it carries `?pair_key=` on the root path, open it on the second device, and confirm pairing completes and persists across a reload.
- [ ] 7.3 **Verify public rooms (2 devices):** create a room, confirm the share URL carries `?room_id=` on the root path, join from the second device, transfer a file.
- [ ] 7.4 **Verify share target (1 mobile device, installed PWA):** share a file to SnapDrop from another app. The `POST /` share-target flow must complete unchanged.
- [ ] 7.5 **Verify self-hoster path:** delete `public/terms.html`, restart, load `/`, follow the footer link to `/terms`. It must return the 404 page with status 404, the shell must still function, and no server error or shell console exception may occur. Restore the file.
- [ ] 7.6 **Verify service worker update path:** as a user with the *pre-change* shell cached, load the deployed site. Confirm the new `cacheVersion` installs, the old cache is deleted, and the footer links and snippet appear without a manual hard refresh.

## 8. Deploy and resubmit

- [ ] 8.1 Deploy in the design's ordered steps, verifying between each: (a) pages and stylesheet, (b) routing change, (c) discovery, env vars, and `cacheVersion` bump, (d) verification snippet and second bump. Step (b) is the only one with rollback risk; step (d) must not precede (c).
- [ ] 8.2 **Verify on the deployed origin,** not locally: repeat 3.4 against `https://snap-drop.net`, confirm `sitemap.xml` and `robots.txt` serve correctly, confirm `ads.txt` still returns the publisher line unchanged, and re-run 6.4 against the live origin.
- [ ] 8.3 Confirm the AdSense console lists the site with the code detected. If it still reports the code as missing, stop — resubmitting will fail the same way. Check that the domain registered in AdSense matches where the snippet actually serves, given the origin redirects apex → `www`.
- [ ] 8.4 Submit `sitemap.xml` in Google Search Console and request indexing of the four content pages. Wait for them to be indexed before resubmitting — indexing confirms the origin is crawlable.
- [ ] 8.5 Resubmit the AdSense application only once 8.1–8.4 are complete and verified live. Tick the policy-confirmation checkbox on the rejection screen and resubmit. Record the submission date here.
- [ ] 8.6 If rejected again, do not resubmit unchanged. Record the rejection wording here first. With the snippet and privacy policy resolved, a further rejection points at content depth — per the design's risk section, the next lever is `/how-it-works` and a genuine FAQ, not more pages.
- [ ] 8.7 **After approval:** placements stay disabled. Enabling one requires real slot IDs and a live CMP, both owned by `add-ad-monetization`. Close that change's consent tasks before any placement is enabled.
