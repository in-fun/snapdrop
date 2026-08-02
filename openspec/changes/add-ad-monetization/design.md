# Design: AdSense Integration

## Context

`public/` is a static, unbundled client. Scripts are `<script defer>` globals declared at the bottom of [index.html:855-858](public/index.html#L855-L858) — `localization.js`, `persistent-storage.js`, `ui-main.js`, `main.js` — plus a second tier loaded at runtime by `PairDrop.loadDeferredAssets()`. `main.js` ends with a bare `const pairDrop = new PairDrop();`, so the constructor runs after parsing completes and the DOM is available to it. Classes are wired together through the static `Events` bus in [ui-main.js:6-17](public/scripts/ui-main.js#L6-L17), a thin wrapper over `window.dispatchEvent` / `window.addEventListener`.

Five properties of the existing code constrain this design more than any AdSense policy does.

**The document never scrolls.** `html, body { overflow-y: hidden; height: 100% }` with `body` a flex column of `header` (56px) → `#center` (`flex-grow: 1`) → `footer`. Only `#center` scrolls, internally, via its own `overflow-y: scroll` at [styles-main.css:382-392](public/styles/styles-main.css#L382-L392). A placement that is a *sibling* of `#center` therefore has no scroll position, no below-the-fold, and no lazy-load problem: it is in the viewport from first paint until the tab closes, and viewable duration equals session duration for free. The cost is that vertical space is a fixed budget, and every pixel a placement takes comes out of `#center` — the peer discovery canvas and drop target.

**Body is a flex column, so placements must opt out of shrinking.** Flex items default to `flex-shrink: 1`. Once header, placements, and footer approach the viewport height, a placement with default shrink would be compressed below its declared size — silently breaking the reserved dimensions that the whole no-layout-shift guarantee depends on, and squeezing the ad iframe. Placements must set `flex: 0 0 auto`; `#center` keeps `flex-grow: 1` and absorbs the remainder. No change to `styles-main.css` is needed for this.

**The deferred script loader swallows failures without resolving.** [main.js:155-166](public/scripts/main.js#L155-L166):

```js
loadAndApplyScript(url) {
    return new Promise( async (resolve) => {
        try {
            await this.loadScript(url);
            resolve();
        } catch (error) {
            console.error('Error loading script:', error);   // never resolves
        }
    });
}
```

`loadDeferredAssets()` is `Promise.all` over these and `initialize()` awaits it before `hydrate()`. A script that fails to load leaves its promise pending forever, so `hydrate()` never runs and the app never constructs its dialogs, peer UI, or transfer handlers. `pagead2.googlesyndication.com` is blocked for a large share of traffic. Routing the AdSense tag through this loader would take the app down for precisely those users.

**Drag-and-drop is handled on `window`.** [ui.js:37-40](public/scripts/ui.js#L37-L40) registers `drop` / `dragover` / `dragleave` through the `Events` bus. A cross-origin ad iframe is its own hit-testing surface: a file dropped on it never reaches `window`, and the browser's default handling navigates the tab to the dropped file — destroying an in-progress session, not merely missing one transfer.

**The service worker precaches the shell** and passes cross-origin requests straight to the network ([service-worker.js:153-159](public/service-worker.js#L153-L159)), so the AdSense tag needs no service worker changes and is naturally absent offline. Any file added under `public/` must join `relativePathsToCache` and force a `cacheVersion` change.

External to the repository: the AdSense account is approved for the site, and Google's *Privacy & messaging* is the certified CMP satisfying the IAB TCF v2.2 requirement in force for EEA/UK/Switzerland traffic since 16 January 2024.

### Policy basis

These findings were verified on 2026-08-02 and are the external constraints the rest of this design is derived from. They are recorded here rather than left to implementation because three of the four decide the shape of the change, not its details. Re-confirm before shipping — Google revises these independently of this repository — but treat them as settled unless a re-check contradicts them.

| Finding | Consequence here | Source |
|---|---|---|
| A publisher may not refresh a page or an element of a page without the user requesting it. Timed refresh is permitted on Ad Manager/AdX, where it must be declared with trigger and minimum interval, and is not available on AdSense. | No refresh. Impressions per session equal placement count, which is why there are two placements and why refresh is Future Work. | [Ad placement policies](https://support.google.com/adsense/answer/1346295) |
| AdSense code may not be placed inside software applications, and Google's tag independently suppresses rendering in in-app and webview contexts. | Suppression in `standalone` / `minimal-ui` / `fullscreen` display modes and in webviews. | [Ad placement policies](https://support.google.com/adsense/answer/1346295), [Invalid traffic and policy violations](https://support.google.com/adsense/answer/2660562) |
| Serving personalized ads to EEA/UK/Switzerland traffic requires a Google-certified CMP integrated with IAB TCF v2.2. Google's own *Privacy & messaging* is certified. | No consent code in this repository; consent is dashboard configuration. | [Consent management requirements](https://support.google.com/adsense/answer/13554116) |
| The per-page ad unit limit was removed; the operative constraint is that content remains the focal point and advertising does not exceed it. | Two placements is a judgement call, not a hard ceiling — but on a UI-only page it is close to the sensible limit, hence the requirement that adding a third is a deliberate revenue decision. | [AdSense program policies](https://support.google.com/adsense/answer/48182); [Multiple ads on a single page](https://pubscale.com/policy/multiple-ads-on-a-single-page), third-party summary |
| Ads placed close to interactive controls invite accidental clicks, Confirmed Click interstitials, and invalid-traffic exposure. | Minimum separation from the header control row. | [About Confirmed Click](https://support.google.com/adsense/answer/10025624) |
| Labelling is optional where ads are already clearly distinguishable, but only "Advertisement" or "Sponsored Links" are permitted wordings; ads may not sit under misleading headings. | Placements are labelled anyway, because on a page that is almost entirely UI chrome "clearly distinguishable" is not something to assume. | [Ad placement policies](https://support.google.com/adsense/answer/1346295) |
| A viewable impression is 50% of an ad's pixels visible for one continuous second. | Dwell beyond that first second adds no further viewable impression. This is why the design optimizes placement count and permanent viewability rather than exposure duration. | [Viewability and Active View](https://support.google.com/adsense/answer/4510652), [Overview of Viewability and Active View](https://support.google.com/admanager/answer/4524488) |
| An `ads.txt` file at the origin root declares which accounts may sell the site's inventory, in the form `google.com, pub-…, DIRECT, f08c47fec0942fa0`. | A committed `public/ads.txt`, excluded from the precache. | [Ads.txt guide](https://support.google.com/adsense/answer/12171612) |

## Goals / Non-Goals

**Goals:**

- Serve AdSense on two stable placements, each contributing one impression per session.
- Guarantee structurally — not by care — that no ad failure mode can delay, block, or break the transfer flow.
- Zero layout shift on the filled path, in a shell where a shift moves the drop target under the user's cursor.
- Suppress advertising in every context where it must not or cannot serve, failing closed when uncertain.
- Leave a substrate that refresh can be added to later without redoing placement.

**Non-Goals:**

- Ad refresh of any kind. Prohibited by [AdSense ad placement policies](https://support.google.com/adsense/answer/1346295); see the proposal's Future Work for the migration that would unlock it.
- Auto ads. Google chooses placements and may inject anchor overlays and full-page vignette interstitials, which cannot be reconciled with "the main flow is never obstructed."
- Custom consent UI, CMP integration code, or TCF string handling. Google's certified message does this with no code in the tree.
- House-ad fallback, ad-block recovery, ad-free tiers.
- AdSense approval-readiness work (content pages, trust pages). The account is already approved; the standing compliance risk is recorded in the proposal's Future Work.
- Any change to signalling, WebRTC, peer discovery, or the server.

## Decisions

### Load the AdSense tag out of band, never through `deferredScripts`

`ad-manager.js` ships as a fifth `<script defer>` in `index.html` — same-origin and precached, so it always loads. It injects the AdSense tag itself and **awaits nothing**; no application promise depends on the result. The injection outcome is observed only through each placement's own state machine.

*Alternatives considered.* Adding the AdSense URL to `deferredScripts` is the one-line option, disqualified by the non-resolving error path above. Fixing `loadAndApplyScript` to resolve in its catch block is a genuine bug fix, but it modifies shared load-order machinery for an ad's benefit, and would still couple `hydrate()` timing to a third-party network round trip. Deliberately left alone — it deserves its own change.

### Two phases: synchronous `reserve()` before fade-in, network `load()` at hydrate

`AdManager` is constructed in `PairDrop`'s constructor alongside `ThemeUI` / `HeaderUI` / `CenterUI` / `FooterUI`, matching the existing pattern.

- **`reserve()`** runs synchronously during construction, before the fade-in sequence. Every check it makes is local — `matchMedia`, `navigator.onLine`, viewport dimensions. It leaves placements at `display: none` or reveals them at their final dimensions. No network, no third-party code.
- **`load()`** runs from `hydrate()`, after the UI is up and the WebSocket is connected. It injects the tag and pushes one request per placement.

*Rationale.* The app's sequence is `evaluatePermissions → fadeIn → loadDeferredAssets → hydrate`. Reserving in the pre-fade-in phase settles placement geometry before anything is visible, so fade-in reveals a final layout. Deciding suppression and reserving in one late step would either shift the layout after fade-in or force the ad request earlier than the transfer UI is ready for. Splitting on the network boundary is what makes both properties available at once.

*Consequence worth naming.* Deferring the tag to `hydrate()` also defers Google's consent message, so EEA/UK/CH visitors see it a second or two into the session rather than at first paint. This is the better trade — first paint and the peer discovery canvas are never behind a third-party overlay — but it is a visible behavioural difference, and the acceptance criteria check that the transfer flow stays reachable while the message is displayed.

### Fixed pixel ad units per breakpoint, not responsive units

Placements declare exact dimensions in CSS and use fixed-size units — 320×50 from a 320px viewport width, 728×90 from the desktop breakpoint — with `overflow: hidden` on the container. Both are standard formats that consistently rank among the best-performing AdSense sizes: 320×50 as the mobile leaderboard and 728×90 as the desktop leaderboard ([Publift, third-party analysis](https://www.publift.com/blog/highest-performing-adsense-banner-sizes-formats)). Below 320px of viewport width the `top` placement is suppressed rather than shrunk, since 320×50 is the narrowest of those and a clipped ad serves nobody.

*Rationale.* AdSense responsive units size themselves after the tag loads, which is a layout shift by construction. In a scrolling document that costs a CLS point; here it moves the peer canvas and the drop target under a cursor that may already be mid-drag. Fixed sizes trade some fill-rate headroom for a guarantee. `overflow: hidden` is the backstop for a creative that renders larger than its unit.

### Suppression is a fail-closed matrix evaluated once, in `reserve()`

| Condition | Why |
|---|---|
| `(display-mode: standalone)`, `minimal-ui`, or `fullscreen` | The [AdSense program policies](https://support.google.com/adsense/answer/48182) prohibit AdSense code inside software applications; Google's tag independently suppresses rendering in in-app and webview contexts, and such traffic risks [invalid-traffic](https://support.google.com/adsense/answer/2660562) flags. An installed PWA is that case. |
| Webview or in-app browser | Same policy exposure, same sources. |
| `navigator.onLine === false` | The tag cannot load; reserving for it would leave a permanent empty gap in an offline PWA. |
| Viewport height below 480px | Landscape phones cannot yield vertical space without squeezing `#center`. Derivation below. |
| Viewport width below 320px | Narrower than the narrowest standard unit. |
| `bottom` placement below 1024px width or 800px height | Two placements need room the fixed chrome does not leave on phones and tablets. |
| Per-placement or global `enabled: false` | Kill switch. |

Anything not positively cleared stays suppressed. There is precedent for display-mode gating in the codebase already — `@media all and (display-mode: standalone)` at [styles-main.css:912](public/styles/styles-main.css#L912), and the install-button check at [main.js:84](public/scripts/main.js#L84).

Suppression is decided once per page load and never re-evaluated into a more permissive state. A viewport change that crosses a threshold hides a rendered placement and returns its space, but never reveals a suppressed one and never triggers a request. Revealing on resize would produce a mid-session ad request indistinguishable from refresh.

### Placements become transparent to drag via `pointer-events: none`

`AdManager` listens on `window` for `dragenter` / `dragover` and adds a class setting `pointer-events: none` on every placement container; `drop`, `dragend`, and a ~150ms idle timer after the last `dragover` remove it.

*Rationale.* `pointer-events: none` removes the iframe from hit testing entirely, so the drop lands on the element beneath and reaches the existing `window` handler unchanged. It is the only mechanism available: a cross-origin iframe's internal drop handling cannot be intercepted from the parent, and `preventDefault` on the parent never fires because the event never reaches the parent. The idle timer is required because `dragleave` on `window` is unreliable when the pointer crosses between elements — without it, an abandoned drag would leave ads permanently unclickable.

*Alternative considered.* A transparent shield element overlaid on `dragenter` also works, but adds a DOM node and a stacking-context question next to `#center`'s layers for no benefit over a class toggle.

### Theme follows CSS, not a `MutationObserver`

Placement chrome is styled with `body.dark-theme .ad-slot { … }`.

*Rationale.* `ThemeUI` toggles `dark-theme` on `document.body`, which descendant selectors already track. The promo banner on `feat/ad-banner` ran a `MutationObserver` on `body` attributes to mirror the class onto itself — a live observer doing what the cascade does for free. Ad creatives carry their own backgrounds and cannot be themed, so placement chrome is limited to a transparent container and a muted label, which is also what stops a bright rectangle appearing in dark mode.

### Collapse on no-fill, with the timeout as the primary safety net

AdSense writes `data-ad-status="filled"` or `"unfilled"` onto the `<ins>` element; a `MutationObserver` on that attribute collapses the placement on `unfilled`. A timeout of at most 5 seconds after each request collapses any placement not confirmed filled by then.

*Rationale for the ordering.* `data-ad-status` is a stable, widely relied-upon signal but is not formally documented by Google, so it may change without notice. The timeout is not merely the blocked-tag path — it is what makes collapse correct even if the attribute disappears entirely. Treat the observer as the fast path and the timeout as the guarantee.

*Trade-off, stated plainly.* Reserve-then-collapse means the filled path — the common one — has no layout shift, while blocked and no-fill users get exactly one reflow that returns space to `#center`. Holding the reserved gap open forever would have no shift at all, but would permanently spend contested vertical space on users who will never see an ad. In a shell where that space competes with the peer canvas, giving it back is worth one early reflow.

### Configuration is a committed constant

Publisher ID and slot IDs live in a `const` at the top of `ad-manager.js`, and `ads.txt` declares the same publisher account.

*Rationale.* This fork maintains its own repository and deployment; upstream's convention of keeping deployment identifiers untracked does not apply. Publisher IDs are public by construction — they appear in served page source and in a file whose entire purpose is to be crawled. A runtime-injection scheme (`window.AD_CONFIG`, git-ignored config, example template) would add three files and a deployment step to hide a value that is not secret. `ads.txt` must **not** join `relativePathsToCache`: it is crawled, never fetched by the app, and precaching it only risks serving a stale copy.

### Shell versioning uses a fork-local suffix

`cacheVersion` moves from `v1.11.2` to `v1.11.2-sd.1`, and `package.json` / the about-page version string are left alone.

*Rationale.* `cacheVersion`'s only contract is uniqueness — `cacheTitle` is just a string key. The repo keeps it equal to the release version by convention, but this fork changes the shell on its own cadence while `package.json` tracks upstream release lineage. Bumping to `v1.12.0` would collide with upstream's eventual `v1.12.0`; reusing `v1.11.3` would collide with the unmerged `feat/ad-banner` branch, which already claimed it. A `-sd.N` suffix on the upstream base is collision-free in both directions and says plainly that this is a fork-local shell revision.

### Viewport thresholds are derived from the fixed chrome, not guessed

The shell's chrome is fixed and measurable from the stylesheet, so the thresholds follow arithmetically rather than needing device testing to discover.

`header` is 56px ([styles-main.css:142](public/styles/styles-main.css#L142)). `footer` is the sum of an 80px logo with `margin-top: -10px` and `margin-bottom: 8px`, a display-name badge at `min-height: 24px` plus padding, and a discovery wrapper at `margin: 15px auto auto` over another badge, plus 5px bottom margin — **≈150px**. Chrome therefore costs **≈206px** before any placement, and `#center` gets whatever remains.

- **`top` requires ≥480px viewport height.** At 375px — the tallest common phone-landscape height — `#center` has 169px, and a 50px unit plus separation leaves 111px, less than the 120px `--peer-width` a single peer tile occupies. At 480px it leaves 216px, enough for a peer row with margin. 480px also separates cleanly: every common phone-landscape height (320, 375, 414, 430) falls below it and every common phone-portrait height (568, 640, 667, 736, 844, 932) above.
- **`bottom` requires ≥1024px width and ≥800px height.** Width follows from the 728px unit plus margins; 1024px rather than 768px deliberately excludes tablet portrait, where two placements would crowd a device with modest vertical room. The 800px height condition reuses the breakpoint already in the stylesheet at [styles-main.css:899](public/styles/styles-main.css#L899). At exactly 1024×800 both placements plus chrome cost 364px, leaving 436px for `#center`.

These are decisions, not defaults to be rediscovered. Implementation verifies them on real devices and revises this section if the measured footer height differs materially from ≈150px; it does not re-derive them from scratch.

### Placement geometry

- **`top`** — between `</header>` and `#center`, clearing the header's icon-button row by a minimum separation. [AdSense placement policy](https://support.google.com/adsense/answer/1346295) requires adequate space between ads and page controls; the header carries pair-device, join-room, theme, install, and about controls, and an ad flush against them invites accidental clicks, Confirmed Click interstitials, and invalid-traffic exposure.
- **`bottom`** — between `#center` and `<footer>`, desktop breakpoint and above only.

Both sit in normal flow below the app's interactive layers. Existing `z-index` values run to 20 for `header`, 32, and 40 for overlays, with `#center` and `footer` at 2; placements must stay at or below that floor so every dialog renders above them.

Both carry a localized "Advertisement" label. Labelling is optional under the [ad placement policies](https://support.google.com/adsense/answer/1346295) where ads are already clearly distinguishable from content, and only "Advertisement" or "Sponsored Links" are permitted wordings. This design labels anyway: on a page that is almost entirely UI chrome, an unlabelled bordered rectangle between the header and the peer canvas is exactly what "ads mimicking site content" describes, and the label costs one translation key. The string goes in `public/lang/en.json` with `data-i18n-key` wiring, and the other 37 locales in [public/lang/](public/lang/) fall back to English.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Ad script hangs `hydrate()` and bricks the app for ad-block users | Tag injected out of band and never awaited; `deferredScripts` untouched. The single most important property of this design. |
| File dropped on an ad iframe navigates the tab away mid-session | `pointer-events: none` on placements during any active drag, with an idle timer so an abandoned drag cannot leave ads permanently dead |
| Layout shift moves the drop target under the cursor | Fixed pixel units, dimensions reserved before fade-in, `flex: 0 0 auto`, `overflow: hidden`; shift confined to the no-fill collapse |
| Flex shrink silently compresses a placement below its reserved size | `flex: 0 0 auto` on every placement container; verified at the smallest supported viewport |
| Stale service worker keeps returning visitors on the old shell | `cacheVersion` change is mandatory whenever `public/` gains files; returning visitors pick up the new shell on next activation, so expect one session of lag |
| Advertising squeezes the peer canvas on small screens | Thresholds derived from the fixed chrome height against a peer tile's `--peer-width`, not picked by feel; `bottom` gated to 1024×800 |
| Policy action from serving in an installed PWA or webview | Display-mode and webview suppression, failing closed |
| Consent message obstructs the transfer flow in EEA/UK/CH | Deferred to `hydrate()` so it never precedes first paint; verified in-browser from a EEA-region session as an explicit acceptance step |
| Accidental clicks from proximity to header controls | Minimum separation, visible boundary, "Advertisement" label |
| `data-ad-status` changes or disappears | Timeout collapse is the guarantee; the observer is only the fast path |
| Two placements read as advertising outnumbering content on a minimal UI | `bottom` gated to desktop where the canvas is mostly empty; the staged rollout enables it separately so the effect is observable before it is permanent |

## Migration Plan

1. Create the two fixed-size ad units in the AdSense dashboard; record publisher and slot IDs.
2. Enable *Privacy & messaging* GDPR and US-state regulations messages.
3. Land the code with both placements `enabled: false`; deploy and confirm the app is inert — no third-party requests, no reserved space.
4. Enable `top`, deploy, verify against the acceptance scenarios, and hold long enough to establish a session-RPM baseline.
5. Enable `bottom`, deploy, verify, and compare against that baseline.
6. Confirm `ads.txt` is served and the dashboard reports no warning.

**Rollback.** Set `enabled: false` globally and deploy; placements stop reserving space and no tag is injected. This is a deploy rather than a runtime toggle — acceptable, because the failure modes it guards against are policy and layout issues, not outages. Full revert is the single commit plus a further `cacheVersion` change.

## Open Questions

Nothing here blocks implementation. Every design decision is made; what remains needs production data that does not exist yet, and the staged rollout is structured to produce it.

**Answered by the rollout, not by more design:**

- Whether the `bottom` placement earns its vertical space or merely cannibalizes `top`. It is independently switchable for exactly this reason: enable it a week after `top` and compare session RPM. Impressions per session should approach two; if RPM does not rise roughly in proportion, switch it back off.
- Whether fixed-size units cost enough fill rate to justify revisiting responsive units inside a hard-clamped container. Measure fill rate on `top` first — this only reopens if fill is materially below what the account sees elsewhere.

**Standing assumption:**

- The ~156K visits/month and ~8 minute session figures are operator-reported and were not independently verified. The design depends only on sessions being long and page views being one per session, both of which are structural properties of the app. The revenue case depends on the actual numbers, so the baseline measurement in the rollout is what confirms or refutes it.
