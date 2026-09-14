## Why

The first AdSense-readiness change is deployed: the verification tag, privacy and terms pages, honest routing, canonical URLs, sitemap, and original architecture page are live. The account onboarding page still reports “Your account wasn't approved” and “Meet AdSense program policies,” without a specific violation. Content depth is a plausible repository-side improvement, not a confirmed explanation for that rejection: today the informational layer has only one substantial product document and does not answer the practical questions people encounter while using the transfer tool.

## What Changes

- Add a hand-authored `/faq` page with code-accurate answers about discovery, same-network and Internet transfers, browser and device compatibility, file handling, pairing, privacy, security, and common failure modes.
- Deepen `/how-it-works` with practical troubleshooting guidance that connects observable failures to this deployment's actual WebRTC, STUN, and no-relay behavior.
- Correct `/privacy` to distinguish disabled ad placements from the AdSense verification library that already loads, and disclose that library's third-party request accurately.
- Preserve the public contact links through Cloudflare using its supported per-address obfuscation opt-out, keeping the informational pages readable without injected decoding scripts.
- Link the FAQ from the application footer and every informational page, and link its answers to the existing detailed policy and architecture pages instead of duplicating them.
- Add the FAQ's canonical URL to `sitemap.xml` and keep both of its served URL forms out of the service-worker cache so corrections publish immediately.
- Add repeatable static and HTTP checks for crawler-visible content, canonical and navigation consistency, cache exclusion, honest status codes, and the unchanged AdSense suppression gate.
- Keep all new material outside the transfer workspace: no modal, banner, interstitial, framework, dependency, ad placement, or runtime application code is introduced.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `site-content`: Expand the informational document set with a substantive FAQ, deepen troubleshooting content, and update discovery and cache-exclusion requirements. This capability is currently defined by the in-flight `add-adsense-compliance-pages` change and has not yet been archived to the main specs.

## Impact

- `public/faq.html` — new inert, English-only informational page.
- `public/how-it-works.html`, the existing informational pages, and `public/index.html` — additional content and navigation links.
- `public/sitemap.xml` and `public/service-worker.js` — discovery and no-cache entries; the app-shell edit requires one cache-version bump.
- Repository verification — new dependency-free static and local HTTP checks; no production dependency is added.
- Deployment and external consoles — the completed change must be deployed and indexed before the next AdSense review. CMP configuration, Search Console submission, and AdSense resubmission remain operator actions outside this repository.
