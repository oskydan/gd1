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
