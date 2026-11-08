# GD1 Hockey School website

This folder contains the complete static website. HTML pages, CSS, JavaScript, images, and fonts are kept together so relative links continue to work when hosted.

## Preview locally

Open `index.html` in a browser. For local development, a simple static server can also serve this folder; no build step or package installation is required.

## Publish with GitHub Pages

1. Create a GitHub repository for the website. Keep it private until you decide whether the site and its contact details should be public.
2. Install Git Command Line Tools if the `git` command is unavailable on your Mac.
3. In this folder, initialize Git, add the files, and push them to the repository's `main` branch.
4. In the GitHub repository, open **Settings → Pages** and set the publishing source to **GitHub Actions**.
5. Push a change to `main` (or run the **Deploy static site to GitHub Pages** workflow from the Actions tab). GitHub will provide the published site URL under **Settings → Pages**.

The deployment workflow checks generated content, local links/assets, translations, and JavaScript behaviour before publishing. It packages only public website files into `dist/`; source data, templates, and check scripts are excluded. A failed check stops publication. The separate **Check website** workflow also runs on pull requests.

## Publish with Vercel

Import the repository into Vercel and set the project root to this folder if the repository contains other files. Leave the framework preset as **Other**, with no build command; deploy the static files from the project root. Vercel will redeploy when changes are pushed to the connected Git branch.

## Update camp information

`data/camps.json` is the single source for camp dates, images, registration links, status, English/Ukrainian descriptions, prices, venues and detail-page content. Edit this file rather than generated `camps-data*.js` or camp HTML pages.

- `startsOn` / `endsOn`: ISO dates such as `2026-12-27`; displayed dates are generated.
- `timeZone`: venue's IANA zone, such as `Europe/Prague`, `Europe/Vilnius` or `Europe/Sofia`; completion uses this zone rather than the visitor's.
- `status`: `open`, `soon`, `cancelled`, or `closed`. Open registration requires an HTTPS `registrationUrl`.
- `image`: local asset path shared by the card and detail page; `copy.en` / `copy.uk` contain accessible descriptions and page text.
- `page`: detail-page filename, or an empty string for archive-only camps. Detail pages are generated using `templates/camp.html`.
- `detail.prices`: numeric euro amounts with English/Ukrainian labels, units and notes. Venue map URL is in `detail.venueUrl`.
- `defaults`: shared daily training counts and prepayment/cancellation terms.
- `footerCampIds`: camps to show in every footer, sorted by start date automatically.

After editing, run from the repository folder:

```sh
python3 tools/build.py
python3 tools/build.py --check
python3 tools/check-site.py
node tools/check-js.mjs
```

Python 3.12+ and Node.js 24 are used in GitHub Actions. There are no package dependencies to install. Commit the source change and regenerated files together using GitHub Desktop. Push as usual; the checks run before deployment. No change to your GitHub Pages settings is needed.

`--check` builds in a temporary directory and fails if committed outputs are stale; it does not rewrite your files. Local checks do not send analytics or contact registration services. They verify internal links, local assets, bilingual navigation, camp data, registration URLs/new tabs, chronological cards, disabled states and 12-camp pagination. External website availability and real-device rendering remain manual checks.

To prepare the same clean public folder locally, run `python3 tools/package-site.py` after the checks pass. `dist/` is ignored by Git.

## Mixpanel analytics

All English and Ukrainian pages load `analytics.js`, configured for the European Mixpanel endpoint (`https://api-eu.mixpanel.com`). The project token is a public browser token, not a secret API credential. Each custom event includes `page_language` (`en` or `uk`); camp IDs stay the same across languages.

Reporting titles and languages come from a fixed route-to-title map in `analytics.js`, rather than the browser's translated document title or language attribute. The event hook also normalizes SDK-generated heatmap/page-view title properties. Camp reporting titles are derived from generated camp data; add a title pair only for a new non-camp page. This applies to newly collected events; previously stored titles remain in Mixpanel.

Analytics loads only after a visitor chooses **Allow analytics**. Visitors can reject analytics in the consent banner. The footer **Analytics preferences** control is hidden in both languages. The choice is remembered for 180 days and synchronized across open tabs. Browser Do Not Track / Global Privacy Control requests are respected. File previews, localhost, and loopback previews do not load analytics.

