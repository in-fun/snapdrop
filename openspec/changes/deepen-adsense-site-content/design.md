## Context

The deployed `add-adsense-compliance-pages` change fixed the site's mechanical AdSense-readiness failures: the verification tag, privacy and acceptable-use disclosures, canonical URLs, sitemap, crawler-visible links, and honest routing are live. The account onboarding page still reports a generic program-policy rejection; it does not identify content quality as the cause. Google's current guidance says a site needs enough valuable, original content and usable navigation, and its inventory policy requires publisher content—not advertising—to be the focal point. The origin currently offers one substantial informational document (`/how-it-works`); the other documents are primarily trust and legal pages. This change improves that known weakness without claiming to diagnose an undisclosed rejection reason.

The transfer application itself must remain sparse. Its full-viewport peer and drop workspace is the product, and adding article copy to that screen would obstruct the use case while still leaving future ads exposed to Google's rule against non-content inventory. This change therefore deepens the inert informational layer beside the application. It does not enable or place ads.

The FAQ must also be more accurate than the repository's inherited documentation. `docs/faq.md` and `README.md` describe TURN behavior that this production deployment does not configure. The receiver assembles files in browser memory, iOS rejects batches at or above 200 MiB, pairing and public rooms change discovery rather than the transfer transport, and the signalling connection remains open during use. Those details come from current code and production configuration, not upstream copy. Because this is a file-transfer tool, the FAQ also directs users to share only material they own or are authorized to share and links to the acceptable-use terms.

Relevant primary references:

