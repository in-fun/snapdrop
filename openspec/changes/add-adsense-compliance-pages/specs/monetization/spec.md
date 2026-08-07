# Monetization

Delta against the `monetization` capability introduced by `add-ad-monetization`.

Site eligibility requires Google's verification snippet to sit in `<head>` of the served document on every page load (see the `site-content` capability's **AdSense Verification Snippet** requirement). The existing **Suppression Contexts** requirement forbids requesting the ad tag in any suppressing context and asserts that a fully disabled build makes no third-party ad request at all. Those cannot both hold.

The requirement is narrowed rather than dropped: it now distinguishes **loading the library** from **issuing an ad request**. Everything suppression was protecting is preserved — layout stability, the offline PWA experience, and an unobstructed transfer flow. What is given up is the "zero third-party bytes" property, which was a means to those ends rather than an end in itself, and which is incompatible with being approved to serve ads at all.

## MODIFIED Requirements

### Requirement: Suppression Contexts

Advertising MUST be suppressed — no space reserved, no placement rendered, no ad request issued — in every context where it must not or cannot serve. Suppression SHALL be determined from local state only, with no network request. Any context that is not positively cleared MUST be treated as suppressed.

Suppression governs **ad requests**, not the presence of the ad library. The AdSense verification snippet MAY load in any context, because site eligibility requires it in the served document unconditionally. Loading the library SHALL NOT by itself constitute an ad request: while suppressed, no `adsbygoogle.push()` may be issued, no placement may render, and no space may be reserved. In every suppressing context the rendered layout MUST remain identical to a build with advertising disabled entirely.

The suppressing contexts are: an installed or app-like display mode (`standalone`, `minimal-ui`, `fullscreen`); a webview or in-app browser; absence of network connectivity; a viewport shorter than the small-viewport threshold; a viewport narrower than the narrowest supported ad unit; a placement whose own viewport gate is unmet; and an explicit per-placement or global disable.

#### Scenario: Installed PWA in an app-like display mode

- **WHEN** the application is launched from an installed PWA in `standalone`, `minimal-ui`, or `fullscreen` display mode
- **THEN** no ad request is issued
- **AND** no placement is rendered and no vertical space is reserved
- **AND** the layout is identical to a build with advertising disabled

#### Scenario: Running inside a webview or in-app browser

- **WHEN** the application is loaded inside a webview or an in-app browser
- **THEN** advertising is suppressed exactly as in the installed-PWA case

#### Scenario: Offline at load

- **WHEN** the application loads while `navigator.onLine` reports no connectivity
- **THEN** no ad request is issued and no placement is rendered
- **AND** the application functions normally as an offline PWA
- **AND** a failed request for the verification snippet does not affect hydration or the transfer flow

#### Scenario: Viewport too short

- **WHEN** the viewport height is below the small-viewport threshold, such as a phone held in landscape
- **THEN** the `top` placement is suppressed and reserves no space
- **AND** the peer discovery area retains its full height

#### Scenario: Viewport narrower than the narrowest ad unit

- **WHEN** the viewport is narrower than the narrowest supported ad unit
- **THEN** the placement is suppressed rather than rendered at a reduced size
- **AND** no ad is clipped or scaled

#### Scenario: Placement disabled by configuration

- **WHEN** a placement is configured as disabled, or advertising is globally disabled
- **THEN** that placement reserves no space and issues no ad request
- **AND** with everything disabled the served application issues no ad request at all, though the verification snippet may still load

#### Scenario: Verification snippet present but advertising fully disabled

- **WHEN** the verification snippet is in `<head>` and every placement is disabled
- **THEN** the library may be fetched and evaluated
- **AND** no `adsbygoogle.push()` is issued, no placement renders, and no space is reserved
- **AND** the rendered layout is byte-identical to a build with no advertising code at all
