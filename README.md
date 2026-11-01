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

The included workflow publishes this folder directly. It does not install dependencies or build the site.

## Publish with Vercel

Import the repository into Vercel and set the project root to this folder if the repository contains other files. Leave the framework preset as **Other**, with no build command; deploy the static files from the project root. Vercel will redeploy when changes are pushed to the connected Git branch.

## Update camp information

Upcoming and past camp details are stored in `camps-data.js`. The pages use `script.js` to render camp cards. Camp detail pages and their images are regular HTML and asset files; keep their relative paths intact when adding or editing content.

## Mixpanel analytics

All seven pages load `analytics.js`, configured for the European Mixpanel endpoint (`https://api-eu.mixpanel.com`). The project token is a public browser token, not a secret API credential.

Analytics loads only after a visitor chooses **Allow analytics**. Visitors can reject or withdraw consent using **Analytics preferences** in the footer. The choice is remembered for 180 days and synchronized across open tabs. Browser Do Not Track / Global Privacy Control requests are respected. File previews, localhost, and loopback previews do not load analytics.

Events: **Page Viewed**, **Registration Clicked** (camp ID, name and dates), **Contact Clicked**, **Email Clicked**, **Phone Clicked**, **Social Link Clicked**, **Gallery Tab Changed**, and **Video Played**. Registration clicks measure opening the external form, not completed registrations. Page properties contain the path and title, not query strings or URL fragments. Email addresses, phone numbers, form entries, session recordings, automatic click capture, marketing parameters and IP-based geolocation are not collected by this integration. Mixpanel still receives standard device/browser metadata and a browser identifier after consent.

After publishing, open the hosted site, allow analytics, browse pages, click a registration link and play a gallery video. Check the project's Events view for the event names above. Ad blockers may prevent analytics; the site continues to function normally. Test with **Reject analytics** as well: the SDK must not load, and no tracking requests should be sent. Avoid putting secret API credentials in this repository.
