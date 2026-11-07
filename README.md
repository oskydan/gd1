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
