## MODIFIED Requirements

### Requirement: AdSense Verification Snippet

The application shell SHALL carry exactly one non-executable Google AdSense account meta tag as static markup inside `<head>` on every page load. Its publisher ID MUST match the authorization in `ads.txt` and the gated placement configuration. The metadata MUST NOT depend on JavaScript, viewport, placement settings, display mode, or connectivity. It MUST NOT load an advertising library or issue a network request. The unconditional advertising-script verification method is superseded.

No placement SHALL be enabled without provider approval for the actual site and inventory, verified applicable consent handling, real identifiers, and automatic placements disabled. The metadata SHALL NOT be represented as approval or consent. The privacy policy MUST be live and reachable before any future advertising integration is enabled.

#### Scenario: Snippet present in the served document

- **WHEN** the root, index alias or index.html is fetched without executing JavaScript
- **THEN** exactly one account meta tag is present in the head with the matching publisher ID
- **AND** no unconditional advertising script is included

#### Scenario: Verification does not resurrect ad behavior

- **WHEN** the disabled application loads
- **THEN** ownership metadata remains visible to crawlers without contacting an advertising network
- **AND** no advertising slot renders or reserves space

#### Scenario: Advertising hosts are unavailable

- **WHEN** Google advertising hosts are blocked, unreachable or hanging
- **THEN** disabled application startup and transfer behavior have no dependency on those hosts

#### Scenario: Ordering against the privacy policy

- **WHEN** advertising is enabled in a later deployment
- **THEN** `/privacy` already describes that actual enabled integration and its data handling
- **AND** the required consent behavior has been verified

#### Scenario: Installed PWA remains suppressed

- **WHEN** the current shell is loaded from its service-worker cache in app-like mode
- **THEN** passive verification remains in the document without an ad script or request
- **AND** the offline shell behavior is unchanged

### Requirement: Advertising Disclosure Reflects the Current Integration

The privacy page MUST accurately distinguish non-executable ownership verification from advertising-script execution. For the disabled build it SHALL state that advertising is disabled and that the verification metadata and `ads.txt` do not load Google's advertising library. Future advertising data handling and consent prerequisites MUST be conditional and MUST NOT assert that a missing warning proves working consent. About MUST NOT imply current advertising income when monetization has not been approved and activated.

#### Scenario: Disabled build with passive verification

- **WHEN** a visitor reads the privacy policy before ads are enabled
- **THEN** it describes the current lack of advertising-script loading and the future activation prerequisites
- **AND** it does not claim the CMP has never been configured or that advertising already funds the service
