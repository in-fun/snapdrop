import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const productionOrigin = 'https://www.snap-drop.net';
const failures = [];
let checkCount = 0;

const contentPages = [
    { name: 'about', file: 'public/about.html', path: '/about' },
    { name: 'how-it-works', file: 'public/how-it-works.html', path: '/how-it-works' },
    { name: 'faq', file: 'public/faq.html', path: '/faq' },
    { name: 'privacy', file: 'public/privacy.html', path: '/privacy' },
    { name: 'terms', file: 'public/terms.html', path: '/terms' }
];

const requiredFaqSections = [
    'getting-started',
    'files-and-downloads',
    'troubleshooting',
    'privacy-and-security'
];

const requiredFaqQuestions = [
    'what-do-i-need',
    'how-do-i-send',
    'same-network',
    'pairing-versus-room',
    'install-required',
    'file-types',
    'file-size',
    'transfer-speed',
    'where-files-go',
    'metadata',
    'resume',
    'device-not-visible',
    'transfer-will-not-connect',
    'transfer-stops',
    'mobile-limit',
    'background-transfer',
    'uploaded-or-stored',
    'encryption',
    'server-data',
    'safe-sharing'
];

function read(relativePath) {
    return readFileSync(resolve(repositoryRoot, relativePath), 'utf8');
}

function verify(condition, message) {
    checkCount += 1;
    if (!condition) failures.push(message);
}

