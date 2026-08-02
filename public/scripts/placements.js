// Advertising for the snap-drop.net deployment.
//
// Two rules shape everything below:
//   1. Nothing here may delay, block or break application startup or a transfer.
//      The tag is injected out of band and no application promise ever depends on it.
//   2. Exactly one ad request per enabled placement per page load. AdSense forbids
//      refreshing an ad the user did not ask to refresh.
//
// On the filename: this module and its stylesheet are named for what they manage
// rather than for advertising, because they are same-origin and precached. Filter
// lists match same-origin paths containing `ad-manager` or `ads.css`, and a blocked
// entry in `relativePathsToCache` rejects the whole atomic `cache.addAll()` - the
// service worker never installs and the PWA loses offline support entirely. This is
// not ad-block evasion: the ad network request, the `adsbygoogle` class and the
// `ad-*` element ids are all left intact and blockable, so a blocker still removes
// every ad. Only the application shell is kept out of the blast radius.
//
// Publisher and slot identifiers are committed deliberately: they are public by
// construction, appearing in served page source and in /ads.txt.
const AD_CONFIG = {
    // Kill switch. While false nothing is revealed, injected or requested,
    // whatever the per-placement flags say. Rollout order is: land disabled,
    // enable `top`, establish a session-RPM baseline, then enable `bottom`.
    enabled: false,

    // Matches the authorization line in public/ads.txt.
    publisherId: 'ca-pub-7669832766470834',

    placements: [
        {
            name: 'top',
            enabled: false,
            slotId: '0000000000', // TODO(adsense): 320x50 fixed-size display unit
            width: 320,
            height: 50,
            // Byte-identical to the matching @media condition in styles/placements.css,
            // so CSS and JS can never disagree about whether a placement fits.
            viewportQuery: '(min-width: 320px) and (min-height: 480px)'
        },
        {
            name: 'bottom',
            enabled: false,
            slotId: '0000000000', // TODO(adsense): 728x90 fixed-size display unit
            width: 728,
            height: 90,
            viewportQuery: '(min-width: 1024px) and (min-height: 800px)'
        }
    ]
};

// Enabling a placement that still carries the placeholder slot guarantees no fill.
// Treat it as a misconfiguration and suppress rather than request into nothing.
const AD_PLACEHOLDER_SLOT = '0000000000';

// Floor below which no placement serves: narrower than the narrowest standard
// unit, or too short to yield the space without squeezing the peer canvas.
const AD_VIEWPORT_FLOOR_QUERY = '(min-width: 320px) and (min-height: 480px)';

const AD_TAG_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

// Collapse anything not confirmed filled by this point after its request. This is
// the guarantee, not the fallback - see _observeFill().
const AD_COLLAPSE_TIMEOUT = 5000;

// Separate, far looser deadline for a placement that reserved space but was never
// requested at all, because load() was never reached.
//
// Deliberately generous. load() sits behind loadDeferredAssets(), which fetches
// ~1.6MB uncompressed - heic2any.min.js alone is 1.3MB - so a first visit on a slow
// connection can take tens of seconds to reach it. Firing early costs the ad
// outright: the placements are already retired by the time load() runs, so no tag
// is even injected. The case this bounds is one where hydrate() never happens at
// all, which means the app is broken regardless and a lingering transparent box is
// the least of it. Given that asymmetry, err long.
const AD_RESERVE_WATCHDOG = 60000;

// The HTML drag-and-drop model runs its iteration at least every 350ms, so a
// stationary pointer still produces `dragover` on that cadence. The idle timer
// must clear that interval or placements become hit-testable mid-drag.
const AD_DRAG_IDLE_TIMEOUT = 500;

const AD_VIEWPORT_DEBOUNCE = 200;