Events: **Page Viewed**, **Registration Clicked** (camp ID, name and dates), **Contact Clicked**, **Email Clicked**, **Phone Clicked**, **Social Link Clicked**, **Gallery Tab Changed**, and **Video Played**. Registration clicks measure opening the external form, not completed registrations. Custom page properties contain the path and title, not query strings or URL fragments. Custom events do not send email addresses or phone numbers. Marketing attribution and IP-based geolocation are disabled. Mixpanel still receives standard device/browser metadata and a browser identifier after consent.

Heatmaps use `record_heatmap_data: true` and session recording for 100% of consenting visits. Recording starts explicitly after opt-in and stops when consent is withdrawn. Text and inputs are masked; images, videos, audio, iframes, forms, email/phone links, and the consent panel are blocked from recordings. Console, network and canvas recording are disabled. Session Replay also captures page metadata; avoid personal information in page URLs. The v2 consent key asks existing visitors again because the earlier message excluded recording. General autocapture remains disabled, but the heatmap feature collects click and page-view context automatically.

After publishing, allow analytics on the hosted site, click around, then open **Heatmaps** in Mixpanel and select a page URL and date range. Heatmaps require recorded sessions and access to the Session Replay feature in your Mixpanel project; historical custom events cannot produce heatmaps. Review project replay usage as traffic grows. Implementation reference: https://docs.mixpanel.com/docs/session-replay/heatmaps

After publishing, open the hosted site, allow analytics, browse pages, click a registration link and play a gallery video. Check the project's Events view for the event names above. Ad blockers may prevent analytics; the site continues to function normally. Test with **Reject analytics** as well: the SDK must not load, and no tracking requests should be sent. Avoid putting secret API credentials in this repository.

## Languages

English is the default. Each page has a Ukrainian counterpart with an `-uk.html` suffix. Header language links open the corresponding page and preserve the current gallery tab or section. Internal Ukrainian navigation stays in Ukrainian; external registration forms and map/contact URLs are unchanged. The header branding stays **GD1 CAMPS** in both versions.

Mixpanel records **Language Switched** when a visitor clicks an available language link, with `from_language`, `to_language`, `destination_path`, and `placement`, plus the common `page_path`, `page_title`, and `page_language`. Destination paths omit query strings and fragments. The destination page separately records **Page Viewed** in the selected language. All Ukrainian pages share the same event and heatmap integration as English. Consent is shared across languages; no events are sent before consent.

English HTML remains the source template. Ukrainian text, including image descriptions and accessibility labels, is maintained in `translations-uk.json`. Run `python3 tools/build.py` after editing English templates, the translation catalog or camp data to regenerate all affected pages. The script reports missing translations rather than silently leaving new English text. Generated HTML is committed and checked before deployment. Camp translations are maintained alongside English text in `data/camps.json`; `camps-data-uk.js` is generated.  dynamic navigation, registration states and analytics consent are localized in the shared scripts.

Ukrainian typography uses local Cyrillic subsets of Inter and Oswald in `assets/fonts/`, with their font declarations in `fonts-cyrillic.css`.

## Image and video optimization

Original media remains under `assets/`. Prepared WebP image sizes, video covers and smaller MP4 copies are in `assets/optimized/`; `data/media.json` maps source files to the versions used by the site. The build adds responsive image sizes, image dimensions and cache versions automatically. The publishing package omits superseded originals, while the repository keeps them for future edits.

Gallery films load only when their Play button is pressed. Selecting the Videos tab downloads covers rather than seven movies. Original chosen covers are preserved, including the Nymburk photo. Native video controls and inline mobile playback remain available.

To prepare newly added media locally, install Pillow and imageio-ffmpeg in a temporary Python environment, then run `python3 tools/optimize-media.py` followed by `python3 tools/build.py` and the normal checks. This preparation is optional for new files; commit the generated manifest and assets. CI builds use the prepared assets and do not need imaging/video dependencies. `node tools/check-gallery.mjs` verifies that tab selection does not load films and Play loads only the selected film.

## Search-engine information

The production hostname comes from `CNAME` (currently `gd1.pro`). `python3 tools/build.py` generates:

