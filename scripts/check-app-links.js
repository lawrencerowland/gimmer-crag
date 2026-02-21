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

for (const appName of appDirs) {
  const indexPath = path.join(appsDir, appName, 'index.html');
  if (!fs.existsSync(indexPath)) continue;

  const html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes('../../index.html')) {
    missingBackLink.push(appName);
  }

  if (!linkedApps.has(appName)) {
    missingFromIndex.push(appName);
  }
}

if (missingBackLink.length === 0 && missingFromIndex.length === 0) {
  console.log('All app index pages are linked in and out.');
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

process.exit(1);