// Placement lifecycle. `suppressed` is decided before anything renders; `collapsed`
// and `hidden` are terminal, which is what stops the layout oscillating.
const AD_STATE = {
    SUPPRESSED: 'suppressed', // never rendered, never requested
    RESERVED: 'reserved',     // space held, request not yet made
    REQUESTED: 'requested',   // request made, fill unknown
    FILLED: 'filled',         // ad rendered
    COLLAPSED: 'collapsed',   // no fill, space returned
    HIDDEN: 'hidden'          // rendered, then lost its viewport gate
};

const AD_LIVE_STATES = [AD_STATE.RESERVED, AD_STATE.REQUESTED, AD_STATE.FILLED];

class AdManager {

    constructor() {
        this._tagInjected = false;
        this._dragActive = false;
        this._dragIdleTimer = null;
        this._viewportTimer = null;

        this._placements = AD_CONFIG.placements.map(config => {
            const $el = $(`ad-${config.name}`);
            return {
                config: config,
                $el: $el,
                $ins: $el ? $el.querySelector('ins.adsbygoogle') : null,
                state: AD_STATE.SUPPRESSED,
                requested: false,
                observer: null,
                timer: null,
                watchdog: null
            };
        });
    }

    /**
     * Synchronous, local-only, and runs before the fade-in sequence so placement
     * geometry is final before anything is visible. Touches no network and loads
     * no third-party code.
     */
    reserve() {
        try {
            this._reserve();
        }
        catch (e) {
            // Contained here rather than at the call site: this runs inside PairDrop's
            // constructor, so an escaping exception takes the whole application down.
            console.warn('Advertising: reserve failed, continuing without ads.', e);
        }
        finally {
            // Bound out here so a throw part-way through _reserve() cannot leave an
            // already-revealed placement live but hit-testable during a drag - a file
            // released on it would navigate the tab away. Caught again because a
            // `finally` escapes the catch above, and nothing in this module may throw
            // out of PairDrop's constructor.
            try {
                if (this._placements.some(placement => placement.state === AD_STATE.RESERVED)) {
                    this._bindDragTransparency();
                    this._bindViewportWatch();
                }
            }
            catch (e) {
                console.warn('Advertising: could not bind placement listeners.', e);
            }
        }
    }

    _reserve() {
        const permitted = this._advertisingPermitted();

        for (const placement of this._placements) {
            const clears = permitted
                && !!placement.$el
                && !!placement.$ins
                && placement.config.enabled
                && placement.config.slotId !== AD_PLACEHOLDER_SLOT
                && this._viewportClears(placement);

            if (!clears) {
                this._retire(placement, AD_STATE.SUPPRESSED);
                continue;
            }

            // Config is the single source of truth for identifiers and dimensions;
            // the markup carries them only because that is how AdSense documents the
            // snippet. The container height in placements.css is the label block plus
            // the unit height, so these three numbers move together or not at all.
            placement.$ins.setAttribute('data-ad-client', AD_CONFIG.publisherId);
            placement.$ins.setAttribute('data-ad-slot', placement.config.slotId);
            placement.$ins.style.width = `${placement.config.width}px`;
            placement.$ins.style.height = `${placement.config.height}px`;

            // `hidden` is the default-hidden mechanism rather than CSS alone, so the
            // containers stay collapsed even if placements.css is the asset that fails
            // to load. Removed here; the media-gated `.ad-placement-visible` rule is an
            // author rule and outranks the UA sheet's [hidden] either way.
            placement.$el.classList.add('ad-placement-visible');
            placement.$el.removeAttribute('hidden');
            placement.state = AD_STATE.RESERVED;

            // A placement must not hold its space forever if load() is never reached:
            // loadDeferredAssets() never settles when a script 404s, so hydrate() and
            // load() never run.
            placement.watchdog = setTimeout(_ => {
                if (!placement.requested) this._collapse(placement);
            }, AD_RESERVE_WATCHDOG);
        }
    }

