import './App.css';

export default function App() {
  return (
    <main className="petri-net-app">
      <header className="petri-net-header">
        <h1>Petri Net Workflow Demo</h1>
        <p>
          Explore the interactive Petri net walkthrough in the embedded static
          app, or open it directly in a new tab.
        </p>
      </header>
      <section className="petri-net-highlights" aria-label="Feature highlights">
        <span>Interactive flow</span>
        <span>Decision checkpoints</span>
        <span>Static fallback</span>
      </section>
      <section className="petri-net-note" aria-label="Usage tips">
        <strong>Quick tip:</strong> Use the static fallback in a separate tab to
        compare flow states side-by-side while you explore the embedded view.
      </section>
      <div className="petri-net-actions">
        <a className="btn" href="./static.html">Open static fallback</a>
        <a className="btn btn-subtle" href="../../index.html">Back to app index</a>
      </div>
      <section className="petri-net-frame">
        <iframe
          title="Petri Net Workflow Demo"
          src="./static.html"
          loading="lazy"
        />
      </section>
    </main>
  );
}
