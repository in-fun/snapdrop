# Review preparation record

## AdSense status observed on 13 September 2026

The user supplied this exact text from the onboarding page for publisher `pub-7669832766470834`; the signed-in browser showed the same generic status:

> Your account wasn't approved
> You need to fix some issues before you can use AdSense
> Your account was not approved
> Meet AdSense program policies
> To earn with AdSense you need to meet AdSense Program Policies.

Neither the onboarding page nor the user's email supplies a specific violation. The rejection date is unknown. Do not record “low-value content” as Google's stated reason or assume this is solely a site-level issue.

The accessible AdSense navigation contains Home, Reports, Payments, Account, and Feedback, but no Privacy & messaging or Sites section. Notifications show “All caught up!” Consent configuration cannot currently be verified through this onboarding interface. Keep the consent task pending and complete it when available, before enabling ads; do not require access to a hidden interface as a prerequisite for another account review.

The FAQ and architecture corrections address an observable content weakness. Approval remains a separate Google decision. Relevant guidance: [site readiness](https://support.google.com/adsense/answer/7299563), [site connection and review](https://support.google.com/adsense/answer/7584263), and [inventory without publisher content](https://support.google.com/publisherpolicies/answer/11112688).

## Repository preparation

- Added twenty original operational FAQ answers with stable fragments, reciprocal navigation, canonical and sitemap discovery.
- Corrected architecture claims about signalling, connectivity, file size, and interruption.
- Corrected the privacy disclosure: the AdSense verification library contacts Google while application ad placements remain disabled. This is a factual disclosure change, not consent implementation.
- Kept both FAQ aliases outside the service-worker cache and refreshed the precached footer and English locale bundle with `v1.11.2-sd.4`.
- Added `npm run verify:site-content`; all 143 checks passed. OpenSpec validation, JavaScript syntax, sitemap XML, and diff whitespace checks passed.
- Local HTTP matrix passed on 13 September: FAQ aliases direct 200 with identical bodies; root/config/ads.txt 200; unknown path 404; POST root 303 to root.
- Chromium browser checks passed at 1366×900, 360×800, and 320×480, including fragment/navigation links, readable layout, footer separation, and inert content-page networking. With the local server stopped, the root loaded from its service worker while the FAQ was unavailable; none of the FAQ aliases/query URLs entered Cache Storage. File bytes and filename, Unicode text, pairing, and public-room joins passed between isolated browser contexts. These are desktop Chromium checks with emulated viewport sizes, not physical iOS/Android coverage.

## Search Console observed on 13 September 2026

The domain property `snap-drop.net` is accessible. Its indexed-pages report lists the root, `/privacy`, `/how-it-works`, `/terms`, and `/about`, with the status “These pages can be served on Google.” Last crawl dates shown are 4–5 September. The Sitemaps table has no submitted sitemap. The FAQ was not yet deployed at this observation.

The 28-day Search performance view for 13 August–9 September shows 191K clicks, 1.05M impressions, 18.1% CTR, and average position 2.3. These are Search Console's reported figures, not independent analytics. Lack of traffic or failure to index the existing five pages is not supported by this evidence.

## Search Console follow-up on 14 September 2026 (AEST)

The sitemap was submitted on 13 September at approximately 12:52:51 UTC. The submission dialog confirmed success, but the initial report row showed type “Unknown,” status “Couldn't fetch,” and zero discovered pages. Submission acceptance is not evidence that Google fetched or processed it.

The FAQ live test reported “URL is available to Google” and “Page can be indexed.” Its indexing request was accepted at approximately 13 September 23:55:46 UTC (14 September 09:55 AEST): “URL was added to a priority crawl queue.” Actual indexing remains pending.

The follow-up sitemap check now reports **Success**, type **Sitemap**, and **6 discovered pages**, with submitted and last-read dates of 13 September. The initial fetch status resolved without another submission. `/how-it-works` reports “URL is on Google” and “Page is indexed”; its updated-content indexing request was accepted at approximately 13 September 23:57:00 UTC. Both required crawl requests are complete. No new AdSense review has been submitted; wait for the FAQ's actual indexing result first.

The final fresh FAQ inspection shows **Crawled - currently not indexed**. Googlebot smartphone fetched it successfully; crawling and indexing are allowed. The user canonical is `https://www.snap-drop.net/faq` and Google's selected canonical is the inspected URL. Thus the pending result is Google's indexing decision, not a demonstrated crawl, robots, or canonical failure. Search Console displayed the last crawl as 14 September 2026 at 1:43:17 AM; its display timezone was not independently established.

An independent HTTP request to the sitemap with a Googlebot user-agent returned direct 200, `application/xml`, and the expected body. The robots file allows all paths and points at the canonical sitemap. This does not substitute for a fetch from Google's infrastructure; use Search Console's live inspection to resolve any continuing fetch error, as described in [Google's sitemap report documentation](https://support.google.com/webmasters/answer/7451001).

## External review sequence

1. Deploy and verify the canonical production pages, sitemap, verification integration, and disabled placements.
2. Submit the updated sitemap and request indexing of `/faq` and `/how-it-works` in Search Console. Confirm Google's selected canonicals and crawlability. Waiting for indexing is this project's confidence check, not a stated AdSense eligibility requirement.
3. Configure and verify the consent messages for the site's audience before enabling ads. Google's [certified CMP guidance](https://support.google.com/adsense/answer/13554116) and [Privacy & messaging setup](https://support.google.com/adsense/answer/7670013) explain the supported integration. Publication requires the operator's actual vendor and consent choices; a privacy paragraph alone does not supply consent.
4. Submit one new AdSense review after deployment and indexing checks, using the current onboarding flow. Complete consent setup first if available; if account onboarding prevents access, retain it as an outstanding pre-ad-serving task. Record the submission date and exact result. If rejected again, capture any newly available detail before making another change.
5. Keep placements disabled until approval, real slot IDs, consent verification, and a fresh assessment of eligible inventory. A site approval does not establish that the transfer workspace is suitable for ads.

## Deployment reference

Existing Fly app: `pair-drop`, primary region `sjc`. Before this change, release 14 used `registry.fly.io/pair-drop:deployment-01KZGHBK5KWNKKT2E80DYYY09V`. This reference can be used to restore the prior application image if the new deployment fails verification.

The content update was deployed as release 15, image `registry.fly.io/pair-drop:deployment-01M2DD3KN26WSQSCM7DJ8NST6H`, and verified on the canonical production host. Live verification discovered Cloudflare's existing email-obfuscation transform on About, Privacy, and Terms. A follow-up adds the documented per-address opt-out comments so their public contact links remain readable without an injected decoding script; see design D10. No Cloudflare zone settings were changed.

The follow-up is deployed as **release 16**, image `registry.fly.io/pair-drop:deployment-01M2EM8CNQNEQ0SQBWQ671K08D`, with the existing machine started at 14 September 00:15:55 UTC. Production checks pass for all ten informational URL forms: direct 200, correct canonicals, source-equivalent HTML (ignoring the opt-out comment delimiters), no script tags or obfuscated email markup, and literal public mailto links. Root navigation and AdSense verification remain present; placements remain disabled and service-worker version remains `v1.11.2-sd.4`.

Repository implementation, production deployment, sitemap submission, and both indexing requests are complete. Outstanding work is the FAQ's actual indexing result, one subsequent AdSense review, consent setup when the account UI permits it, and the post-approval placement/slot review. No AdSense resubmission or ad activation has occurred.

Releases 15 and 16 were deployed from the working tree on `feat/ad-monetization`. Future deployments from GitHub must include this change to avoid replacing the preparation update with older source.

## Separate maintenance finding

The production image build reported five existing dependency audit findings (three high, two moderate). A read-only `npm audit --omit=dev --json` confirmed affected packages `express`, `path-to-regexp`, `ws`, `body-parser`, and `qs`; fixes are reported as available. The lockfile and production dependency versions were not changed by this content work. Address these in a separate dependency/security update with HTTP and WebSocket regression checks. This is not evidence of the AdSense rejection reason.