    /**
     * Injects the tag and requests one ad per reserved placement.
     *
     * Returns nothing, deliberately. No caller may await advertising: startup must
     * reach a transfer-capable state on the same timeline whether the tag succeeds,
     * fails, is blocked, or hangs forever.
     */
    load() {
        try {
            // Seconds pass between reserve() and here while deferred assets load. A
            // window resized below a gate in that time must not be requested into:
            // the CSS gate has already hidden it, and the request would be billed for
            // an ad nobody can see.
            this._evaluateViewport();

            const reserved = this._placements.filter(placement => placement.state === AD_STATE.RESERVED);
            if (!reserved.length) return;

            this._injectTag();

            for (const placement of reserved) {
                this._request(placement);
            }
        }
        catch (e) {
            console.warn('Advertising: load failed, continuing without ads.', e);
        }
    }

    // Suppression - evaluated once, from local state only, failing closed.

    _advertisingPermitted() {
        try {
            if (!AD_CONFIG.enabled) return false;
            if (typeof window.matchMedia !== 'function') return false;
            if (this._isAppLikeDisplayMode()) return false;
            if (this._isWebview()) return false;
            if (navigator.onLine === false) return false;
            return window.matchMedia(AD_VIEWPORT_FLOOR_QUERY).matches;
        }
        catch (e) {
            // A context that cannot be positively cleared is a suppressed context.
            return false;
        }
    }

    _isAppLikeDisplayMode() {
        // iOS reports an installed home-screen app here rather than via display-mode.
        if (navigator.standalone === true) return true;

        return ['standalone', 'minimal-ui', 'fullscreen']
            .some(mode => window.matchMedia(`(display-mode: ${mode})`).matches);
    }

    _isWebview() {
        const ua = navigator.userAgent;

        // No user agent means no decision, and no decision means suppressed.
        if (!ua) return true;

        // Android WebView, and the in-app browsers that embed one.
        if (/;\s*wv[;)]/.test(ua)) return true;
        if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|WhatsApp|Snapchat|TikTok|Twitter|LinkedInApp|Pinterest|GSA\//.test(ua)) return true;

