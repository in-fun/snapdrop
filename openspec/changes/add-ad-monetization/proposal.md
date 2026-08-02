# Serve Google AdSense on snap-drop.net

## Why

`snap-drop.net` is this fork's public hosted deployment. It has an approved AdSense account and serves no ads — nothing in `public/` references an ad network. The only monetization ever attempted lives on the unmerged `feat/ad-banner` branch, so `main` is a clean starting point rather than a migration.

The revenue model deserves stating precisely, because the intuitive reading of the traffic is wrong. Operator analytics report ~156K visits/month at an ~8 minute average session — operator-reported, and not independently verified in this change. It is tempting to treat that dwell as directly monetizable: eight minutes of attention, refresh the ad each minute, eight times the impressions. Google's [ad placement policies](https://support.google.com/adsense/answer/1346295) close that door — a publisher may not refresh a page or an element of a page without the user requesting it. Timed refresh does exist on Google Ad Manager, where the publisher must [declare the trigger and the minimum interval](https://support.google.com/admanager/answer/6286179), but not on AdSense, where attempting it invites the [enforcement](https://support.google.com/adsense/answer/2660562) that would cost the only monetized property.

With refresh unavailable the arithmetic is blunt. This is a single-page app: one page view per session, no navigation, no route changes. **Impressions per session equals number of placements** — not minutes on page. A visitor who stays eight minutes and one who stays eight seconds generate the same impression count.

Dwell time is still worth something, but less than it looks. A viewable impression is defined as 50% of an ad's pixels visible for one continuous second ([Active View](https://support.google.com/adsense/answer/4510652)), so every second past the first adds no further viewable impression. What a long session actually buys is a longer window in which a click can occur, plus a high average-viewable-time signal that buyers may reward over time. Both are real and both are second-order; this change should not be sold on them.

So the honest scope is modest: serve a small number of well-placed, permanently viewable ads, establish a session-RPM baseline, and treat the impression multiplier as future work contingent on a demand source that permits refresh.

**The user flow this serves:** none. Advertising is peripheral revenue on a project whose stated bar is that it "should be extremely simple, clean, and easy to use" and that "the main user flow should never be obstructed" ([CONTRIBUTING.md](CONTRIBUTING.md)). It earns its place only by being small, inert on failure, and structurally unable to reach the transfer path.

**The user flows it must not obstruct:** peer discovery and the drop target; drag-and-drop and paste; the file picker; pairing and public rooms; transfer request, progress, and completion dialogs; and offline operation as an installed PWA.

## What Changes

- A new `monetization` capability introducing two independently switchable ad placements in the app shell, one above and one below the peer discovery area. Two placements is the whole legitimate in-session multiplier available on AdSense; each placement is one more impression per session, and there is no other lever.
- Advertising is suppressed wherever it must not or cannot serve — installed-PWA and webview contexts, offline, viewports too small to yield the space, and by explicit kill switch. Any context not positively cleared is treated as suppressed. Suppression in app-like contexts is a policy requirement, not a preference: the [AdSense program policies](https://support.google.com/adsense/answer/48182) prohibit placing AdSense code inside software applications.
- No failure mode of the ad network — blocked, slow, hanging, or throwing — can delay, block, or break application startup, the transfer flow, or drag-and-drop.
- Ad rendering causes no layout shift, and a placement that receives no ad returns its space to the peer discovery area.
- Placements are labelled, visually delineated from application UI, and separated from interactive controls. Labelling is optional under the [ad placement policies](https://support.google.com/adsense/answer/1346295) where ads are already clearly distinguishable, and only "Advertisement" or "Sponsored Links" are permitted wordings; this change opts to label because the surrounding page is almost entirely UI chrome.
- The deployment declares its authorized publisher account in an [`ads.txt`](https://support.google.com/adsense/answer/12171612) file at the origin root.
- Publisher and slot identifiers are committed to this repository rather than injected at deploy time. This fork owns its deployment, and these values are public by construction — they appear in served page source and in `ads.txt`, a root file whose entire purpose is to be crawled.
- **Not** included: automatic ad refresh of any kind; Auto ads; any consent UI written in this repository.

## Capabilities

### New Capabilities

- `monetization`: how the deployment requests, places, and suppresses third-party advertising, and the guarantees advertising owes the core transfer experience.

### Modified Capabilities

None. `openspec/specs/` contains no capability specs yet.

## Impact

**Client** — one new script and one new stylesheet under `public/`, two placement containers in `public/index.html`, and one new string in `public/lang/en.json` (the other 37 locales in [public/lang/](public/lang/) fall back to English). Adding files under `public/` obliges a `relativePathsToCache` update and a `cacheVersion` change in `public/service-worker.js`; skipping it strands returning visitors on the old shell.

**Origin root** — a new `ads.txt`, served from the network and deliberately excluded from the precached shell.

**Untouched** — `server/` gains nothing. `network.js`, `ui.js`, and `ui-main.js` gain no ad awareness; the transfer pipeline, signalling, and peer discovery are not modified. `main.js` gains construction and invocation lines only.

**External configuration**, in the AdSense dashboard rather than this repository — two fixed-size ad units, and Google's *Privacy & messaging* GDPR and US-state messages. Serving personalized ads to EEA/UK/Switzerland traffic has required a Google-certified CMP integrated with IAB TCF v2.2 [since 16 January 2024](https://support.google.com/adsense/answer/13554116), and Google's own messaging is certified, so no consent code belongs in this tree.

## Future Work

Recorded here because the first item is the largest remaining revenue lever, and this change deliberately forgoes it.

- **Ad refresh — the impression multiplier.** Placements set the impression count per session; refresh multiplies it. An eight-minute session against a 30–60s interval is roughly an order of magnitude more impressions. AdSense forbids it, but Google Ad Manager permits refresh when the publisher [declares the trigger and minimum interval](https://support.google.com/admanager/answer/6286179), and managed partners such as Ezoic and Snigel advertise engagement-based refresh — verify that against their current terms when this is revisited rather than assuming it. Reopen once the AdSense session-RPM baseline from this change exists as a number to beat. Stable, named, independently switchable placements are the right substrate: adding refresh later means adding a scheduler, not redoing placement.
- **House-ad fallback.** Suppression is routine, not exceptional — offline, installed PWA, blocked, no fill. First-party promotion would recover that inventory. Deferred until fill-rate data exists.
- **Compliance monitoring.** AdSense approval is revocable. Google's [copyright policy](https://support.google.com/adspolicy/answer/6018015) prohibits sites and tools that enable unauthorized sharing or downloading of copyrighted content, and publishers running file-oriented sites do get rejected under a "Copyrighted material: Unauthorized Filesharing" label ([example](https://support.google.com/adsense/thread/182482391)). SnapDrop's defence is strong on the facts — it stores nothing server-side, indexes nothing, exposes no public links, and moves a user's own files between their own devices — but the site currently states none of it, has no privacy policy (the button at [index.html:705](public/index.html#L705) is `hidden` and unconfigured), no terms, and no contact page. Cheaper to address before an enforcement action than after one.
