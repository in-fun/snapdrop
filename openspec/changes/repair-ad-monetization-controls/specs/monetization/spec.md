## MODIFIED Requirements

### Requirement: Suppression Contexts

Advertising MUST be suppressed — no third-party advertising script or advertising request, no space reserved, and no placement rendered — in every context where it must not or cannot serve. Suppression SHALL be determined from local state only, without a network request. Any context that is not positively cleared MUST be treated as suppressed. Passive ownership metadata SHALL remain present without loading the advertising library.

The suppressing contexts are: an installed or app-like display mode (`standalone`, `minimal-ui`, `fullscreen`); a webview or in-app browser; absence of network connectivity; a viewport shorter than the small-viewport threshold; a viewport narrower than the narrowest supported ad unit; a placement whose own viewport gate is unmet; a placeholder slot ID; and an explicit per-placement or global disable. The disabled layout MUST remain identical to the ad-free workspace. In-application containers and the gated loader SHALL remain available for a separately approved activation; this change MUST NOT move monetization to informational pages.

#### Scenario: Installed PWA in an app-like display mode

- **WHEN** the application is launched in standalone, minimal-ui, fullscreen or iOS home-screen mode
- **THEN** no advertising script or request is issued and no placement renders or reserves space
- **AND** passive ownership metadata and offline application behavior are preserved

#### Scenario: Running inside a webview or in-app browser

- **WHEN** the application is loaded in a detected webview or in-app browser
- **THEN** advertising is suppressed exactly as in the installed-PWA case

#### Scenario: Offline at load

- **WHEN** `navigator.onLine` reports no connectivity
- **THEN** no advertising script or request is issued and no placement is rendered
- **AND** the cached application still loads without a third-party advertising dependency

#### Scenario: Viewport too short

- **WHEN** the viewport is below the small-viewport height threshold
- **THEN** advertising is suppressed and the peer discovery area retains its space

#### Scenario: Viewport narrower than the narrowest ad unit

- **WHEN** the viewport is narrower than the supported unit width
- **THEN** advertising is suppressed rather than clipped or scaled

#### Scenario: Placement disabled by configuration

- **WHEN** a placement is disabled or has a placeholder slot ID
- **THEN** it reserves no space and makes no request
- **AND** when every placement is suppressed, the ad library is not loaded

#### Scenario: Global kill switch overrides valid placement settings

- **GIVEN** placements otherwise have valid slots and enabled flags
- **WHEN** the global flag is false
- **THEN** no advertising script, network request, placement or reservation occurs
- **AND** dashboard Auto ads cannot bypass this gate because no unconditional ad tag is present

#### Scenario: Context cannot be determined

- **WHEN** viewport detection is missing or throws, or the browser identity cannot be determined
- **THEN** the manager fails closed without preventing application initialization

#### Scenario: Future eligible placement remains supported

- **GIVEN** a separately approved configuration has valid identifiers and all suppression gates clear
- **WHEN** reserve and load execute
- **THEN** the existing in-application placement requests once and the tag loads once
- **AND** repeated load calls do not refresh the ad