        // iOS in-app browsers are WKWebViews and drop "Safari" from the UA;
        // real iOS browsers keep it or identify themselves explicitly.
        const isIos = /iPad|iPhone|iPod/.test(ua)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        return isIos && !/Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    }

    _viewportClears(placement) {
        return window.matchMedia(placement.config.viewportQuery).matches;
    }

    // Requesting

    _injectTag() {
        if (this._tagInjected) return;
        this._tagInjected = true;

        // This is also Google's Auto ads snippet: with Auto ads switched on for the
        // site, Google injects its own units - including anchor and vignette formats
        // that position: fixed and therefore escape the container's overflow clip.
        // Nothing in this file can prevent that. Auto ads MUST stay off for
        // snap-drop.net in the AdSense dashboard; it is a verification step, not an
        // assumption.
        const script = document.createElement('script');
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.src = `${AD_TAG_SRC}?client=${encodeURIComponent(AD_CONFIG.publisherId)}`;
        // Logged, never rethrown, never awaited. A blocked tag is a normal outcome.
        script.onerror = _ => console.warn('Advertising: tag unavailable.');

        document.head.appendChild(script);
    }

    _request(placement) {
        // ONE request per placement per page load, and this guard is the only thing
        // enforcing it. AdSense treats an unrequested re-request as a refresh, which
        // is a policy violation on this account.
        //
        // Nothing may call _request() a second time for a placement: not the collapse
        // timer, not the viewport handler, not a visibility, connectivity, Events or
        // transfer hook added later. If you are adding such a caller, the answer is no.
        if (placement.requested) return;
        placement.requested = true;
        placement.state = AD_STATE.REQUESTED;

        clearTimeout(placement.watchdog);
        placement.watchdog = null;

        this._observeFill(placement);

        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
        catch (e) {
            console.warn('Advertising: request failed.', e);
            this._collapse(placement);
            return;
        }

        // Measured from the request, which is what the 5s bound is defined against.
        placement.timer = setTimeout(_ => this._onDeadline(placement), AD_COLLAPSE_TIMEOUT);
    }

    // Fill detection

    _observeFill(placement) {
        // Fast path only. `data-ad-status` is widely relied upon but undocumented,
        // so the deadline armed in _request() - not this observer - is what guarantees
        // an unfilled placement collapses. Deleting this method costs latency, not
        // correctness.
        if (typeof MutationObserver !== 'function') return;

        placement.observer = new MutationObserver(_ => {
            const status = placement.$ins.getAttribute('data-ad-status');

            // Stays connected after a fill: a placement that reports filled and later
            // unfilled must still give its space back rather than keep an empty box.
            if (status === 'filled') this._fill(placement);
            else if (status === 'unfilled') this._collapse(placement);
        });

        placement.observer.observe(placement.$ins, {
            attributes: true,
            attributeFilter: ['data-ad-status']
        });
    }

    _onDeadline(placement) {
        // The deadline never collapses a confirmed fill - only the explicit unfilled
        // signal does, via _collapse().
        if (placement.state === AD_STATE.FILLED) return;

        this._collapse(placement);
    }

    _fill(placement) {
        if (placement.state !== AD_STATE.REQUESTED) return;

        placement.state = AD_STATE.FILLED;
        clearTimeout(placement.timer);
        placement.timer = null;
    }

    _collapse(placement) {
        if (!AD_LIVE_STATES.includes(placement.state)) return;

        this._retire(placement, AD_STATE.COLLAPSED);
    }

    /**
     * Terminal for a placement: detach it, stop watching it, and give its space back.
     *
     * Detaching rather than hiding is load-bearing in two ways. `adsbygoogle.push()`
     * carries no element reference and binds to the next unrequested
     * `<ins class="adsbygoogle">` in document order, so a suppressed placement left in
     * the DOM would capture the request meant for the one below it. And a response
     * arriving after the collapse deadline would otherwise render a creative into a
     * hidden container - a billed impression nobody can see.
     */
    _retire(placement, state) {
        placement.state = state;

        clearTimeout(placement.timer);
        clearTimeout(placement.watchdog);
        placement.timer = null;
        placement.watchdog = null;

        if (placement.observer) {
            placement.observer.disconnect();
            placement.observer = null;
        }

        if (placement.$el && placement.$el.parentNode) {
            placement.$el.parentNode.removeChild(placement.$el);
        }
    }

    // Drag transparency

    _bindDragTransparency() {
        Events.on('dragenter', _ => this._onDragActivity());
        Events.on('dragover', _ => this._onDragActivity());
        Events.on('drop', _ => this._endDrag());
        Events.on('dragend', _ => this._endDrag());
    }

    _onDragActivity() {
        if (!this._dragActive) {
            this._dragActive = true;
            document.body.classList.add('ad-drag-active');
        }

        // `dragleave` on window is unreliable when the pointer crosses between
        // elements, so this idle timer, not the leave event, is what restores hit
        // testing. Without it an abandoned drag leaves ads permanently unclickable.
        clearTimeout(this._dragIdleTimer);
        this._dragIdleTimer = setTimeout(_ => this._endDrag(), AD_DRAG_IDLE_TIMEOUT);
    }

    _endDrag() {
        clearTimeout(this._dragIdleTimer);
        this._dragIdleTimer = null;

        if (!this._dragActive) return;

        this._dragActive = false;
        document.body.classList.remove('ad-drag-active');
    }

    // Session-stable suppression

    _bindViewportWatch() {
        const onViewportChange = _ => {
            clearTimeout(this._viewportTimer);
            this._viewportTimer = setTimeout(_ => this._evaluateViewport(), AD_VIEWPORT_DEBOUNCE);
        };

        Events.on('resize', onViewportChange);
        Events.on('orientationchange', onViewportChange);
    }

    _evaluateViewport() {
        for (const placement of this._placements) {
            // A placement is only ever taken away here, never granted. Revealing one
            // mid-session would mean a second ad request, which is indistinguishable
            // from a refresh.
            if (!AD_LIVE_STATES.includes(placement.state)) continue;
            if (this._viewportClears(placement)) continue;

            this._retire(placement, AD_STATE.HIDDEN);
        }
    }
}