- One absolute, self-referencing canonical URL on each page. English homepage uses `https://gd1.pro/`; Ukrainian pages retain their own canonical URLs.
- Reciprocal `en` / `uk` language references, with English as `x-default`.
- `sitemap.xml` containing all canonical pages, and `robots.txt` pointing to it. No artificial modification dates are added.
- Localized Event JSON-LD on upcoming camp detail pages, with dates, arena/address, organizer, image and available registration offers. Accommodation is not advertised as a camp admission price. Start times are omitted because none have been supplied.

Camp dates, prices, registration status and venue addresses come from `data/camps.json`. `detail.addressSource` records the address reference. Venue sources: https://www.elektrenuledas.lt/kontaktai/ , https://www.blackseaicearena.com/en/article/69/sport-za-decata-na-obshtina-balchik.html and https://prague.eu/en/objevujte/skoda-icerink/ .

Event generation uses the build date in Europe/Warsaw. Completed camps lose upcoming-event markup at the next build; cancelled camps with retained pages keep their dates and receive EventCancelled status. Run the build when a date/status changes or an event ends.

`python3 tools/check-seo.py` checks canonicals, reciprocal language links, sitemap coverage, event JSON and registration prices. Both GitHub workflows run it before publication. The public package includes the sitemap and robots file.

After publishing, submit `https://gd1.pro/sitemap.xml` in Google Search Console and inspect the camp URLs using Google's Rich Results Test. Local validation cannot guarantee indexing or enhanced search results. References: https://developers.google.com/search/docs/appearance/structured-data/event and https://developers.google.com/search/docs/specialty/international/localized-versions .

## Real-browser tests

Playwright tests the packaged website in desktop Chromium, mobile Chromium (Pixel profile), and WebKit with an iPhone-sized viewport. Device profiles emulate browser/touch behaviour; they do not replace testing on a physical phone.

The suite opens all published pages in both languages and checks horizontal overflow, loaded images, menus, language switching, chronological camps, external registration tabs, photo-viewer controls/focus/scroll restoration, video playback without preloading other films, 12-camp pagination and a 320px menu layout. Tests run against `dist/`, the same package that is published.

To run locally with Node.js 24 and Python 3.12+:

```sh
npm ci
npx playwright install chromium webkit
python3 tools/build.py
python3 tools/package-site.py
npm run test:browser
```

On Linux, install browser system dependencies with `npx playwright install --with-deps chromium webkit`. On a Mac with Chrome installed, set `GD1_TEST_CHROME_PATH` to the Chrome executable if you want to use it for the Chromium projects. The default uses Playwright's bundled Chromium.

The runner starts and stops its own loopback-only server on port 4173. It fixes the browser date relative to the configured camps so the tests remain useful after those camps end. Registration destinations are intercepted with harmless test responses; no real form is contacted or submitted. Local analytics is disabled, and unexpected external requests fail the tests.

Both GitHub workflows run the suite before publication. Failures block deployment and produce an HTML report, screenshot and trace, available as a workflow artifact for 7 days. Test dependencies, reports and screenshots are excluded from the published site and ignored by Git.

Playwright configuration reference: https://playwright.dev/docs/test-configuration and CI guidance: https://playwright.dev/docs/ci-intro .

## CSS maintenance

`styles.css` is the shared stylesheet for both languages. It uses readable declaration blocks and section notes. Global theme tokens are at the top: `--accent`, `--font`, and `--display`. Responsive rules retain their cascade position so breakpoint behaviour stays consistent. Cyrillic font-face definitions remain in `fonts-cyrillic.css`.

When adjusting a component, edit its existing rule and the relevant breakpoint rather than adding a new override at the bottom. Preserve keyboard focus/hover styles, disabled states and reduced-motion/viewport fallbacks. Run the build to refresh stylesheet versions and the browser suite before publishing.

## Missing pages

`404.html` is the custom GitHub Pages error page; `404-uk.html` is its Ukrainian counterpart. Both use the normal header/footer, with recovery links to Home, Camps and Contact. Visitors can choose Ukrainian from the language menu. The page does not automatically redirect away from the missing URL.

A root base URL keeps links, fonts and images working when the requested URL is nested (for example `/old/wordpress/post/`). Direct local-file previews resolve assets from the local site folder. The existing `/gd1/` GitHub project path is also supported.

