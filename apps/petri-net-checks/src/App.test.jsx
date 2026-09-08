import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import App from './App';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadStaticDom({ random = 0, promptValue = null } = {}) {
  const html = readFileSync(resolve(appDir, 'static.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/apps/petri-net-checks/static.html',
    pretendToBeVisual: true,
  });
  dom.window.Math.random = () => random;
  dom.window.prompt = () => promptValue;
  return dom;
}

function getAudit(window) {
  return JSON.parse(window.document.getElementById('audit').textContent);
}

describe('Petri Net Workflow Demo React shell user stories', () => {
  it('renders the landing content, navigation actions, and embedded static demo', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Petri Net Workflow Demo' })).toBeInTheDocument();
    expect(screen.getByText(/Explore the interactive Petri net walkthrough/i)).toBeInTheDocument();
    expect(screen.getByText('Interactive flow')).toBeInTheDocument();
    expect(screen.getByText('Decision checkpoints')).toBeInTheDocument();
    expect(screen.getByText('Static fallback')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open static fallback' })).toHaveAttribute('href', './static.html');
    expect(screen.getByRole('link', { name: 'Back to processes to plans' })).toHaveAttribute('href', '../../petri-smc-wbs.html');
    expect(screen.getByTitle('Petri Net Workflow Demo')).toHaveAttribute('src', './static.html');
  });
});

describe('Petri Net Workflow Demo static app user stories', () => {
  it('loads initial marking, tabs, navigation, and audit receipt', () => {
    const { window } = loadStaticDom();
    const doc = window.document;

    expect(within(doc.body).getByRole('link', { name: 'React version' })).toHaveAttribute('href', './index.html');
    expect(within(doc.body).getByRole('link', { name: 'Back to processes to plans' })).toHaveAttribute('href', '../../petri-smc-wbs.html');
    expect(doc.getElementById('statusText').textContent).toBe('Ready');
    expect(doc.getElementById('tabs').textContent).toContain('Path A');
    expect(doc.querySelectorAll('#markingRows tr')).toHaveLength(15);
    expect(getAudit(window).enabledTransitions).toEqual([
      'tClearSite',
      'tDeliverWood',
      'tDeliverRoof',
      'tDeliverPaint',
    ]);
  });

  it('steps a feasible transition and reset returns the path to M0', async () => {
    const user = userEvent.setup();
    const { window } = loadStaticDom({ random: 0 });
    const doc = window.document;

    await user.click(doc.getElementById('btnStep'));
    expect(doc.getElementById('breadcrumbs').textContent).toContain('1: tClearSite');
    expect(doc.getElementById('pathMeta').textContent).toContain('last: tClearSite');
    expect(getAudit(window).activePath.firedSequence).toEqual(['tClearSite']);

    await user.click(doc.getElementById('btnReset'));
    expect(doc.getElementById('statusText').textContent).toBe('Ready');
    expect(doc.getElementById('breadcrumbs').textContent).toBe('M0');
    expect(doc.getElementById('reachOut').textContent).toBe('');
  });

  it('computes conservation invariants and records them in the audit receipt', async () => {
    const user = userEvent.setup();
    const { window } = loadStaticDom();
    const doc = window.document;

    await user.click(doc.getElementById('btnCons'));
    expect(doc.getElementById('invList').textContent).toContain('Conserved: crew');
    expect(doc.getElementById('reachOut').textContent).toContain('S-invariants computed');
    expect(getAudit(window).invariantsBasis.length).toBeGreaterThan(0);
  });

  it('reports reachable goals and validates malformed goals', async () => {
    const user = userEvent.setup();
    const { window } = loadStaticDom();
    const doc = window.document;

    doc.getElementById('goalInput').value = '{"complete":1}';
    await user.click(doc.getElementById('btnReach'));
    expect(doc.getElementById('statusText').textContent).toBe('Goal reachable');
    expect(doc.getElementById('reachOut').textContent).toContain('Reachable ✅');
    expect(getAudit(window).lastReachability.found).toBe(true);

    doc.getElementById('goalInput').value = '{"unknown_place":1}';
    await user.click(doc.getElementById('btnReach'));
    expect(doc.getElementById('statusText').textContent).toBe('Goal parse error');
    expect(doc.getElementById('reachOut').textContent).toContain('Unknown place key');
  });

  it('rewinds breadcrumbs, forks branches, and warns on disabled transitions', async () => {
    const user = userEvent.setup();
    const { window } = loadStaticDom({ random: 0, promptValue: '2' });
    const doc = window.document;

    await user.click(doc.getElementById('btnStep'));
    await user.click(doc.getElementById('btnStep'));
    expect(getAudit(window).activePath.cursor).toBe(2);

    await user.click(doc.querySelector('#breadcrumbs .chip'));
    expect(getAudit(window).activePath.cursor).toBe(0);

    await user.click(doc.getElementById('btnBranch'));
    expect(doc.getElementById('tabs').textContent).toContain('Path B');
    expect(getAudit(window).activePath.name).toBe('Path B');
    expect(getAudit(window).activePath.firedSequence).toEqual(['tDeliverWood']);

    const breadcrumbCount = doc.querySelectorAll('#breadcrumbs .chip').length;
    doc.querySelector('.transition[data-id="tFinish"]').dispatchEvent(new window.Event('click', { bubbles: true }));
    expect(doc.getElementById('statusText').textContent).toBe('Not enabled: tFinish');
    expect(doc.querySelectorAll('#breadcrumbs .chip')).toHaveLength(breadcrumbCount);
  });
});
