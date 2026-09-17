'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const appPath = path.join(__dirname, '../apps/resource-heaps');
const html = fs.readFileSync(path.join(appPath, 'index.html'), 'utf8');
const modelSource = fs.readFileSync(path.join(appPath, 'model.js'), 'utf8');
const appSource = fs.readFileSync(path.join(appPath, 'app.js'), 'utf8');
const baseURL = 'https://lawrencerowland.github.io/gimmer-crag/apps/resource-heaps/';
const copy = value => JSON.parse(JSON.stringify(value));
const pages = [];
let checks = 0;
let exportsChecked = 0;

// Evaluate the real page scripts. Browser-only effects are captured, not sent:
// clipboard writes, Blob downloads and reduced-motion preference.
function openPage(url = baseURL) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', virtualConsole });
  const { window } = dom;
  const clipboard = [];
  const downloads = [];
  const objects = new Map();
  const revoked = [];
  const page = { dom, window, document: window.document, errors, clipboard, downloads, objects, revoked, clipboardFails: false };
  window.matchMedia = query => ({ media: query, matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: {
    async writeText(text) {
      if (page.clipboardFails) throw new Error('Clipboard permission unavailable');
      clipboard.push(text);
    }
  } });
  window.Blob = class CapturedBlob {
    constructor(parts, options = {}) { this.parts = parts; this.type = options.type || ''; }
    async text() { return this.parts.map(part => String(part)).join(''); }
  };
  window.URL.createObjectURL = blob => {
    const url = 'blob:resource-heaps-test/' + objects.size;
    objects.set(url, blob);
    return url;
  };
  window.URL.revokeObjectURL = url => revoked.push(url);
  window.HTMLAnchorElement.prototype.click = function () {
    downloads.push({ href: this.href, filename: this.download });
  };
  window.addEventListener('error', event => errors.push(event.error || new Error(event.message)));
  window.eval(modelSource);
  window.eval(appSource);
  pages.push(page);
  assert.deepEqual(errors, [], 'page starts without uncaught errors');
  return page;
}

function byId(page, id) {
  const node = page.document.getElementById(id);
  assert.ok(node, 'expected interface control ' + id);
  return node;
}
function click(page, selector) {
  const node = page.document.querySelector(selector);
  assert.ok(node, 'expected clickable control ' + selector);
  assert.equal(node.disabled, false, 'control enabled: ' + selector);
  node.click();
}
function change(page, node, value) {
  if (typeof node === 'string') node = byId(page, node);
  node.value = value;
  node.dispatchEvent(new page.window.Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
}
function daysInput(page, id) {
  const task = page.window.ResourceHeap.DEFAULT_TASKS.find(task => task.id === id);
  const node = page.document.querySelector('input[aria-label="Days for ' + task.name + '"]');
  assert.ok(node, 'labelled duration input for ' + id);
  return node;
}
function visiblePriority(page) {
  return [...page.document.querySelectorAll('#priority-list .task-token')].map(node => node.textContent.toLowerCase()).join('');
}
function assertFinish(page, current, best, gap) {
  assert.equal(byId(page, 'current-finish').textContent, current + ' days');
  assert.equal(byId(page, 'best-finish').textContent, best + ' days');
  assert.equal(byId(page, 'gap').textContent, gap + ' days');
  assert.equal(byId(page, 'problem').hidden, true);
  assert.equal(byId(page, 'verified').textContent, 'Replay passed');
  assert.equal(page.document.querySelectorAll('#heap [data-task]').length, 6, 'all six task bundles rendered');
  for (const id of ['download', 'copy-link', 'use-best', 'animate', 'alternatives']) assert.equal(byId(page, id).disabled, false, id + ' enabled');
}
function assertUnavailable(page, message) {
  assert.equal(byId(page, 'problem').hidden, false);
  assert.ok(byId(page, 'problem').textContent.trim().length, 'failure explains the input problem');
  if (message) assert.match(byId(page, 'problem').textContent, message);
  assert.equal(byId(page, 'current-finish').textContent, '—');
  assert.equal(byId(page, 'best-finish').textContent, '—');
  assert.equal(byId(page, 'gap').textContent, '—');
  assert.equal(byId(page, 'verified').textContent, 'No valid schedule');
  assert.equal(page.document.querySelectorAll('#heap [data-task]').length, 0, 'stale valid blocks removed');
  assert.equal(byId(page, 'inspection-details').children.length, 0, 'stale assigned-unit details removed');
  assert.equal(byId(page, 'alternatives').options.length, 0, 'stale alternatives removed');
  assert.match(byId(page, 'search-summary').textContent, /No optimisation claim/);
  for (const id of ['download', 'use-best', 'animate', 'alternatives']) assert.equal(byId(page, id).disabled, true, id + ' disabled');
}
async function copyLink(page) {
  click(page, '#copy-link');
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(byId(page, 'scenario-link').hidden, false);
  return byId(page, 'scenario-link').value;
}
async function downloadAndAudit(page) {
  const before = page.downloads.length;
  click(page, '#download');
  assert.equal(page.downloads.length, before + 1);
  const download = page.downloads.at(-1);
  assert.equal(download.filename, 'gimmer-resource-heap.json');
  const blob = page.objects.get(download.href);
  assert.ok(blob, 'download uses the generated Blob');
  assert.equal(blob.type, 'application/json');
  const json = await blob.text();
  assert.equal(byId(page, 'export-panel').hidden, false, 'generated JSON remains visibly available');
  assert.equal(byId(page, 'export-json').readOnly, true);
  assert.equal(byId(page, 'export-json').value, json, 'visible fallback exactly matches the generated Blob');
  const receipt = JSON.parse(json);
  const M = page.window.ResourceHeap;
  const verified = M.verifySchedule(receipt.tasks, receipt.capacities, receipt.schedule);
  assert.equal(verified.ok, true, 'export replays against its own complete inputs');
  assert.equal(receipt.schema, 'gimmer-resource-heaps-v1');
  assert.equal(receipt.tasks.length, 6);
  assert.deepEqual(receipt.priority, visiblePriority(page).split(''));
  for (const pool of M.RESOURCE_TYPES) assert.equal(receipt.capacities[pool], Number(byId(page, 'crew-' + pool).value), 'export reflects visible crew');
  for (const task of receipt.tasks) assert.equal(task.duration, Number(daysInput(page, task.id).value), 'export reflects visible duration');
  assert.equal(receipt.makespan, verified.makespan);
  assert.equal(byId(page, 'current-finish').textContent, receipt.makespan + ' days');
  assert.equal(byId(page, 'best-finish').textContent, receipt.bestMakespan + ' days');
  assert.deepEqual(receipt.verification, copy(verified), 'exported verification is current');
  assert.equal(receipt.scenarioURL, page.window.location.href, 'export and current share state match');
  const exact = M.solveExact(receipt.tasks, receipt.capacities);
  assert.equal(receipt.bestMakespan, exact.bestMakespan);
  assert.equal(receipt.ordersChecked, exact.ordersChecked);
  assert.equal(receipt.uniqueEarliestSchedules, exact.uniqueSchedules);
  assert.match(byId(page, 'save-status').textContent, /download requested/i, 'status accurately describes a request');
  click(page, '#copy-json');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.clipboard.at(-1), json, 'copy JSON preserves the exact current receipt');
  assert.match(byId(page, 'save-status').textContent, /schedule JSON copied/i);
  exportsChecked++;
  return receipt;
}

