const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const appDir = path.join(__dirname, '../apps/homotopic-cliff-shed-construction');
function open() {
  const dom = new JSDOM(fs.readFileSync(path.join(appDir, 'index.html'), 'utf8'), { runScripts: 'outside-only' });
  const win = dom.window, doc = win.document;
  let nextId = 0;
  const frames = new Map();
  win.requestAnimationFrame = callback => { frames.set(++nextId, callback); return nextId; };
  win.cancelAnimationFrame = id => frames.delete(id);
  for (const file of ['model.js', 'app.js', 'field-model.js', 'field-app.js']) win.eval(fs.readFileSync(path.join(appDir, file), 'utf8'));
  const id = key => doc.getElementById(key);
  function change(key, value) { const el = id(key); el.value = value; el.dispatchEvent(new win.Event(el.tagName === 'SELECT' ? 'change' : 'input')); }
  function tick(time) { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)); }
  return { dom, id, change, tick, frames };
}

test('ordinary controls show endpoints, intermediate geometry and all three approaches', () => {
  const p = open();
  try {
    assert.equal(p.id('blend-path').getAttribute('points'), '100,350 150,250 250,200 350,50');
    p.change('blend', '50');
    assert.equal(p.id('blend-path').getAttribute('points'), '100,350 175,275 275,175 350,50');
    assert.equal(p.id('blend-value').value, '50%');
    assert.match(p.id('blend').getAttribute('aria-valuetext'), /50 percent from Helicopter Assembly toward Rope & Pulley System/);
    p.change('blend', '100');
    assert.equal(p.id('blend-path').getAttribute('points'), '100,350 200,300 300,150 350,50');
    p.change('to-path', '2');
    assert.equal(p.id('blend').value, '0');
    assert.match(p.id('milestones').textContent, /Weather Window → Route Setup/);
    p.change('blend', '100');
    assert.equal(p.id('blend-path').getAttribute('points'), '100,350 120,200 250,100 350,50');
    p.change('from-path', '2');
    assert.notEqual(p.id('from-path').value, p.id('to-path').value, 'choosing the other endpoint keeps two distinct approaches');
    p.id('reset').click();
    assert.equal(p.id('blend-path').getAttribute('points'), '100,350 120,200 250,100 350,50');
  } finally { p.dom.window.close(); }
});

test('the optional field supports inspection, deterministic reset, strength and bounded playback', () => {
  const p = open();
  try {
    p.id('task-field').open = true;
    assert.equal(p.id('field-task').options.length, 16);
    assert.equal(p.id('field-nodes').children.length, 16);
    const start = [...p.id('field-nodes').children].map(n => n.getAttribute('transform'));
    p.change('field-task', '16');
    assert.equal(p.id('field-task-name').textContent, 'Test egress routes');
    const dot = p.id('field-nodes').children[8];
    dot.dispatchEvent(new p.dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(p.id('field-task-name').textContent, 'Install roof membrane');
    assert.equal(p.id('field-task').value, '9');
    p.change('field-strength', '1.5');
    assert.equal(p.id('field-strength-value').value, '1.5');
    p.id('field-play').click(); p.tick(0);
    for (let i = 1; i <= 10; i++) p.tick(i * 50);
    assert.equal(p.id('field-steps').textContent, '10 / 600 steps');
    assert.notDeepEqual([...p.id('field-nodes').children].map(n => n.getAttribute('transform')), start);
    p.id('field-play').click(); assert.equal(p.frames.size, 0);
    p.id('field-reset').click();
    assert.deepEqual([...p.id('field-nodes').children].map(n => n.getAttribute('transform')), start);
    assert.equal(p.id('field-strength').value, '1.5', 'reset keeps the chosen strength');
    p.id('field-play').click(); p.tick(1000);
    for (let i = 1; i <= 600; i++) p.tick(1000 + i * 50);
    assert.equal(p.id('field-steps').textContent, '600 / 600 steps');
    assert.equal(p.id('field-play').getAttribute('aria-pressed'), 'false');
    assert.equal(p.frames.size, 0);
    assert.match(p.id('field-status').textContent, /not a convergence or optimality result/);
    p.id('field-play').click();
    assert.equal(p.id('field-steps').textContent, '0 / 600 steps');
    assert.deepEqual([...p.id('field-nodes').children].map(n => n.getAttribute('transform')), start);
    p.change('field-strength', '2'); assert.equal(p.frames.size, 0, 'editing strength pauses the layout');
  } finally { p.dom.window.close(); }
});

test('play, pause, manual scrubbing, completion and replay control one animation', () => {
  const p = open();
  try {
    p.id('play').click(); p.tick(1000); p.tick(5000);
    assert.equal(p.id('blend').value, '50');
    assert.equal(p.id('play').getAttribute('aria-pressed'), 'true');
    p.id('play').click();
    assert.equal(p.frames.size, 0);
    assert.equal(p.id('play').getAttribute('aria-pressed'), 'false');
    p.id('play').click(); p.tick(6000); p.tick(10000);
    assert.equal(p.id('blend').value, '100');
    assert.equal(p.frames.size, 0);
    assert.match(p.id('playback-status').textContent, /Reached the destination/);
    p.id('play').click();
    assert.equal(p.id('blend').value, '0');
    p.change('blend', '25');
    assert.equal(p.frames.size, 0, 'scrubbing cancels playback');
    assert.equal(p.id('blend').value, '25');
    p.id('play').click(); p.change('to-path', '2');
    assert.equal(p.frames.size, 0, 'changing the pair cancels playback');
    assert.equal(p.id('blend').value, '0');
  } finally { p.dom.window.close(); }
});
