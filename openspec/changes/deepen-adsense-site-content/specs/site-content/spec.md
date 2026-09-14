## ADDED Requirements

### Requirement: FAQ Provides Original Operational Guidance

`/faq` SHALL provide hand-authored, deployment-specific guidance for people using SnapDrop. Its answers MUST be present in the served HTML without JavaScript and MUST cover, at minimum: starting a transfer; discovering nearby devices; connecting devices on different networks; pairing versus public rooms; supported file, text, and link transfers; practical browser and operating-system limitations; transfer size and speed; common connection and interrupted-transfer failures; download handling; encryption; what the signaling server can see; and the requirement to share only material the user owns or is authorized to share.

Claims MUST be derived from this repository's current client and server behavior. The page MUST distinguish browser/platform behavior from guarantees made by this deployment, MUST say that this instance has no TURN or WebSocket file-transfer fallback, and MUST NOT copy or lightly rewrite `docs/faq.md`, upstream project copy, or third-party material.

Answers SHALL link to `/how-it-works`, `/privacy`, and `/terms` where those pages carry the authoritative detail rather than duplicating policy or architecture prose. Each question SHALL have a stable fragment identifier so it can be linked directly.

#### Scenario: Reviewer receives substantive HTML

- **WHEN** a crawler fetches `/faq` without executing JavaScript
- **THEN** the complete question-and-answer content is present in the response body
- **AND** the page contains useful operational guidance rather than a feature list or placeholder copy

#### Scenario: Direct connection cannot be established

- **WHEN** a user reads the troubleshooting answer for a transfer that never connects
- **THEN** the answer explains that restrictive NATs, firewalls, VPNs, or managed networks can prevent WebRTC connectivity
- **AND** it accurately states that this deployment does not relay the file through TURN or WebSocket, so a transfer with no direct route fails

#### Scenario: Platform behavior varies

- **WHEN** an answer discusses downloads, background tabs, share targets, or browser support
- **THEN** it describes the limitation as browser- or operating-system-dependent
- **AND** it does not promise behavior the web application cannot control

#### Scenario: FAQ content is original

- **WHEN** the FAQ is compared with `docs/faq.md`, upstream Snapdrop and PairDrop copy, and other deployments
- **THEN** no substantive passage is copied or mechanically paraphrased
- **AND** every deployment-specific statement remains consistent with the current code and configuration

### Requirement: Advertising Disclosure Reflects the Current Integration

The privacy page MUST distinguish the current state of application ad placements from loading the third-party AdSense library. It MUST disclose that the verification library contacts Google even while application placements are disabled and MUST NOT imply that disabled placements prevent all third-party requests or implement consent management.

#### Scenario: Placements are disabled while verification code loads

- **WHEN** a visitor reads the privacy policy before ad placements are enabled
- **THEN** it accurately describes the existing verification library request and its third-party data handling
- **AND** it states that the application's placements are disabled and a CMP is not yet in place

## MODIFIED Requirements

### Requirement: Content Page Set

The deployment SHALL serve exactly six informational documents, each a standalone static HTML file under `public/` with a single defined purpose:

| URL | Purpose |
| --- | --- |
| `/about` | What SnapDrop is, who operates this instance, a contact address, and attribution to the upstream projects |
| `/how-it-works` | Original technical prose on WebRTC transfer, signaling, pairing, public rooms, NAT traversal, and practical connection troubleshooting |
| `/faq` | Original operational answers for using and troubleshooting this deployment across devices and browsers |
| `/privacy` | Data handling for this instance and the third-party advertising disclosures |
| `/terms` | Acceptable use, prohibited content, and disclaimer of warranty |
| `/404` | The body returned for unresolvable paths |

Each page MUST be readable without JavaScript, MUST NOT load any of the application scripts, and MUST NOT register a service worker or open any WebSocket or WebRTC connection. Adding a seventh document SHALL require a corresponding change to this requirement, because the page set is a policy and maintenance commitment rather than a layout choice.

#### Scenario: Page renders with scripting disabled

- **WHEN** a client with JavaScript disabled requests `/faq`
- **THEN** the full FAQ text is present in the served HTML and is legible
- **AND** no application script, WebSocket, or WebRTC connection is initiated

#### Scenario: Content pages are inert

- **WHEN** any of the five content pages is loaded in a browser
- **THEN** no peer discovery occurs, no display name is assigned, and no service worker registration is attempted from that page

### Requirement: Extensionless Addressing Without Redirects

Content pages SHALL be reachable at extensionless canonical URLs, served by `express.static` configured with `extensions: ['html']`. A request for a canonical URL MUST be answered with `200` and the page body directly.

The `.html` form of each page MUST also answer `200` with the same body. Neither form SHALL redirect to the other. Each of the five content pages MUST declare `<link rel="canonical">` pointing at its extensionless URL, which is the sole mechanism for consolidating the two forms. The application shell MUST likewise declare a canonical URL of `/`, because it answers at `/`, `/index.html`, and `/index`.

The 404 body is exempt and MUST NOT declare a canonical URL. It is served at every unresolvable path, so a canonical would advertise arbitrary nonexistent URLs as indexable. It MUST declare `<meta name="robots" content="noindex">` instead, and its links and asset references MUST be root-absolute, since document-relative URLs would resolve against the request path and break at any depth below the root.

No content page URL SHALL issue a redirect under any circumstances. This deployment's service worker aborts on any redirected response, so any redirecting same-origin URL is unreachable for clients with the service worker installed.

#### Scenario: Canonical URL serves directly

- **WHEN** `GET /faq` is requested and `public/faq.html` exists
- **THEN** the response status is `200` and the body is the contents of `faq.html`
- **AND** the response is not a redirect and the browser address bar still reads `/faq`

#### Scenario: Extension form is served, not redirected

- **WHEN** `GET /faq.html` is requested
- **THEN** the response status is `200`, not `301` or `302`
- **AND** the body declares `<link rel="canonical" href="https://www.snap-drop.net/faq">`

#### Scenario: Client with the service worker installed navigates to a page

- **GIVEN** a browser that has previously loaded the app and installed the service worker
- **WHEN** the user navigates to `/faq`
- **THEN** the worker's fetch handler resolves the request from the network without throwing
- **AND** the page renders, because no redirect occurred at any hop

### Requirement: Discovery

Content pages SHALL be discoverable without prior knowledge of their URLs. The application shell MUST link to them from its footer; each content page MUST link to the others and back to the application root.

`public/sitemap.xml` MUST list the canonical URL of the application root and of each content page, and `robots.txt` MUST carry a `Sitemap:` directive pointing at it. `robots.txt` MUST continue to permit crawling of the content pages.

The existing `PRIVACYPOLICY_BUTTON_*` configuration SHALL continue to surface the policy link in the About dialog rather than introducing a second mechanism.

#### Scenario: Reviewer reaches every page from the root

- **WHEN** a visitor starts at `/` and follows only links
- **THEN** all five content pages are reachable

#### Scenario: Sitemap and robots agree

- **WHEN** `sitemap.xml` is fetched
- **THEN** it lists the root and all five canonical content-page URLs and is valid per the Sitemaps protocol
- **AND** `robots.txt` references it via a `Sitemap:` directive and disallows none of those paths

#### Scenario: About dialog surfaces the policy

- **GIVEN** `PRIVACYPOLICY_BUTTON_ACTIVE` is set with `PRIVACYPOLICY_BUTTON_LINK` pointing at `/privacy`
- **WHEN** `/config` is fetched and the About dialog is opened
- **THEN** the privacy policy button is visible and links to `/privacy`
