import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const appsDir = path.join(repoRoot, 'apps');
const appIndexPath = path.join(repoRoot, 'app-index.html');

const appIndexHtml = fs.readFileSync(appIndexPath, 'utf8');
const linkedApps = new Set(
  [...appIndexHtml.matchAll(/href="apps\/([^/]+)\/index\.html"/g)].map((m) => m[1]),
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

for (const appName of appDirs) {
  const indexPath = path.join(appsDir, appName, 'index.html');
  if (!fs.existsSync(indexPath)) continue;

  const html = fs.readFileSync(indexPath, 'utf8');
  const hasSrcFolder = fs.existsSync(path.join(appsDir, appName, 'src'));

  if (!html.includes('../../index.html')) {
    missingBackLink.push(appName);
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
  missingViewportMeta.length === 0
) {
  console.log('All app index pages satisfy link and baseline HTML checks.');
  process.exit(0);
}

if (missingBackLink.length > 0) {
  console.error('Apps missing a back link to ../../index.html:');
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

process.exit(1);