async function main() {
  const page = openPage();
  assertFinish(page, 13, 13, 0);
  assert.equal(visiblePriority(page), 'abcdef');
  assert.match(byId(page, 'search-summary').textContent, /All 10 .*6 distinct .*2 finish in 13/);
  assert.match(byId(page, 'bounds').textContent, /11 days .*10 days/);
  assert.equal(page.document.querySelector('[data-priority="a:-1"]').disabled, true);
  assert.equal(page.document.querySelector('[data-priority="f:1"]').disabled, true);
  checks++;

  // Ordinary priority controls, not direct state injection.
  for (let move = 0; move < 4; move++) click(page, '[data-priority="f:-1"]');
  assert.equal(visiblePriority(page), 'afbcde');
  assertFinish(page, 15, 13, 2);
  assert.match(byId(page, 'priority-note').textContent, /A → F → B → C → D → E/);
  checks++;
  click(page, '#use-best');
  assertFinish(page, 13, 13, 0);
  checks++;

  const slower = [...byId(page, 'alternatives').options].find(option => /^15 days/.test(option.textContent));
  assert.ok(slower, 'a slower checked alternative is offered');
  change(page, 'alternatives', slower.value);
  assertFinish(page, 15, 13, 2);
  assert.ok([...byId(page, 'alternatives').selectedOptions].every(option => /^15 days/.test(option.textContent)));
  checks++;

  click(page, '[data-preset="compact"]');
  assertFinish(page, 13, 13, 0);
  click(page, '[data-preset="cache"]');
  assertFinish(page, 15, 13, 2);
  assert.equal(visiblePriority(page), 'afbcde');
  assert.match(byId(page, 'inspection-copy').textContent, /own prepared recess/);
  checks++;
  await downloadAndAudit(page);
  checks++;
  click(page, '[data-preset="both"]');
  assertFinish(page, 11, 11, 0);
  assert.equal(byId(page, 'crew-climbers').value, '3');
  assert.equal(byId(page, 'crew-builders').value, '4');
  checks++;

  // SVG keyboard selection updates the same task inspection as pointer use.
  const cacheBlock = page.document.querySelector('#heap [data-task="f"]');
  cacheBlock.dispatchEvent(new page.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  assert.match(byId(page, 'inspection-title').textContent, /Emergency cache/i);
  assert.match(byId(page, 'inspection-details').textContent, /Assigned units/);
  checks++;

  change(page, 'crew-climbers', '0');
  assertUnavailable(page, /climbers/i);
  assert.equal(byId(page, 'copy-link').disabled, false, 'valid but impossible inputs remain shareable');
  const downloadCount = page.downloads.length;
  byId(page, 'download').click();
  assert.equal(page.downloads.length, downloadCount, 'disabled export cannot release a stale schedule');
  assert.equal(new URL(page.window.location.href).searchParams.get('crew'), '0,4,3');
  checks++;
  change(page, 'crew-climbers', '3');
  assertFinish(page, 11, 11, 0);
  checks++;

  change(page, daysInput(page, 'c'), '');
  assertUnavailable(page, /duration/i);
  assert.equal(byId(page, 'copy-link').disabled, true, 'incomplete duration cannot become a scenario link');
  const copiedCount = page.clipboard.length;
  byId(page, 'copy-link').click();
  assert.equal(page.clipboard.length, copiedCount);
  checks++;
  change(page, daysInput(page, 'c'), '5');
  assertFinish(page, 13, 13, 0);
  assert.equal(daysInput(page, 'c').value, '5');
  checks++;
  change(page, 'crew-porters', '6');
  assertUnavailable(page, /capacity|porters/i);
  assert.equal(byId(page, 'copy-link').disabled, true, 'out-of-range capacity is not shareable');
  change(page, 'crew-porters', '3');
  assertFinish(page, 13, 13, 0);
  checks++;

  click(page, '[data-priority="f:-1"]');
  const link = await copyLink(page);
  assert.equal(page.clipboard.at(-1), link);
  assert.match(byId(page, 'save-status').textContent, /Scenario link copied/);
  assert.equal(new URL(link).searchParams.get('crew'), '3,4,3');
  assert.equal(new URL(link).searchParams.get('days'), '2,3,5,2,3,2');
  assert.equal(new URL(link).searchParams.get('order'), visiblePriority(page));
  const reopened = openPage(link);
  assert.equal(visiblePriority(reopened), visiblePriority(page));
  for (const id of ['current-finish', 'best-finish', 'gap']) assert.equal(byId(reopened, id).textContent, byId(page, id).textContent);
  assert.equal(daysInput(reopened, 'c').value, '5');
  assert.equal(byId(reopened, 'crew-builders').value, '4');
  checks++;
  const receipt = await downloadAndAudit(reopened);
  assert.equal(receipt.tasks.find(task => task.id === 'c').duration, 5);
  assert.deepEqual(receipt.capacities, { climbers: 3, builders: 4, porters: 3 });
  checks++;

  reopened.clipboardFails = true;
  click(reopened, '#copy-json');
  await new Promise(resolve => setImmediate(resolve));
  assert.match(byId(reopened, 'save-status').textContent, /Prepared JSON selected/i);
  assert.equal(reopened.document.activeElement, byId(reopened, 'export-json'));
  assert.equal(byId(reopened, 'export-json').selectionStart, 0);
  assert.equal(byId(reopened, 'export-json').selectionEnd, byId(reopened, 'export-json').value.length);
  checks++;
  change(reopened, daysInput(reopened, 'c'), '4');
  assert.equal(byId(reopened, 'export-panel').hidden, true, 'editing an input hides the stale receipt');
  assert.equal(byId(reopened, 'export-json').value, '', 'editing an input removes stale JSON bytes');
  checks++;
  await copyLink(reopened);
  assert.match(byId(reopened, 'save-status').textContent, /copy it to keep/i);
  assert.equal(reopened.document.activeElement, byId(reopened, 'scenario-link'));
  assert.equal(byId(reopened, 'scenario-link').selectionStart, 0);
  assert.equal(byId(reopened, 'scenario-link').selectionEnd, byId(reopened, 'scenario-link').value.length);
  checks++;

  const impossible = openPage(baseURL + '?crew=0,3,3&days=2,3,3,2,3,2&order=afbcde');
  assertUnavailable(impossible, /climbers/i);
  assert.equal(byId(impossible, 'crew-climbers').value, '0', 'impossible scenario is preserved, not replaced by default');
  assert.equal(visiblePriority(impossible), 'afbcde');
  assert.equal(byId(impossible, 'copy-link').disabled, false);
  assert.doesNotMatch(byId(impossible, 'save-status').textContent, /original example/i);
  change(impossible, 'crew-climbers', '2');
  assertFinish(impossible, 15, 13, 2);
  checks++;
  const unsupported = openPage(baseURL + '?crew=9,3,3&order=aabcde');
  assertFinish(unsupported, 13, 13, 0);
  assert.match(byId(unsupported, 'save-status').textContent, /unsupported inputs.*original example/i);
  checks++;

  click(reopened, '#reset');
  assertFinish(reopened, 13, 13, 0);
  assert.equal(daysInput(reopened, 'c').value, '3');
  assert.equal(byId(reopened, 'crew-climbers').value, '2');
  assert.equal(visiblePriority(reopened), 'abcdef');
  assert.equal(byId(reopened, 'scenario-link').hidden, true);
  assert.match(byId(reopened, 'save-status').textContent, /restored/i);
  checks++;
  for (const instance of pages) assert.deepEqual(instance.errors, [], 'no uncaught browser-script errors');
  console.log('Resource heaps UI: ' + checks + ' interaction checks across ' + pages.length + ' fresh page loads; ' + exportsChecked + ' generated JSON receipts replayed successfully.');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  for (const page of pages) page.dom.window.close();
});
