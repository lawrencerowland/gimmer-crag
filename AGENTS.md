# Project Apps Repository

This repository contains a basic React/Vite setup that can host many small applications. Only a single template app lives in `apps/portfolio-state-machine/` but the tooling supports adding more apps under `apps/<app-name>`.

## Working With Apps

- `npm start` launches a development server on port `3000`. Use `APP=<app-name>` to serve a different app if more are added.
- `npm test` runs the Vitest test suite (tests live under each app's `src` folder).
- `npm run build` executes `scripts/build-all.js` which builds every app under `apps/` and outputs them to `docs/apps/<app-name>`.

## Repository Conventions

- Each app lives in `apps/<app-name>` with its own `src` directory and `index.html`. Shared utilities are under `src/common`.
- Screenshots for the index page are stored in `pics/`. The numeric `#` column in `app-index.csv` matches a screenshot named `pics/<number>.png`. Missing images fall back to `pics/blank.png`.
- Include `<a href="../../index.html">Back to app index</a>` somewhere in each app's `index.html` so users can return easily.

## Design Guidelines
- Use the shared `common.css` stylesheet in all static apps to ensure a unified look. It imports the Inter font and defines base margins, heading styles and button classes.
- Link to `common.css` with a relative path, e.g. `<link rel="stylesheet" href="../../common.css">`.
- Include `<meta name="viewport" content="width=device-width, initial-scale=1">` and design with flexible layouts so pages remain responsive on mobile.
- Keep asset paths relative (avoid leading `/`) so the site works when published to GitHub Pages. In React apps pass `basename={import.meta.env.BASE_URL}` to `BrowserRouter`.
- Embed small datasets inline so each app can be opened directly without a server.

## Style Guide for Placeholder Apps and Pages
- Keep the existing file and folder structure intact, even when content is reduced to placeholders.
- For app `index.html` files, preserve the back link to `../../index.html` and include the shared `common.css` stylesheet.
- Keep placeholder content intentionally brief: a single heading and one short sentence is enough.
- For the website routes in `apps/website/src/pages`, use short placeholder sections that name the page and nothing more.
- When simplifying React apps, keep a minimal `App.jsx`, a small `App.css`, and ensure tests assert the placeholder heading.
