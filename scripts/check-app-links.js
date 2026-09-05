import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const appsDir = path.join(repoRoot, 'apps');
const appIndexPath = path.join(repoRoot, 'app-index.html');
const featuredApp = 'mountain-refuge-petri-wbs-demo';
const featuredReturn = '../../app-index.html#app-20';

// Check actual links rather than strings that could occur in comments or scripts.
function anchorHrefs(html) {
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  return [...markup.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(
    (match) => match[1],
  );
}

const appIndexHtml = fs.readFileSync(appIndexPath, 'utf8');
const linkedApps = new Set(
  anchorHrefs(appIndexHtml)
    .map((href) => href.match(/^apps\/([^/]+)\/index\.html$/)?.[1])
    .filter(Boolean),
);

const appDirs = fs
  .readdirSync(appsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const missingBackLink = [];
const missingFromIndex = [];
const missingCommonCss = [];
const missingViewportMeta = [];
const journeyErrors = [];

const featuredCards = [...appIndexHtml.matchAll(/<article\b[^>]*\bid=["']app-20["'][^>]*>([\s\S]*?)<\/article>/gi)];
const featuredAnchors = [...appIndexHtml.matchAll(/\bid=["']app-20["']/g)];
if (featuredCards.length !== 1 || featuredAnchors.length !== 1) {
  journeyErrors.push('app-index.html must have one featured article with the unique id app-20.');
} else if (!anchorHrefs(featuredCards[0][1]).includes(`apps/${featuredApp}/index.html`)) {
  journeyErrors.push('The app-20 featured card must link directly to the mountain refuge app.');
}

if (anchorHrefs(appIndexHtml).includes('index.html')) {
  journeyErrors.push('The apps page must not send visitors back to the legacy placeholder home.');
}

if (!fs.existsSync(path.join(appsDir, featuredApp, 'index.html'))) {
  journeyErrors.push('The featured mountain refuge app is missing.');
}

for (const appName of appDirs) {
  const indexPath = path.join(appsDir, appName, 'index.html');
  if (!fs.existsSync(indexPath)) continue;

  const html = fs.readFileSync(indexPath, 'utf8');
  const hasSrcFolder = fs.existsSync(path.join(appsDir, appName, 'src'));
  const hrefs = anchorHrefs(html);

  if (!hrefs.some((href) => /^\.\.\/\.\.\/(?:app-index|index)\.html(?:#.*)?$/.test(href))) {
    missingBackLink.push(appName);
  }

  if (appName === featuredApp) {
    if (!hrefs.includes(featuredReturn)) {
      journeyErrors.push(`The mountain refuge app must link back to ${featuredReturn}.`);
    }
    if (hrefs.some((href) => /^\.\.\/\.\.\/index\.html(?:#.*)?$/.test(href))) {
      journeyErrors.push('The mountain refuge app still links to the legacy placeholder home.');
    }
  }

  if (!linkedApps.has(appName)) {
    missingFromIndex.push(appName);
  }

  if (!hasSrcFolder && !html.includes('../../common.css')) {
    missingCommonCss.push(appName);
  }

  if (!/name=["']viewport["']/i.test(html)) {
    missingViewportMeta.push(appName);
  }
}

if (
  missingBackLink.length === 0 &&
  missingFromIndex.length === 0 &&
  missingCommonCss.length === 0 &&
  missingViewportMeta.length === 0 &&
  journeyErrors.length === 0
) {
  console.log('All app index pages satisfy link and baseline HTML checks. Featured app 20 has a complete apps-page return route.');
  process.exit(0);
}

if (missingBackLink.length > 0) {
  console.error('Apps missing a back link to ../../app-index.html (or legacy ../../index.html):');
  for (const app of missingBackLink) console.error(`- ${app}`);
}

if (missingFromIndex.length > 0) {
  console.error('Apps missing from app-index.html:');
  for (const app of missingFromIndex) console.error(`- ${app}`);
}

if (missingCommonCss.length > 0) {
  console.error('Static apps missing shared ../../common.css stylesheet link:');
  for (const app of missingCommonCss) console.error(`- ${app}`);
}

if (missingViewportMeta.length > 0) {
  console.error('Apps missing viewport meta tag:');
  for (const app of missingViewportMeta) console.error(`- ${app}`);
}

if (journeyErrors.length > 0) {
  console.error('Featured app navigation problems:');
  for (const error of journeyErrors) console.error(`- ${error}`);
}

process.exit(1);
