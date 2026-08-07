# Site Content

Governs the informational layer that exists alongside the transfer app: the content pages, how they are addressed and served, how they are discovered, how they interact with the offline cache, and the guarantees they owe the core transfer experience.

**Platform behavior these requirements rest on:** [`serve-static` options](https://expressjs.com/en/resources/middleware/serve-static) (`extensions` serves the extension-appended file directly rather than redirecting; `fallthrough` passes unmatched requests to the next handler), [HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110#name-404-not-found) (`404 Not Found` versus `301 Moved Permanently`), [`rel=canonical`](https://www.rfc-editor.org/rfc/rfc6596) for duplicate URL consolidation, the service worker [`FetchEvent`](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent) model and [`Response.redirected`](https://developer.mozilla.org/en-US/docs/Web/API/Response/redirected) (this deployment's worker aborts on redirected responses), the [Sitemaps protocol](https://www.sitemaps.org/protocol.html), and [robots.txt](https://www.rfc-editor.org/rfc/rfc9309) including its `Sitemap` directive.

**Policies these requirements encode:** [AdSense eligibility requirements](https://support.google.com/adsense/answer/9724) (content must be original and high quality), [Required content](https://support.google.com/adsense/answer/1348695) (the specific third-party cookie, personalized advertising, and opt-out disclosures a publisher privacy policy must carry), [AdSense Program policies](https://support.google.com/adsense/answer/48182), and the [Google Publisher Policies](https://support.google.com/publisherpolicies/answer/10502938) prohibition on scraped or replicated content and on facilitating unauthorized distribution of copyrighted material.

## ADDED Requirements

### Requirement: Content Page Set

The deployment SHALL serve exactly five informational documents, each a standalone static HTML file under `public/` with a single defined purpose:

| Canonical URL | Purpose |
| --- | --- |
| `/about` | What SnapDrop is, who operates this instance, a contact address, and attribution to the upstream projects |
| `/how-it-works` | Original technical prose on WebRTC transfer, signaling, pairing, public rooms, and TURN fallback |
| `/privacy` | Data handling for this instance and the third-party advertising disclosures |
| `/terms` | Acceptable use, prohibited content, and disclaimer of warranty |
| `/404` | The body returned for unresolvable paths |

Each page MUST be readable without JavaScript, MUST NOT load any of the application scripts, and MUST NOT register a service worker or open any WebSocket or WebRTC connection. Adding a sixth document SHALL require a corresponding change to this requirement, because the page set is a policy and maintenance commitment rather than a layout choice.

#### Scenario: Page renders with scripting disabled

- **WHEN** a client with JavaScript disabled requests `/privacy`
- **THEN** the full policy text is present in the served HTML and is legible
- **AND** no application script, WebSocket, or WebRTC connection is initiated

#### Scenario: Content pages are inert

- **WHEN** any of the four content pages is loaded in a browser
- **THEN** no peer discovery occurs, no display name is assigned, and no service worker registration is attempted from that page

### Requirement: Extensionless Addressing Without Redirects

Content pages SHALL be reachable at extensionless canonical URLs, served by `express.static` configured with `extensions: ['html']`. A request for a canonical URL MUST be answered with `200` and the page body directly.

The `.html` form of each page MUST also answer `200` with the same body. Neither form SHALL redirect to the other. Each page MUST declare `<link rel="canonical">` pointing at its extensionless URL, which is the sole mechanism for consolidating the two forms.

No content page URL SHALL issue a redirect under any circumstances. This deployment's service worker aborts on redirected responses — `fromNetwork` and `updateCache` both throw when `response.redirected` is true — so any redirecting same-origin URL is unreachable for clients that have the worker installed.

#### Scenario: Canonical URL serves directly

- **WHEN** `GET /privacy` is requested and `public/privacy.html` exists
- **THEN** the response status is `200` and the body is the contents of `privacy.html`
- **AND** the response is not a redirect and the browser address bar still reads `/privacy`

#### Scenario: Extension form is served, not redirected

- **WHEN** `GET /privacy.html` is requested
- **THEN** the response status is `200`, not `301` or `302`
- **AND** the body declares `<link rel="canonical" href="https://snap-drop.net/privacy">`

#### Scenario: Client with the service worker installed navigates to a page

- **GIVEN** a browser that has previously loaded the app and installed the service worker
- **WHEN** the user navigates to `/privacy`
- **THEN** the worker's fetch handler resolves the request from the network without throwing
- **AND** the page renders, because no redirect occurred at any hop

### Requirement: Honest Status Codes for Unresolvable Paths

A request for a path that matches no static file and no configured route SHALL be answered with HTTP status `404` and the `/404` body. It MUST NOT be answered with a redirect to the root or with any `2xx` status.

The 404 body MUST link back to the application root so that a human who lands there can recover in one click.

#### Scenario: Unknown path returns 404

- **WHEN** `GET /this-path-does-not-exist` is requested
- **THEN** the response status is `404`
- **AND** the body is the 404 page and contains a link to `/`

#### Scenario: Soft 404 is eliminated

- **WHEN** a crawler requests two different nonexistent paths
- **THEN** both receive status `404`
- **AND** neither receives a `301` to `/` nor a body identical to the application shell

#### Scenario: Existing routes are unaffected by the reordering

- **WHEN** `GET /`, `GET /config`, and `GET /ads.txt` are requested after the routing change
- **THEN** each returns the same status and body as before the change
- **AND** `/config` still returns the signaling server and button configuration as JSON

### Requirement: Transfer Flow Is Unaffected

The introduction of content pages, footer links, and the routing change SHALL NOT alter peer discovery, pairing, public rooms, the Web Share Target, or WebRTC transfer in any observable way.

Pair and room links are query parameters on the current path, and the Web Share Target posts to `/`; no client feature constructs a path-segment URL. Removing the catch-all redirect therefore MUST NOT break any client-generated link.

Footer links MUST sit within the existing `<footer>` element, outside the `#center` scroll region and outside both ad placements, and MUST NOT overlay, delay, or reduce the peer discovery area or the drag-and-drop target.

#### Scenario: Pair link survives the routing change

- **WHEN** a user copies a pair link and opens it on a second device
- **THEN** the URL carries `?pair_key=` on the root path, resolves with status `200`, and pairing completes as before

#### Scenario: Share target still functions

- **WHEN** a file is shared to the installed PWA, producing a `POST` to `/`
- **THEN** the service worker intercepts it and the share-target flow completes unchanged

#### Scenario: Drop target is unobstructed

- **WHEN** the app shell is loaded on a narrow mobile viewport with footer links present
- **THEN** the peer discovery area and drop target occupy the same region as before
- **AND** a file dragged onto the page is accepted by the drop target, not by the footer

### Requirement: Advertising and Privacy Disclosures

`/privacy` SHALL carry the disclosures Google requires of publishers, stating that third-party vendors including Google use cookies to serve ads based on a user's prior visits to this site, that Google's advertising cookies enable Google and its partners to serve ads based on visits to this site, and how to opt out. It MUST link to Google Ads Settings for opting out of personalized advertising and to the NAI opt-out for other vendors.

The policy MUST also state accurately what this instance does and does not handle: that file contents never traverse the server, that transfers are peer-to-peer and encrypted in the browser, that the server relays signaling only, and what is retained when TURN relaying is used.

The policy MUST be reachable from the application shell without a search, and MUST record its own last-updated date.

#### Scenario: Required advertising disclosures are present

- **WHEN** `/privacy` is read
- **THEN** it discloses third-party and Google advertising cookie use in the terms Google requires
- **AND** it links to Google Ads Settings and to the NAI opt-out

#### Scenario: Policy is reachable from the app

- **WHEN** a user opens the About dialog or looks at the app footer
- **THEN** a link to `/privacy` is present and resolves with status `200`

#### Scenario: Policy claims match system behavior

- **WHEN** the policy states that file contents never reach the server
- **THEN** that statement holds for every transfer path, including the TURN fallback, whose retention is described separately rather than being omitted

### Requirement: Acceptable Use Terms

`/terms` SHALL prohibit using the service to transfer material the user has no right to distribute, or that is unlawful, and SHALL disclaim warranty and liability for a free, unmoderated service.

The terms MUST state plainly that the operator cannot inspect transferred content, because the server never receives it, rather than implying a moderation capability that does not exist.

#### Scenario: Prohibited use is stated

- **WHEN** `/terms` is read
- **THEN** it prohibits transferring infringing or unlawful material
- **AND** it disclaims warranty and limits liability

#### Scenario: Moderation capability is not overstated

- **WHEN** `/terms` describes enforcement
- **THEN** it states that content is not and cannot be inspected server-side
- **AND** it does not claim any content review, scanning, or takedown capability the architecture cannot provide

### Requirement: Original Content and Attribution

Page bodies SHALL be written for this deployment. Text MUST NOT be copied from the upstream Snapdrop or PairDrop projects, from `docs/*.md` in this repository, or from any other deployment of this codebase, because replicated content is the condition being remedied.

`/about` MUST identify the operator of this instance, provide a working contact address, and state that SnapDrop is a fork of Snapdrop and PairDrop with links to both upstream projects.

#### Scenario: Content is not replicated from upstream

- **WHEN** any page body is compared against upstream project text and against other deployments of this codebase
- **THEN** no substantive passage is a copy

#### Scenario: Attribution and contact are present

- **WHEN** `/about` is read
- **THEN** it names the operator, gives a contact address, and links to both upstream projects

### Requirement: Content Pages Are Excluded From the Offline Cache

Content pages, the 404 page, the shared page stylesheet, and `sitemap.xml` SHALL be listed in `relativePathsNotToCache` in `public/service-worker.js`, and SHALL NOT be added to `relativePathsToCache`.

Both URL forms of each page MUST be listed, because `doNotCacheRequest` matches the request path exactly against that list.

Because the precache list does not change, no content page SHALL require a `cacheVersion` bump, now or when one is added later. This does not exempt the change as a whole: `public/index.html` is precached, so any modification to it — the footer links and the verification snippet — MUST be accompanied by a `cacheVersion` bump, or returning users will continue to receive the previous shell.

#### Scenario: Pages are never served from cache

- **WHEN** a client with the service worker installed requests `/privacy` or `/privacy.html`
- **THEN** the request is answered from the network
- **AND** the response is not written into the cache

#### Scenario: Edits go live without a shell re-download

- **GIVEN** a returning user with the current app shell cached
- **WHEN** the privacy policy text is edited and deployed with `cacheVersion` unchanged
- **THEN** that user sees the updated policy on next visit
- **AND** the application shell is not re-downloaded

#### Scenario: App shell offline behavior is preserved

- **WHEN** the client goes offline after installing the service worker
- **THEN** the application shell still loads from cache exactly as before
- **AND** content pages are unavailable offline, which is the accepted trade-off

### Requirement: AdSense Verification Snippet

The application shell SHALL carry Google's AdSense verification snippet as static markup inside `<head>` in `public/index.html`, present in the served document on every page load. It MUST NOT be injected at runtime, MUST NOT be conditional on placement configuration, viewport, display mode, or connectivity, and MUST carry the deployment's publisher ID.

The snippet SHALL be loaded asynchronously and MUST NOT block first paint, application hydration, or the transfer flow, whether it succeeds, fails, is blocked, or hangs.

The snippet SHALL NOT be deployed before `/privacy` is live and reachable, because it sets third-party cookies that the policy must already disclose.

Loading the snippet SHALL NOT by itself constitute an ad request. No `adsbygoogle.push()` may be issued, no placement may reserve space, and no placement may render, while advertising is suppressed or disabled.

No placement SHALL be enabled until a Google-certified consent management platform is live, because the snippet loads for visitors in regulated regions from the moment it ships.

#### Scenario: Snippet present in the served document

- **WHEN** the application shell is fetched without executing JavaScript
- **THEN** the response body contains the AdSense snippet inside `<head>` with the deployment's publisher ID
- **AND** it is present regardless of whether any placement is enabled

#### Scenario: Snippet does not resurrect ad behavior

- **GIVEN** every placement is disabled
- **WHEN** the shell loads and the snippet executes
- **THEN** no `adsbygoogle.push()` is issued and no ad request is made
- **AND** no placement reserves space, and the layout is identical to a build with advertising disabled

#### Scenario: Snippet fails or is blocked

- **WHEN** `pagead2.googlesyndication.com` is unreachable, blocked by an extension, or hangs
- **THEN** the shell reaches a fully hydrated, transfer-capable state in the same number of steps and the same order
- **AND** no error is surfaced to the user

#### Scenario: Ordering against the privacy policy

- **WHEN** the deployment carrying the snippet is released
- **THEN** `/privacy` is already live, reachable from the shell, and discloses the advertising script
- **AND** no build in which the snippet is present and `/privacy` is absent is ever deployed

#### Scenario: Installed PWA still suppresses advertising

- **WHEN** the application is launched from an installed PWA in an app-like display mode
- **THEN** the snippet may load, but no ad request is issued and no placement is rendered
- **AND** the offline shell behavior is unchanged

### Requirement: Discovery

Content pages SHALL be discoverable without prior knowledge of their URLs. The application shell MUST link to them from its footer; each content page MUST link to the others and back to the application root.

`public/sitemap.xml` MUST list the canonical URL of the application root and of each content page, and `robots.txt` MUST carry a `Sitemap:` directive pointing at it. `robots.txt` MUST continue to permit crawling of the content pages.

The existing `PRIVACYPOLICY_BUTTON_*` configuration SHALL be used to surface the policy link in the About dialog rather than introducing a second mechanism.

#### Scenario: Reviewer reaches every page from the root

- **WHEN** a visitor starts at `/` and follows only links
- **THEN** all four content pages are reachable

#### Scenario: Sitemap and robots agree

- **WHEN** `sitemap.xml` is fetched
- **THEN** it lists the root and all four canonical page URLs and is valid per the Sitemaps protocol
- **AND** `robots.txt` references it via a `Sitemap:` directive and disallows none of those paths

#### Scenario: About dialog surfaces the policy

- **GIVEN** `PRIVACYPOLICY_BUTTON_ACTIVE` is set with `PRIVACYPOLICY_BUTTON_LINK` pointing at `/privacy`
- **WHEN** `/config` is fetched and the About dialog is opened
- **THEN** the privacy policy button is visible and links to `/privacy`

### Requirement: Localization Boundary

Footer link labels in the application shell SHALL be localized through `public/lang/en.json` with `data-i18n-key` wiring, falling back to English for locales that lack a translation, consistent with every other shell string.

Content page bodies SHALL be English only and MUST NOT be added to the localization files. Each page MUST state that it is available in English only.

#### Scenario: Link labels follow the locale

- **WHEN** the app shell is loaded with a locale that has translated footer link labels
- **THEN** the labels render in that locale

#### Scenario: Untranslated locale falls back

- **WHEN** the app shell is loaded with a locale that lacks the new keys
- **THEN** the labels render in English and no key placeholder or empty element is shown

#### Scenario: Page bodies stay out of the locale files

- **WHEN** the localization files are inspected after the change
- **THEN** they contain the new link-label keys only, and no page body text

### Requirement: Self-Hosters Can Remove the Layer

Content pages SHALL be plain static files that a self-hoster can edit or delete without touching application code. Deleting a page MUST NOT break the application: the shell MUST continue to function, and a link to a removed page MUST resolve to the 404 page rather than to an error.

`/about` MUST make clear that operator identity and contact details apply to this instance and are expected to be replaced by anyone hosting their own.

#### Scenario: Page deleted by a self-hoster

- **GIVEN** a self-hosted deployment with `public/terms.html` deleted
- **WHEN** the shell is loaded and the footer link to `/terms` is followed
- **THEN** the shell functions normally and the link resolves to the 404 page with status `404`
- **AND** no server error occurs and no console exception is raised in the shell
