## Why

The September 27 review was rejected without a specific reason even though Policy Center is clear. A separately confirmed integration defect is actionable: the static AdSense tag bypasses `AD_CONFIG.enabled: false`, and production loads Google's ad implementation and makes an ad request while Auto ads is enabled. The earlier assumption that the verification tag cannot request ads is false; this does not establish the reason for Google's rejection.

## What Changes

- Separate AdSense ownership verification from serving by replacing the unconditional ad script with Google's supported account meta tag; preserve `ads.txt` and both in-application placement containers and their gated loader.
- Restore the disabled build's zero advertising-script/request boundary and add regression coverage for verification, identifiers, and runtime suppression. Do not move monetization to guide pages.
- Correct About and Privacy to describe actual disabled runtime behavior without claiming an absent CMP or existing advertising revenue.
- Turn off site-level Auto ads and Auto optimize if console access permits; correct the existing CMP privacy-policy URL without changing consent/vendor choices. Verify ownership using the meta method after deployment if accessible; do not resubmit another unchanged review.
- Record a primary-source assessment of AdSense and alternative in-app display providers, with explicit unresolved acceptance and consent requirements. Do not enroll with or enable a new provider without the operator's decision.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `monetization`: Restore complete suppression of third-party advertising when disabled and separate identity verification from activation. Supersedes the verification-library exception in the in-flight `add-adsense-compliance-pages` change.
- `site-content`: Replace script-only verification and library-always-loads disclosures with metadata-based verification and accurate runtime disclosures. These capabilities are defined in the existing in-flight changes, not yet archived to main specs.

## Impact

- `public/index.html`, `public/service-worker.js`, `public/about.html`, `public/privacy.html`, and advertising comments in `public/scripts/placements.js`.
- `scripts/verify-site-content.mjs`, a dependency-free advertising regression check, and npm verification scripts.
- Existing AdSense site settings and ownership verification, only where accessible. No ad unit activation, new commercial account, accepted terms, consent-vendor change, or repeated review submission.
- No layout, transfer protocol, dependency, guide-only monetization strategy, or user-file handling change. Peer discovery, transfers, and offline use must remain unaffected.
