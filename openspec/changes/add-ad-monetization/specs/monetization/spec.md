# Monetization

Governs how the deployment requests, places, and suppresses third-party advertising, and the guarantees advertising owes the core transfer experience.

**Platform APIs these requirements rest on:** [`display-mode`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/display-mode) media feature (installed-PWA and webview detection), [CSS flexible box layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout) (placements are flex items of the shell column, hence the compression requirement), the [HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API) and [`pointer-events`](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events) (drop-target transparency), [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) (fill detection), [`Navigator.onLine`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine) and the service worker [`FetchEvent`](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent) model (offline behaviour and cross-origin passthrough).

**Policies these requirements encode:** [ad placement policies](https://support.google.com/adsense/answer/1346295) (no unrequested refresh, separation from controls, permitted label wordings), [AdSense program policies](https://support.google.com/adsense/answer/48182) (no AdSense code inside software applications), [consent management requirements](https://support.google.com/adsense/answer/13554116) (Google-certified IAB TCF v2.2 CMP for EEA/UK/Switzerland traffic since 16 January 2024), [Ads.txt guide](https://support.google.com/adsense/answer/12171612) (publisher declaration at the origin root), and [Viewability and Active View](https://support.google.com/adsense/answer/4510652) (a viewable impression is 50% of pixels for one continuous second — which is why these requirements target placement count and permanent viewability rather than exposure duration).

## ADDED Requirements

### Requirement: Placement Set

The application SHALL define exactly two ad placements, `top` and `bottom`. `top` SHALL sit between the header and the peer discovery area; `bottom` SHALL sit between the peer discovery area and the footer. Neither placement SHALL be a descendant of the peer discovery area, so that neither can scroll out of view within it. Each placement MUST be independently enableable, and MUST issue no ad request and reserve no space while disabled. No further placement SHALL be introduced without a corresponding change to this requirement, because impressions per session equal the number of placements and adding one is a revenue and policy decision, not a layout decision.

#### Scenario: Both placements enabled

- **WHEN** both placements are enabled and clear every suppression condition
- **THEN** the session issues exactly two ad requests, one per placement
- **AND** each placement is within the viewport from first paint until the page is unloaded

#### Scenario: One placement disabled

- **WHEN** `bottom` is disabled and `top` is enabled
- **THEN** only `top` reserves space and issues a request
- **AND** the layout below the peer discovery area is identical to a build with advertising disabled entirely

#### Scenario: Placement is not inside the scrolling area

- **WHEN** the peer discovery area scrolls internally because many peers are present
- **THEN** neither placement moves, scrolls, or leaves the viewport

---

### Requirement: Advertising Never Blocks Application Startup

The ad tag MUST be requested out of band. No application initialization step SHALL await, depend on, or be sequenced behind the ad tag's load, parse, or execution. Application startup MUST reach a fully hydrated, transfer-capable state in the same number of steps and the same order whether the ad tag succeeds, fails, is blocked, or hangs indefinitely.

#### Scenario: Ad domain blocked by an extension or DNS filter

- **WHEN** the ad tag's origin is unreachable and the request fails
- **THEN** application initialization completes and the UI hydrates
- **AND** peer discovery, pairing, drag-and-drop, the file picker, and all transfer dialogs function normally
- **AND** no unhandled rejection or error reaches the application's own error handling

#### Scenario: Ad tag request never settles

- **WHEN** the ad tag request hangs without resolving or rejecting
- **THEN** application initialization completes on its normal timeline
- **AND** no application promise remains pending on account of the ad tag

#### Scenario: Ad tag throws during execution

- **WHEN** the loaded ad tag raises an exception
- **THEN** the exception is contained within the advertising code
- **AND** the application continues operating, including any transfer already in progress

---

### Requirement: Suppression Contexts

Advertising MUST be suppressed — no space reserved, no placement rendered, no ad tag requested — in every context where it must not or cannot serve. Suppression SHALL be determined from local state only, with no network request. Any context that is not positively cleared MUST be treated as suppressed.

The suppressing contexts are: an installed or app-like display mode (`standalone`, `minimal-ui`, `fullscreen`); a webview or in-app browser; absence of network connectivity; a viewport shorter than the small-viewport threshold; a viewport narrower than the narrowest supported ad unit; a placement whose own viewport gate is unmet; and an explicit per-placement or global disable.

#### Scenario: Installed PWA in an app-like display mode

- **WHEN** the application is launched from an installed PWA in `standalone`, `minimal-ui`, or `fullscreen` display mode
- **THEN** no ad tag is requested
- **AND** no placement is rendered and no vertical space is reserved
- **AND** the layout is identical to a build with advertising disabled

#### Scenario: Running inside a webview or in-app browser

- **WHEN** the application is loaded inside a webview or an in-app browser
- **THEN** advertising is suppressed exactly as in the installed-PWA case

#### Scenario: Offline at load

- **WHEN** the application loads while `navigator.onLine` reports no connectivity
- **THEN** no ad tag is requested and no placement is rendered
- **AND** the application functions normally as an offline PWA

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
- **AND** with everything disabled the served application makes no third-party ad request at all

#### Scenario: Detection is inconclusive

- **WHEN** the display mode or browsing context cannot be determined
- **THEN** advertising is suppressed

---

### Requirement: Session-Stable Suppression

Suppression state MUST be decided once per page load and MUST NOT be re-evaluated into a more permissive state during the session. When a viewport change causes a rendered placement to stop meeting its gate, that placement MUST be hidden and its space returned. A suppressed placement MUST NOT be revealed later in the session, and no viewport change SHALL trigger an ad request, because a mid-session request is indistinguishable from a refresh.

#### Scenario: Device rotated from portrait to landscape

- **WHEN** a phone is rotated so the viewport height falls below the small-viewport threshold
- **THEN** the rendered placement is hidden and its space returns to the peer discovery area
- **AND** no ad request is made

#### Scenario: Device rotated from landscape to portrait

- **WHEN** a placement was suppressed at load because the viewport was too small, and the viewport later becomes large enough
- **THEN** the placement remains suppressed for the remainder of the session
- **AND** no ad request is made

#### Scenario: Desktop window resized across a placement's gate

- **WHEN** a desktop window is resized so it no longer meets the `bottom` placement's viewport gate, and is then resized back
- **THEN** the `bottom` placement is hidden when the gate is lost and does not reappear when it is regained
- **AND** no ad request is made in either direction

---

### Requirement: Layout Stability

Placements MUST reserve their exact final dimensions before the application's fade-in sequence begins, and MUST clip content exceeding those dimensions. Reserved dimensions MUST be immune to compression by the surrounding flex layout. Loading an ad into a reserved placement MUST NOT move any surrounding element. Because the document does not scroll, a shift after load displaces the peer discovery canvas and the drop target rather than merely reflowing a document.

#### Scenario: Ad renders into a reserved placement

- **WHEN** a placement has been reserved and its ad subsequently renders
- **THEN** no surrounding element changes position
- **AND** the header, peer discovery area, and footer occupy the same coordinates before and after the ad renders

#### Scenario: Vertical space is contended

- **WHEN** the combined height of the header, placements, and footer approaches the viewport height
- **THEN** each placement retains its exact declared dimensions
- **AND** the peer discovery area absorbs the remaining space

#### Scenario: Creative exceeds its declared size

- **WHEN** a returned creative renders larger than the placement's declared dimensions
- **THEN** the overflow is clipped by the placement container
- **AND** no surrounding element is displaced and the document gains no scrollbar

#### Scenario: Reservation precedes visibility

- **WHEN** the application performs its fade-in sequence
- **THEN** placement geometry is already final
- **AND** the user never observes a placement appearing, resizing, or displacing content during fade-in

---

### Requirement: No-Fill Collapse

A placement that receives no ad MUST collapse and return its space to the layout. Collapse SHALL be triggered both by an explicit unfilled signal from the ad tag and by the absence of any fill signal within a bounded interval, which MUST NOT exceed 5 seconds after the request. The interval-based path MUST be sufficient on its own, so that collapse remains correct if the ad tag's fill signal changes or disappears. A collapsed placement MUST leave no visible empty region and MUST surface no error to the user.

#### Scenario: Ad tag reports no fill

- **WHEN** the ad tag marks a placement as unfilled
- **THEN** the placement collapses and its space returns to the peer discovery area
- **AND** no empty rectangle, border, or label remains visible

#### Scenario: No fill signal ever arrives

- **WHEN** a reserved placement receives no fill signal within the bounded interval after its request
- **THEN** the placement collapses on the same path as an explicit no-fill
- **AND** no further ad request is made for that placement

#### Scenario: Fill signal mechanism is unavailable

- **WHEN** the ad tag never emits a recognizable fill signal for any placement
- **THEN** every unfilled placement still collapses within the bounded interval
- **AND** filled placements are unaffected

#### Scenario: Collapse is a single reflow

- **WHEN** a placement collapses
- **THEN** the layout settles once and does not oscillate between reserved and collapsed states for the remainder of the session

---

### Requirement: Drag-and-Drop Transparency

While a drag is in progress anywhere in the document, placements MUST NOT be hit-testable. A file or text dropped over a placement MUST reach the application's existing window-level drop handler. Under no circumstance may a drop cause the browser to navigate away from the application. Placements MUST become hit-testable again once the drag ends, including when the drag ends without a corresponding leave event.

#### Scenario: File dropped directly onto a placement

- **WHEN** a user drags a file over the page and releases it over a placement
- **THEN** the application's drop handler receives the file and the normal send flow begins
- **AND** the browser does not navigate to the dropped file
- **AND** the session, including any transfer in progress, is preserved

#### Scenario: Drag passes over a placement en route to the canvas

- **WHEN** a dragged file crosses a placement before being released on the peer discovery area
- **THEN** the drop-target highlight behaves exactly as it does with advertising suppressed

#### Scenario: Drag abandoned without a leave event

- **WHEN** a drag is abandoned outside the window, or ends without a `dragleave` being observed
- **THEN** placements return to being hit-testable
- **AND** ads remain clickable for the remainder of the session

---

### Requirement: Placement Delineation

Each placement MUST be visually distinguishable from application UI and MUST maintain a minimum separation from interactive controls. Each placement SHALL carry an "Advertisement" label sourced from the translation files rather than inline markup. Placements MUST NOT overlay, obscure, or intercept interaction with the peer discovery area, the drop target, the file picker, transfer request, progress, or completion dialogs, or any header or footer control. Placements MUST NOT trap keyboard focus.

#### Scenario: Placement adjacent to header controls

- **WHEN** the `top` placement renders below the header
- **THEN** it is separated from the header's interactive controls by at least the minimum separation
- **AND** it does not overlap the pair-device, join-room, theme, install, or about controls

#### Scenario: Transfer dialog opens over a placement

- **WHEN** a transfer request, progress, or completion dialog is displayed
- **THEN** the dialog renders above every placement
- **AND** every control in the dialog remains reachable and clickable

#### Scenario: Keyboard traversal past a placement

- **WHEN** a keyboard user tabs from the header towards the peer discovery area
- **THEN** focus advances past the placement and reaches the application's own controls
- **AND** focus is never trapped inside a placement

#### Scenario: Label is localized

- **WHEN** the interface is displayed in a locale with no translation for the advertisement label
- **THEN** the English label is shown as a fallback
- **AND** no untranslated key or empty label is rendered

#### Scenario: Dark theme active

- **WHEN** the dark theme is active
- **THEN** placement chrome follows the active theme
- **AND** no bright rectangle is introduced around the placement

---

### Requirement: No Automatic Ad Refresh

The application MUST NOT re-request an ad for a placement that has already been requested. No timer, viewability signal, visibility change, connectivity change, viewport change, transfer event, or other automatic trigger SHALL cause an additional ad request within a page load. Exactly one ad request MUST be made per enabled placement per page load.

#### Scenario: Long session with no interaction

- **WHEN** the page remains open for the duration of a typical multi-minute session
- **THEN** each enabled placement has issued exactly one ad request
- **AND** no additional ad request is made regardless of elapsed time

#### Scenario: Tab backgrounded and restored

- **WHEN** the tab is hidden and later becomes visible again
- **THEN** no ad request is made
- **AND** no placement changes size or position

#### Scenario: Connectivity lost and restored mid-session

- **WHEN** the network drops and later returns while the page stays open
- **THEN** no ad request is made for any placement
- **AND** the transfer flow's own reconnection behaviour is unaffected

#### Scenario: Transfer starts and completes

- **WHEN** a file transfer begins, progresses, and completes
- **THEN** no ad request is made at any point in the transfer lifecycle

#### Scenario: Application opened in a second tab

- **WHEN** the application is opened in a second tab while the first remains open
- **THEN** each tab is treated as an independent page load and requests its own ads
- **AND** neither tab causes an additional request in the other

---

### Requirement: Consent For Regulated Regions

Personalized advertising MUST NOT be served to visitors in the EEA, the UK, or Switzerland without a valid consent signal from a Google-certified consent management platform integrated with IAB TCF v2.2. The application MUST NOT implement its own consent collection, storage, or signal handling. Consent collection MUST NOT prevent the visitor from discovering peers, sending, or receiving files, and MUST NOT precede the application's first paint.

#### Scenario: Visitor in a consent-required region

- **WHEN** a visitor subject to a consent requirement loads the application
- **THEN** the application renders and becomes usable before any consent interface appears
- **AND** no personalized ad request is made before a consent decision is recorded
- **AND** the peer discovery area, drop target, and transfer controls remain reachable while the consent interface is displayed

#### Scenario: Consent denied

- **WHEN** a visitor declines consent for personalized advertising
- **THEN** only non-personalized ads are requested, or no ads are requested
- **AND** the application remains fully functional

#### Scenario: Consent interface fails to load

- **WHEN** the consent interface is blocked or fails to load
- **THEN** no personalized ad request is made
- **AND** application startup and the transfer flow are unaffected

---

### Requirement: Publisher Declaration

The deployment MUST serve an `ads.txt` file at the origin root declaring the publisher account authorized to sell its inventory. The file MUST be served from the network and MUST NOT be precached by the service worker, since it is crawled by the ad provider rather than fetched by the application.

#### Scenario: Crawler requests the declaration

- **WHEN** `/ads.txt` is requested at the origin root
- **THEN** it is served with a 200 response
- **AND** it authorizes the publisher account used by the application's ad tag

#### Scenario: Declaration is excluded from the precached shell

- **WHEN** the service worker installs and precaches the application shell
- **THEN** `ads.txt` is not among the precached assets
- **AND** a request for it is passed through to the network

---

### Requirement: Offline And Shell Integrity

Advertising MUST NOT compromise the application's ability to run offline as an installed PWA. Client assets added for advertising MUST be precached with the rest of the shell and MUST force a service worker cache version change, so returning visitors receive a shell whose markup and assets match.

#### Scenario: Installed PWA used offline

- **WHEN** the installed application is opened with no network connectivity
- **THEN** it loads and operates normally from the precached shell
- **AND** no placement is rendered and no ad request is attempted

#### Scenario: Returning visitor after deployment

- **WHEN** a visitor holding a previously cached shell returns after this change is deployed
- **THEN** the service worker installs the new cache version
- **AND** the visitor receives markup and advertising assets from the same shell revision, with no missing or stale asset
