## Context

The user requires monetization inside the transfer application and explicitly rejects moving all advertising to guides. The last review returned only a generic rejection. On September 27, Policy Center is clear; Auto ads and Auto optimize are ON; the site requires review. A clean browser loads `adsbygoogle.js`, `show_ads_impl.js`, and a `doubleclick.net/pagead/ads` request despite the disabled configuration. The response is an unfilled 0x0 request, not evidence of a visible ad or revenue. CMP configuration cannot currently be read because Privacy & messaging returns “Can't load page.”

This contradicts the static-script exception introduced in `add-adsense-compliance-pages`. Its claim that a script is mandatory for approval and cannot initiate ad requests is superseded by this change. The original gated placement loader already implements the desired suppression behavior; no replacement ad framework is needed.

## Goals / Non-Goals

**Goals:** restore a reliable ad-off state, retain in-application monetization capability, preserve ownership verification, align public disclosures with deployed behavior, and evaluate realistic alternative providers.

**Non-goals:** guarantee approval, claim the discovered bypass caused the rejection, move ads to guides, manufacture editorial content, activate unapproved inventory, add a generic multi-provider abstraction, register commercial accounts, or accept terms for the operator. No file-transfer or signalling change.

## Decisions

### D1 — Non-executable identity, gated advertising

Use Google's documented `<meta name="google-adsense-account" content="ca-pub-7669832766470834">` in the root head instead of an unconditional advertising script. Keep the public `ads.txt` record unchanged. Google's [connection instructions](https://support.google.com/adsense/answer/7584263?hl=en) explicitly support meta verification. The current console also offers it.

Keep `AdManager`, its two in-app containers, all suppression gates and the dynamic tag loader. With the global flag false, no ad script or request originates from a fresh page. Enabling future placements remains contingent on provider approval for this actual use case, consent verification, real slot IDs, and Auto ads disabled. Metadata does not grant approval or implement consent.

Alternative rejected: keeping the unconditional script and only turning Auto ads off. Google's [Auto ads documentation](https://support.google.com/adsense/answer/9261307?hl=en) shows the same script is used for automatic serving; the runtime also makes requests without a configured manual slot. A dashboard setting is not a substitute for the local kill switch.

### D2 — Repair current settings without making a new commercial decision

Disable Auto ads and Auto optimize for this site, preserving manual placement configuration. If accessible, correct the existing consent message's privacy URL to `https://www.snap-drop.net/privacy`, leaving vendors, geography and consent options unchanged. If the console is unavailable, record the precise limitation instead of treating absence of Policy Center warnings as proof of working consent. After deployment, verify ownership with the meta method if accessible. Do not request another review in this change.

### D3 — Accurate disclosures, no unsupported CMP claim

Describe the current ad-off build and its passive verification metadata. Do not claim a CMP has never been configured, nor that the cleared warning proves it is operational. Describe approval, privacy disclosure and appropriate consent as prerequisites to future advertising. Present Google's data/cookie behavior conditionally, not as current tracking by this disabled build. Correct About's claim of existing advertising income without inventing sponsor revenue or financial figures.

### D4 — Regressions cover behavior, not only flags

The existing content verifier will check the meta tag, publisher agreement with `ads.txt` and config, absence of unconditional external advertising scripts, disabled flags, and new cache version. Add a dependency-free Node VM harness running the real placement manager with fake DOM/network append hooks. Cover global disable even with otherwise valid placements, per-placement disable, placeholder IDs, offline, app-like display modes, webviews, invalid viewport detection, and a mocked enabled positive control. No test makes real advertising requests.

Confirm in real Chromium that the fresh disabled page emits zero advertising/CMP requests, reserves no space, hydrates and discovers a second peer. Exercise file/text transfer and a service-worker-controlled reload. Bump the shell cache once to `v1.11.2-sd.5`; preserve the existing asset set and content-page network-only behavior. Do not force-reload an active transfer to clear old tabs.

### D5 — Evaluate alternatives against the product, not approval promises

The [Google inventory policy](https://support.google.com/publisherpolicies/answer/11112688?hl=en) and [private-communications placement policy](https://support.google.com/adsense/answer/1346295?hl=en) are real fit risks, not a diagnosis. Do not hide the application's actual purpose from reviewers or show crawlers different content.

Record official evidence for banner-based alternatives and the specific acceptance questions for private P2P file/text transfer. A file-hosting marketing example does not prove acceptance of this application. Prioritize non-obstructive display formats; exclude popunders, forced redirects, push prompts, fake download controls and automatic multi-format bundles. No paid signup, provider script or speculative adapter is added until a provider accepts the use case and the operator chooses it. Google MCM/AdX partners still require Google policy compliance and are not a rejection workaround.

## Risks / Trade-offs

- A previously opened tab can retain old HTML → the new service-worker cache applies on a subsequent navigation; do not disrupt live transfers.
- Metadata selection might need a new console verification → verify after deployment without resubmitting review; keep `ads.txt` available.
- No AdSense library means Google-hosted messages also will not be delivered by that tag in the disabled build → no advertising is requested; consent must be validated before reactivation.
- Advertising reactivation could expose Google policy issues even after approval → reassess exact workspace inventory and obtain provider clarification; do not interpret acceptance as blanket placement permission.
- Ad-network scripts may access same-page private data → future selection must assess vendor-approved isolation, data collection, URL parameters and consent; no alternative script is installed during research.

## Migration Plan

1. Verify baseline requests and prepare evidence-backed provider assessment.
2. Apply metadata and disclosure changes, restore verification assertions, and run static/runtime checks.
3. Disable automatic placement settings if accessible; record any blocked console task.
4. Deploy to the existing Fly application and verify fresh production HTML, network behavior, ad-off gates and transfer availability.
5. Verify ownership with the meta method if accessible; do not resubmit until the operator selects the next monetization path.

Rollback uses a normal revert/deployment with another cache bump, but must not restore uncontrolled ad requests merely to recover an ownership check. If a non-ad regression occurs, keep the passive verification tag and disable serving while correcting it.

## Open Questions

- Google has not supplied a specific rejection reason; account eligibility cannot be guaranteed by this repair.
- Which non-Google provider will explicitly accept the private transfer workspace and a banner-only format?
- What are the current first-party traffic/geography metrics, distinct from historical search clicks?
- When Privacy & messaging becomes accessible, does its existing policy URL and regional flow match the live site?