- [Google: Make sure your site's pages are ready for AdSense](https://support.google.com/adsense/answer/7299563) requires unique, relevant content and clear navigation.
- [Google: What to do when your site is not ready](https://support.google.com/adsense/answer/12176698) calls out insufficient unique content and user experience as a review failure.
- [Google Publisher Policies: screens without publisher content](https://support.google.com/publisherpolicies/answer/11112688) says publisher content must provide value and remain the focal point.
- [MDN: Using WebRTC data channels](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels) documents DTLS transport encryption and negotiated message-size considerations.
- [WebRTC Security Architecture, RFC 8827 §9.1](https://www.rfc-editor.org/rfc/rfc8827#section-9.1) explains why transport encryption is not the same as independently verified peer identity when signalling is trusted to exchange fingerprints.
- [ICE, RFC 8445](https://www.rfc-editor.org/rfc/rfc8445) distinguishes connectivity checks from relay candidates; STUN alone does not guarantee a viable route.

## Goals / Non-Goals

**Goals:**

- Publish substantive, original answers to the questions a SnapDrop user encounters before, during, and after a transfer.
- Keep every operational and security statement bounded by behavior this deployment or the underlying web platform actually guarantees.
- Make the FAQ directly crawlable, discoverable from every site page, and addressable at stable question fragments.
- Correct misleading absolutes in `/how-it-works`, especially around connection success, server involvement, and file-size limits.
- Add repeatable, dependency-free checks for the informational layer's structural contracts.
- Preserve the transfer workspace and all advertising suppression flags unchanged.

**Non-Goals:**

- Guarantee AdSense approval or manufacture a target number of pages or words; Google publishes no such threshold.
- Create a blog, keyword landing-page collection, comments, user-generated content, or automatically generated copy.
- Put article text into the application workspace or add an FAQ modal.
- Add FAQ structured data solely for search presentation; the static semantic HTML is sufficient and avoids a script block that could confuse the pages' inertness checks.
- Enable AdSense units, choose slot IDs, deploy a CMP, or decide whether the app workspace itself is eligible inventory.
- Promise a browser-version matrix the repository does not test, or translate the English-only informational pages.

## Decisions

### D1 — One maintained FAQ, not a guide farm

Add `public/faq.html` as the sixth informational document. It contains twenty focused questions grouped into getting started, files and downloads, troubleshooting, and privacy and security. A short linked contents list and stable `id` values make a long page navigable and let support answers link directly to a question.

One page is deliberate. Splitting the same mechanics into platform-keyword variants such as “iPhone to Windows” and “Android to Mac” would repeat most paragraphs, weaken the originality signal, and create a maintenance surface the project cannot keep accurate. A user selects the same browser workflow regardless of operating system; genuine platform differences, such as iOS batch limits and share-sheet behavior, belong in the relevant answer.

### D2 — Code and standards are the sources of truth

Answers are written afresh after checking `public/scripts/network.js`, `public/scripts/ui.js`, `public/scripts/persistent-storage.js`, `server/peer.js`, `server/ws-server.js`, `server/index.js`, and the production configuration. Platform claims are bounded by MDN, W3C, or IETF behavior.

The page uses careful wording:

- “DTLS-encrypted in transit” rather than “zero-trust” or independently authenticated end-to-end identity. SnapDrop has no account-backed device identity or out-of-band fingerprint verification, so users must still confirm the intended recipient.
- “No application-configured upload cap” rather than “unlimited.” Browser memory and storage remain practical limits, and this client rejects an iOS receive batch at or above 200 MiB.
- “Same Wi-Fi is the best first test” rather than a guarantee. Guest isolation, VPNs, proxies, firewalls, address translation, and managed networks can still prevent discovery or a direct route.
- “The signalling server does not carry file bytes” rather than “the server stops being involved.” Presence and handshake signalling remain connected while the page is open.
- “Current browsers with WebSocket and WebRTC data-channel support” rather than a hard version matrix.

Inherited `docs/faq.md` is research material only and is never copied; its TURN description is wrong for this deployment.

### D3 — Troubleshooting follows observable stages

The FAQ separates discovery from connectivity and delivery:

1. If a peer does not appear, check that both pages are open and online, then same-network isolation, VPN/proxy behavior, and finally pairing or a public room.
2. If a peer appears but a transfer does not connect, explain that discovery succeeded but ICE did not find a direct WebRTC route. Suggest a common Wi-Fi or hotspot and state that production has no TURN or WebSocket file relay.
3. If a transfer completes but a file is not visible, use the retained Download action and check browser download permissions or the system share sheet.
4. If a transfer is interrupted, restart it; the protocol has acknowledgements but no cross-session resume.

This ordering gives users decisions they can act on without presenting speculation as diagnosis.

### D4 — Extend the existing static-page pattern

`faq.html` is plain semantic HTML using the existing `styles/pages.css`. It loads no application code, service worker, analytics, or advertising script. `express.static({ extensions: ['html'] })` already serves `/faq` directly, so the server requires no route change.

Every existing informational page and the 404 recovery page gains a FAQ link. The app footer gains a literal, crawler-visible `FAQ` anchor plus `footer.site-faq` localization wiring. Only English receives the new key; the existing locale fallback supplies English elsewhere.

### D5 — Discovery and caching follow the existing contract

Add `https://www.snap-drop.net/faq` to `sitemap.xml`. Add both `faq` and `faq.html` to `relativePathsNotToCache`; query stripping already makes `/faq?utm_source=...` match the extensionless entry. The page and sitemap remain outside both precache and runtime cache so factual corrections publish immediately.

`index.html` and `lang/en.json` are precached, so their FAQ link changes require exactly one cache-version bump. Updating `faq.html`, `how-it-works.html`, `pages.css`, and `sitemap.xml` alone would not require it.

### D6 — Correct the existing architecture page in place

`/how-it-works` gains a concise “When a connection fails” section and links to the operational FAQ. Existing statements are adjusted so they do not imply that the signalling socket disconnects after negotiation, that same-Wi-Fi always works, or that browser memory imposes no practical file limit. The page remains an architecture explanation; detailed operational answers stay in `/faq`.

### D7 — Dependency-free verification becomes executable documentation

Add a Node script invoked as `npm run verify:site-content`. It uses only built-in modules and checks:

- every declared content file has a title, description, expected canonical, English-only note, no executable script, and complete reciprocal navigation;
- FAQ question fragment IDs are unique and the required operational topics are present in raw HTML;
- the sitemap contains each canonical exactly once;
- both FAQ aliases are in the service worker's exclusion list and are absent from the precache list;
- the app footer contains literal FAQ anchor text and the English locale key;
- global and per-placement advertising flags remain disabled with placeholder slot IDs.

HTTP checks remain a separate task run against the local server: `/faq` and `/faq.html` must return direct `200` responses with identical bodies, unknown paths must stay `404`, and `POST /` must stay `303`. Browser checks cover responsive footer layout and real Cache Storage behavior, which regular-expression-based static checks cannot prove.

### D8 — Treat approval and ad placement as separate gates

This change prepares content for another site review; it does not declare the root transfer workspace eligible ad inventory. Google's current policy prohibits ads on screens without publisher content and requires content to be focal. The existing placements therefore stay disabled after this change. After approval, `add-ad-monetization` must still complete CMP and real-slot work and must reassess placement eligibility against the then-current policy before enabling the app-shell units. Content-page-only advertising remains the lower-risk fallback.

### D9 — Make the privacy disclosure match the existing verification script

The inherited policy says advertising is already shown and implies the AdSense library loads only when advertising is active. In fact, the static verification script loads on the application page while all placement flags are disabled. Correct the policy to describe the library request and its third-party data handling separately from ad serving, update the policy date, and preserve the existing verification integration. CMP setup remains an external prerequisite for enabling placements; this copy correction does not implement consent or certify compliance.

### D10 — Preserve readable contact links through Cloudflare

Production verification of release 15 found that Cloudflare rewrites the contact address in About, Privacy, and Terms and injects `email-decode.min.js`. This defeats the informational pages' no-script contract and hides their contact address from clients without JavaScript. Wrap the three public contact links in Cloudflare's documented `<!--email_off-->` / `<!--/email_off-->` comments so the address remains readable in the served HTML. This does not change zone-wide settings or the contact address. Verify the deployed response has the literal mailto link and no injected script. These pages are excluded from caching, so this correction needs no additional shell cache-version bump. See [Cloudflare email obfuscation documentation](https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/).

## Risks / Trade-offs

- **A substantial FAQ still does not guarantee approval** → State that explicitly, verify the mechanical requirements, wait for indexing, and record the next rejection verbatim before changing the site again.
- **Long prose becomes difficult to scan** → Group questions by user task, provide a linked contents list, use stable fragments, and keep each answer focused.
- **Operational prose drifts from code** → Keep claims concrete, add structural verification, and include code-accuracy review in the task list whenever transfer behavior changes.
- **A fifth app-footer link crowds small screens** → Reuse the wrapping footer navigation and verify at 320×480 and 360px widths without changing the transfer workspace.
- **Security wording overpromises** → Distinguish encrypted transport from verified identity and link to the privacy page for the data-handling contract.
- **The verification script is intentionally a lightweight parser** → Limit it to structural invariants; verify rendering, networking, and service-worker semantics in a real browser.
- **The root app may remain unsuitable for AdSense placements even if the site is approved** → Keep all placements disabled and treat content-page-only monetization as the policy-conservative option.

## Migration Plan

1. Add the FAQ, corrections, navigation, sitemap entry, cache exclusions, locale key, verifier, and one cache-version bump as one atomic deployment. Partial deployment would create dead navigation or stale app footers.
2. Run the static verifier and local HTTP matrix, then check the FAQ and app footer in a real browser at desktop and narrow mobile sizes. Confirm FAQ requests with query parameters never enter Cache Storage and the app shell still loads offline.
3. Deploy without enabling any ad placement. Verify the production response, canonical, sitemap, no-cache behavior, and AdSense verification tag.
4. Submit the updated sitemap and request indexing for `/faq` and the corrected `/how-it-works` in Search Console. Wait until Google reports them indexed.
5. Request a new AdSense review once, record its date and exact result, and do not resubmit an unchanged origin after another rejection.

Rollback is a normal revert of the atomic change. The cache-version increment can remain: it only causes clients to refresh the shell once and has no persistent data consequence.

## Open Questions

None for repository implementation. Deployment, Search Console indexing, CMP activation, AdSense status, real slot IDs, and the ultimate placement surface require operator access outside this repository.