Error pages are marked `noindex, follow`, excluded from the sitemap and do not advertise canonical/event metadata. GitHub Pages returns the custom English page with an HTTP 404 response for missing routes after deployment. The local browser-test server mirrors this behaviour, and the tests verify the status, navigation, language selection and 320px layouts. Directly opening `/404.html` or `/404-uk.html` is a normal file request and may return 200; missing URLs must still return 404.

GitHub documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site .

## Performance limits

Both automated check and deployment workflows check the public package before browser tests and publication. An oversized addition fails the check with its filename and size. Editing originals remain in the repository and are excluded when they are not shipped to visitors.

| File | Maximum size |
| --- | --- |
| Image | 350 KiB |
| Responsive image up to 480px | 80 KiB |
| Responsive image up to 960px | 200 KiB |
| Video poster (`-cover`) | 100 KiB |
| Video | 10 MiB |
| Each font, stylesheet, script or HTML file | 100 KiB |
| Other file | 200 KiB |

Cumulative limits are 10 MiB for images, 80 MiB for videos and 85 MiB for the entire public package. These prevent gradual growth even when individual files fit. KiB = 1,024 bytes; MiB = 1,048,576 bytes.

Run locally after packaging:

```sh
python3 tools/package-site.py
python3 tools/test-performance.py
python3 tools/check-performance.py
```

Limits live in `data/performance-budgets.json`. Five existing larger optimized files have exact SHA-256-pinned exceptions. Their replacement or growth is not automatically allowed, and they still count toward cumulative limits. Optimize new media first; change a limit or exception only after reviewing the impact. Remove an exception when its file is removed.

## Published site monitoring

`Monitor published site` runs daily at 07:23 UTC, after a successful Pages deployment, or manually from Actions → Monitor published site → Run workflow. It reads the domain from CNAME and checks English/Ukrainian key pages, future open camp pages, rendered registration links and their new-tab targets, and essential requested resources. Google Forms are fetched without submitting anything; obvious closed, missing or inaccessible forms fail. Each failed check is retried twice, five seconds apart. Reports appear in the run summary and are retained as artifacts for 14 days. Monitoring blocks Mixpanel requests.

To receive email alerts: in your GitHub account notification settings, enable Actions email notifications and choose failed workflows only. Scheduled-run notifications go to the workflow schedule owner (normally the account that pushes this workflow); check your email settings after publishing. No email service or secret is required. A failed run is also visible in Actions. GitHub schedules are best-effort, not continuous uptime monitoring; inactive public-repository schedules may be disabled after 60 days without activity. Form availability checks do not prove successful submission or payment.

Run locally with `node tools/monitor-live.mjs` after `npm ci` and installing Playwright Chromium. This checks the live published version, so unpublished local changes can intentionally produce failures until deployed.

## Lighthouse and accessibility gates

Both check and deployment workflows now run two quality gates against the packaged site, before publication:

- `npm run test:accessibility` scans every English/Ukrainian page in desktop and mobile Chrome using axe, including open navigation/language menus and gallery photo/video states. Detected WCAG 2 A/AA, 2.1 A/AA and 2.2 AA violations fail the run. No rules or page regions are excluded. Reports attach affected selectors, remediation guidance and incomplete checks needing manual review.
- `npm run test:lighthouse` audits mobile homepage, Camps, School, Coach, Gallery, Contact and the shared camp detail template in both languages. It runs each URL three times and uses the median run. Required: performance at least 90/100, automated accessibility 100/100, largest contentful paint at most 3.5 seconds, layout shift at most 0.1, and total blocking time at most 200 milliseconds. Thresholds are in `lighthouserc.cjs`. The initial LCP regression ceiling is 3.5 seconds; the improvement target remains 2.5 seconds.

Use Node.js 24. Run `npm ci`, install the Playwright browsers, and package the site with `python3 tools/package-site.py` first. Lighthouse uses the pinned Playwright Chromium by default (or `CHROME_PATH`); both suites also support the local `GD1_TEST_CHROME_PATH` override. Run suites sequentially because they share the local test server and competing browser work can distort performance measurements.

The GitHub run summary shows a Lighthouse scores/metrics table. GitHub stores the accessibility and Lighthouse HTML/JSON reports for 14 days in the run's `quality-report` artifact. Reports stay in GitHub artifacts rather than being uploaded to public Lighthouse storage or the website. Local report folders are ignored by Git and excluded from the public site. Localhost checks do not send Mixpanel visits.