function attribute(tag, name) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = tag.match(new RegExp(`\\b${escapedName}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
    return match ? match[2] : null;
}

function openingTags(html, tagName) {
    return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))].map(match => match[0]);
}

function anchors(html) {
    return [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].map(match => {
        const markup = match[0];
        const openingTag = markup.match(/^<a\b[^>]*>/i)[0];
        const innerHtml = markup.replace(/^<a\b[^>]*>/i, '').replace(/<\/a>$/i, '');
        return {
            tag: openingTag,
            href: attribute(openingTag, 'href'),
            text: textContent(innerHtml)
        };
    });
}

function textContent(html) {
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

function navigationMarkup(html) {
    const navigations = [...html.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi)];
    return navigations.length ? navigations[navigations.length - 1][0] : '';
}

function internalPath(href, pagePath) {
    if (!href || href.startsWith('#')) return null;
    try {
        const url = new URL(href, `${productionOrigin}${pagePath}`);
        return url.origin === productionOrigin ? url.pathname : null;
    } catch {
        return null;
    }
}

function verifyMetadata(label, html, expectedCanonical) {
    const titleMatches = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)];
    const descriptionTags = openingTags(html, 'meta').filter(tag =>
        (attribute(tag, 'name') || '').toLowerCase() === 'description'
    );
    const canonicalTags = openingTags(html, 'link').filter(tag =>
        (attribute(tag, 'rel') || '').toLowerCase().split(/\s+/).includes('canonical')
    );

    verify(titleMatches.length === 1 && textContent(titleMatches[0][1]).length > 0,
        `${label}: expected one non-empty title`);
    verify(descriptionTags.length === 1 && (attribute(descriptionTags[0], 'content') || '').trim().length > 0,
        `${label}: expected one non-empty meta description`);
    verify(canonicalTags.length === 1 && attribute(canonicalTags[0], 'href') === expectedCanonical,
        `${label}: expected canonical ${expectedCanonical}`);
}

function verifyContentNavigation(page, html) {
    const navigation = navigationMarkup(html);
    const paths = anchors(navigation)
        .map(anchor => internalPath(anchor.href, page.path))
        .filter(Boolean);
    const expectedPaths = ['/', ...contentPages.filter(candidate => candidate.path !== page.path)
        .map(candidate => candidate.path)];

    verify(Boolean(navigation), `${page.name}: expected a site navigation element`);
    for (const expectedPath of expectedPaths) {
        verify(paths.includes(expectedPath), `${page.name}: site navigation is missing ${expectedPath}`);
    }
}

function arrayStringValues(source, variableName) {
    const escapedName = variableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = source.match(new RegExp(`const\\s+${escapedName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;?`));
    if (!match) return null;

    const withoutComments = match[1]
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\r\n]*/g, '');
    return [...withoutComments.matchAll(/(["'])([^"']+)\1/g)].map(item => item[2]);
}

const pageHtml = new Map(contentPages.map(page => [page.name, read(page.file)]));

for (const page of contentPages) {
    const html = pageHtml.get(page.name);
    verifyMetadata(page.name, html, `${productionOrigin}${page.path}`);
    verify(/<html\b[^>]*\blang=["']en["']/i.test(html), `${page.name}: expected html lang="en"`);
    verify(!/<script\b/i.test(html), `${page.name}: content pages must not load scripts`);
    verify(/<footer\b[^>]*>\s*This page is available in English only\.\s*<\/footer>/i.test(html),
        `${page.name}: expected the English-only notice`);
    verifyContentNavigation(page, html);
}

const notFoundHtml = read('public/404.html');
const notFoundCanonicalTags = openingTags(notFoundHtml, 'link').filter(tag =>
    (attribute(tag, 'rel') || '').toLowerCase().split(/\s+/).includes('canonical')
);
const notFoundRobotsTags = openingTags(notFoundHtml, 'meta').filter(tag =>
    (attribute(tag, 'name') || '').toLowerCase() === 'robots'
);
const notFoundNavigation = navigationMarkup(notFoundHtml);
const notFoundAnchors = anchors(notFoundNavigation);
const notFoundPaths = notFoundAnchors.map(anchor => internalPath(anchor.href, '/missing/example')).filter(Boolean);

verifyMetadata('index', read('public/index.html'), `${productionOrigin}/`);
verify(/<title\b[^>]*>[\s\S]*?<\/title>/i.test(notFoundHtml), '404: expected a title');
verify(openingTags(notFoundHtml, 'meta').some(tag =>
    (attribute(tag, 'name') || '').toLowerCase() === 'description' &&
    (attribute(tag, 'content') || '').trim().length > 0
), '404: expected a non-empty meta description');
verify(notFoundCanonicalTags.length === 0, '404: must not declare a canonical URL');
verify(notFoundRobotsTags.length === 1 && /(?:^|\s|,)noindex(?:$|\s|,)/i.test(attribute(notFoundRobotsTags[0], 'content') || ''),
    '404: expected one noindex robots directive');
verify(!/<script\b/i.test(notFoundHtml), '404: recovery page must not load scripts');
verify(/<footer\b[^>]*>\s*This page is available in English only\.\s*<\/footer>/i.test(notFoundHtml),
    '404: expected the English-only notice');
verify(Boolean(notFoundNavigation), '404: expected a site navigation element');
for (const expectedPath of ['/', ...contentPages.map(page => page.path)]) {
    verify(notFoundPaths.includes(expectedPath), `404: site navigation is missing ${expectedPath}`);
}
verify(notFoundAnchors.every(anchor => !anchor.href || anchor.href.startsWith('/')),
    '404: all recovery navigation links must be root-absolute');

const faqHtml = pageHtml.get('faq');
const faqIds = openingTags(faqHtml, '[a-z][a-z0-9-]*')
    .map(tag => attribute(tag, 'id'))
    .filter(Boolean);
verify(new Set(faqIds).size === faqIds.length, 'faq: every fragment id must be unique');
for (const id of requiredFaqSections) {
    verify(faqIds.includes(id), `faq: missing required section fragment #${id}`);
    verify(anchors(faqHtml).some(anchor => anchor.href === `#${id}`),
        `faq: contents list is missing #${id}`);
}
for (const id of requiredFaqQuestions) {
    verify(faqIds.includes(id), `faq: missing required question fragment #${id}`);
}

const faqText = textContent(faqHtml);
const accuracyPhrases = [
    [/no TURN relay/i, 'no TURN relay'],
    [/no WebSocket file-transfer fallback/i, 'no WebSocket file-transfer fallback'],
    [/200 MiB/i, 'the iOS 200 MiB boundary'],
    [/\bDTLS\b/i, 'DTLS transport encryption'],
    [/authorized to (?:share|distribute)/i, 'authorized-use guidance']
];
for (const [pattern, label] of accuracyPhrases) {
    verify(pattern.test(faqText), `faq: missing deployment-accurate wording for ${label}`);
}
const faqLinkedPaths = anchors(faqHtml)
    .map(anchor => internalPath(anchor.href, '/faq'))
    .filter(Boolean);
for (const expectedPath of ['/how-it-works', '/privacy', '/terms']) {
    verify(faqLinkedPaths.includes(expectedPath), `faq: expected an authoritative link to ${expectedPath}`);
}

const indexHtml = read('public/index.html');
const siteLinksNavigation = [...indexHtml.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi)]
    .map(match => match[0])
    .find(navigation => openingTags(navigation, 'nav').some(tag =>
        (attribute(tag, 'class') || '').split(/\s+/).includes('site-links')
    ));
const siteLinkAnchors = anchors(siteLinksNavigation || '');
const footerPaths = siteLinkAnchors.map(anchor => internalPath(anchor.href, '/')).filter(Boolean);
for (const expectedPath of contentPages.map(page => page.path)) {
    verify(footerPaths.includes(expectedPath), `index: crawler-visible footer is missing ${expectedPath}`);
}
const footerFaqAnchor = siteLinkAnchors.find(anchor =>
    attribute(anchor.tag, 'data-i18n-key') === 'footer.site-faq'
);
verify(Boolean(footerFaqAnchor), 'index: expected footer.site-faq localization wiring');
verify(footerFaqAnchor?.href === '/faq', 'index: FAQ footer link must target /faq');
verify(footerFaqAnchor?.text === 'FAQ', 'index: FAQ footer link must contain literal text "FAQ"');
verify((attribute(footerFaqAnchor?.tag || '', 'data-i18n-attrs') || '').split(/\s+/).includes('text'),
    'index: FAQ footer localization must replace its text');

let englishLocale = null;
try {
    englishLocale = JSON.parse(read('public/lang/en.json'));
} catch (error) {
    failures.push(`lang/en.json: invalid JSON (${error.message})`);
}
verify(englishLocale?.footer?.['site-faq'] === 'FAQ', 'lang/en.json: footer.site-faq must equal "FAQ"');

const sitemapHtml = read('public/sitemap.xml');
const sitemapLocations = [...sitemapHtml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map(match => match[1]);
const expectedSitemapLocations = [
    `${productionOrigin}/`,
    ...contentPages.map(page => `${productionOrigin}${page.path}`)
];
verify(sitemapLocations.length === expectedSitemapLocations.length,
    `sitemap: expected exactly ${expectedSitemapLocations.length} URLs, found ${sitemapLocations.length}`);
for (const location of expectedSitemapLocations) {
    verify(sitemapLocations.filter(candidate => candidate === location).length === 1,
        `sitemap: expected ${location} exactly once`);
}

const serviceWorker = read('public/service-worker.js');
const precachePaths = arrayStringValues(serviceWorker, 'relativePathsToCache');
const noCachePaths = arrayStringValues(serviceWorker, 'relativePathsNotToCache');
verify(Array.isArray(precachePaths), 'service worker: could not parse relativePathsToCache');
verify(Array.isArray(noCachePaths), 'service worker: could not parse relativePathsNotToCache');
for (const alias of ['faq', 'faq.html']) {
    verify((noCachePaths || []).filter(path => path === alias).length === 1,
        `service worker: expected ${alias} exactly once in relativePathsNotToCache`);
    verify(!(precachePaths || []).includes(alias),
        `service worker: ${alias} must stay out of relativePathsToCache`);
}
verify(!(precachePaths || []).includes('sitemap.xml'),
    'service worker: sitemap.xml must stay out of relativePathsToCache');
const cacheVersionDeclarations = [...serviceWorker.matchAll(/\bconst\s+cacheVersion\s*=\s*(["'])([^"']+)\1/g)];
verify(cacheVersionDeclarations.length === 1 && cacheVersionDeclarations[0][2] === 'v1.11.2-sd.5',
    'service worker: expected the single integration cache bump to v1.11.2-sd.5');

const placements = read('public/scripts/placements.js');
const adConfigMatch = placements.match(/\bconst\s+AD_CONFIG\s*=\s*\{([\s\S]*?)\n\};/);
verify(Boolean(adConfigMatch), 'advertising: could not parse AD_CONFIG');
const adConfig = adConfigMatch ? adConfigMatch[1] : '';
const disabledFlags = [...adConfig.matchAll(/\benabled\s*:\s*false\b/g)];
const enabledFlags = [...adConfig.matchAll(/\benabled\s*:\s*true\b/g)];
const slotIds = [...adConfig.matchAll(/\bslotId\s*:\s*(["'])([^"']+)\1/g)].map(match => match[2]);
verify(disabledFlags.length === 3 && enabledFlags.length === 0,
    'advertising: global and both placement flags must remain disabled');
verify(slotIds.length === 2 && slotIds.every(slotId => slotId === '0000000000'),
    'advertising: both placement slot IDs must remain placeholders');
verify(/\bconst\s+AD_PLACEHOLDER_SLOT\s*=\s*(["'])0000000000\1/.test(placements),
    'advertising: placeholder guard must remain 0000000000');

if (failures.length) {
    console.error(`Site-content verification failed (${failures.length} of ${checkCount} checks):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
} else {
    console.log(`Site-content verification passed (${checkCount} checks).`);
}
