import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const appsDir = path.join(repoRoot, 'apps');
const appIndexPath = path.join(repoRoot, 'app-index.html');
const featuredApp = 'mountain-refuge-petri-wbs-demo';
const featuredReturn = '../../petri-smc-wbs.html#app-20';
const schedulerEntry = `apps/${featuredApp}/index.html?view=scheduler`;
const comparisonEntry = `apps/${featuredApp}/index.html?view=comparison`;
const appNameFromHref = href => href.match(/^apps\/([^/]+)\/index\.html(?:[?#].*)?$/)?.[1];

// Check actual links rather than strings that could occur in comments or scripts.
function anchorHrefs(html) {
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  return [...markup.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(
    (match) => match[1],
  );
}

const broaderHtml = fs.readFileSync(appIndexPath, 'utf8');
const appIndexHtml = fs.readFileSync(path.join(repoRoot, 'petri-smc-wbs.html'), 'utf8');
const allIndexHtml = appIndexHtml + broaderHtml;
const linkedApps = new Set(
  anchorHrefs(allIndexHtml)
    .map(appNameFromHref)
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
const mainLinks = anchorHrefs(appIndexHtml).filter(href => href.startsWith('apps/'));
const broadLinks = anchorHrefs(broaderHtml).filter(href => href.startsWith('apps/'));
const collections = JSON.parse(fs.readFileSync(path.join(repoRoot, 'planning/gimmer-collections.json'), 'utf8'));
const appSlugs = Object.fromEntries(fs.readFileSync(path.join(repoRoot, 'app-index.csv'), 'utf8').trim().split(/\r?\n/).slice(1).map(line => line.split(',').slice(0, 2)));
const expectedMain = collections.processes_to_plans.map(number => collections.process_entry_overrides?.[number] || `apps/${appSlugs[number]}/index.html`);
const expectedBroad = [...collections.broader_collection.map(number => `apps/${appSlugs[number]}/index.html`), ...(collections.broader_references || []).map(reference => reference.href)];
const sameRoutes = (actual, expected) => JSON.stringify([...new Set(actual)].sort()) === JSON.stringify([...new Set(expected)].sort());
if (!sameRoutes(mainLinks, expectedMain) || !sameRoutes(broadLinks, expectedBroad)) journeyErrors.push('Collection links must match the declared app memberships and purpose references.');
if (mainLinks.some(href => broadLinks.includes(href))) journeyErrors.push('The collection purpose routes must differ.');
if (new Set(mainLinks).size !== 16 || new Set(broadLinks).size !== 11 || linkedApps.size !== 26) journeyErrors.push('Expected 16 main entries, 10 broader apps plus one comparison reference, and 26 unique apps.');
const sharedApps = [...new Set(mainLinks.map(appNameFromHref))].filter(app => broadLinks.some(href => appNameFromHref(href) === app));
if (sharedApps.length !== 1 || sharedApps[0] !== featuredApp) journeyErrors.push('Only App 20 may have separate purpose entrances in both collections.');
if (!mainLinks.includes(schedulerEntry) || !broadLinks.includes(comparisonEntry)) journeyErrors.push('App 20 must have the explicit scheduler and comparison entrances.');
if ((broaderHtml.match(/\bid=["']app-20-comparison["']/g) || []).length !== 1) journeyErrors.push('The comparison return anchor must be unique.');

const featuredCards = [...appIndexHtml.matchAll(/<article\b[^>]*\bid=["']app-20["'][^>]*>([\s\S]*?)<\/article>/gi)];
const featuredAnchors = [...appIndexHtml.matchAll(/\bid=["']app-20["']/g)];
if (featuredCards.length !== 1 || featuredAnchors.length !== 1) {
  journeyErrors.push('petri-smc-wbs.html must have one featured article with the unique id app-20.');
} else if (!anchorHrefs(featuredCards[0][1]).includes(schedulerEntry)) {
  journeyErrors.push('The app-20 featured card must link directly to the forward scheduler entrance.');
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

  if (!hrefs.some((href) => /^\.\.\/\.\.\/(?:app-index|petri-smc-wbs|index)\.html(?:#.*)?$/.test(href))) {
    missingBackLink.push(appName);
  }

  if (appName !== 'website') {
    const collection = mainLinks.some(href => appNameFromHref(href) === appName) ? 'petri-smc-wbs.html' : 'app-index.html';
    if (!hrefs.some(href => href === `../../${collection}` || href.startsWith(`../../${collection}#`))) {
      journeyErrors.push(`${appName} must return to ${collection}.`);
    }
  }

  if (appName === featuredApp) {
    if (!hrefs.includes(featuredReturn)) {
      journeyErrors.push(`The mountain refuge app must link back to ${featuredReturn}.`);
    }
    if (!hrefs.includes('../../app-index.html#app-20-comparison')) journeyErrors.push('The comparison must retain its broader collection return.');
    if (hrefs.some((href) => /^\.\.\/\.\.\/index\.html(?:#.*)?$/.test(href))) {
      journeyErrors.push('The mountain refuge app still links to the legacy placeholder home.');
    }
  }

  if (appName !== 'website' && !linkedApps.has(appName)) {
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
  console.error('Apps missing from both collection pages:');
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