These checks catch regressions but do not establish full accessibility compliance. Keyboard/screen-reader usability and video captions still require human review. Lighthouse uses simulated mobile conditions on a local server; it is not a measurement of every visitor's connection or production caching.

The pinned `basic-ftp` override supplies the patched transitive dependency used by Lighthouse's tooling; it is not included in the published website.

## Returning-visitor caching

The published GitHub Pages responses were reviewed: images, fonts, styles and scripts currently have `Cache-Control: max-age=600` plus validators. The site now supplements that short host cache with a demand-only service-worker cache for versioned static assets. No hosting/DNS changes are required.

`tools/versions.py` adds content-derived `?v=` versions to images, font files, both stylesheets and site scripts, including runtime camp data and responsive image choices. Changing an image/font updates its URL and the version of dependent CSS/JavaScript. Unchanged bytes keep the same URL across deployments, so reusable files do not expire merely because another camp was edited. The build/check command remains idempotent.

`cache.js` registers `sw.js` after page loading on HTTPS. File previews and localhost retain normal behavior unless the browser test explicitly enables caching. Root domains and `/gd1/` GitHub project paths are supported. After the worker controls the site, requested static files are stored as they are used; it does not prefetch the gallery or movies. Repeat visits can reuse those assets beyond GitHub's ten-minute cache lifetime.

The worker validates response bytes against the URL's content version before storing. Storage is limited to 64 files, at most 512 KiB each (roughly 32 MiB of content), expiring after 30 days; oldest entries are evicted when full. Larger images retain normal hosting/browser caching. Failed/partial responses and unversioned URLs are not stored. Storage/registration restrictions fall back to ordinary loading.

HTML navigation is revalidated against the network and is never saved as an offline page. Forms, tracking requests, third-party resources, MP4 files and byte-range requests are not added to this cache. Updated HTML therefore selects new asset versions without purging unchanged files. Normal hosting deployment propagation still applies. Both languages have the same behavior.

Run `python3 tools/test-versions.py` and `npm run test:cache` to check content-version dependency updates, real repeat-request avoidance, deployment updates, both language fonts, cache limits/expiry, root/project paths, video ranges and excluded requests. These tests run in desktop Chrome and iPhone-sized WebKit before publishing; their reports are included in the quality-report artifact. Browser caching tests deliberately disable the ordinary HTTP cache on their fixture server so they prove the service-worker behavior.

To change cache policy, edit `sw.js` and deploy it at the same URL; registration uses `updateViaCache: 'none'`. If this feature ever needs to be retired, deploy a pass-through worker that deletes only this site's `gd1-assets-*` cache and unregisters itself. Simply removing `sw.js` does not remove workers already installed in visitors' browsers.

## Automatic camp completion

A camp stays active throughout its `endsOn` date in its `timeZone`. At midnight beginning the following day it leaves the homepage/upcoming list, appears in Past camps, and its registration becomes a non-interactive “Camp Completed” status (“Кемп завершено” in Ukrainian). Both registration buttons on a dedicated camp page also close. Completed camps leave the footer Upcoming camps list; an empty list shows a new-dates message. Cancelled camps retain their Cancelled label. Manually closed registration remains supported before a camp ends.

The page schedules the next boundary, rechecks on focus, visibility and history restoration, and guards registration/camp-card clicks against a suspended timer. This works on already-open pages without a deployment or reload. Past camps with a dedicated details page link to it; camps without a details page stay non-clickable. Registration remains disabled for completed camps. Past camps are sorted newest first, in batches of 12; an open archive keeps its loaded batch size when a camp completes. Dates handle daylight-saving changes and visitors in other time zones.

Runtime state comes from the visitor device's clock and the venue time zone. Google Forms are external: this closes the website buttons, not submissions through a previously saved direct form URL. Search metadata uses the same venue-local final day when rebuilt, and live monitoring no longer expects registration buttons for completed camps.

`tools/check-js.mjs` tests exact boundaries and daylight-saving transitions. Browser expiry tests independently calculate expected boundaries using Python's IANA zone library and simulate visitors in Los Angeles, including open tabs, detail pages, stale clicks and archive pagination.
