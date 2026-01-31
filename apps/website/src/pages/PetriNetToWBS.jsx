export default function PetriNetToWBS() {
  return (
    <section className="page-placeholder">
      <h1>Petri net to WBS</h1>
      <p>Mermaid sketch of the Petri net flow into WBS options.</p>
      <pre className="mt-6 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-700">
        <code>
          {`graph TD
  A[Physical Constraints] --> B(Petri Net Structure)
  B --> C[Places: Resources, Sites]
  B --> D[Transitions: Activities]
  C --> E[OPEN PETRI NET (P)]
  D --> E
  E --> F[Symmetric Monoidal Category]
  F --> G[P as a presentation of SMC<br/>(FP, the free SMC on P)]
  G --> H[Markings: Initial States<br/>(Tokens representing resources)]
  H --> I[GENERATE WBS OPTIONS<br/>• Each marking ⇒ schedule<br/>• Compatible with FP<br/>• Composition = feasible<br/>paths (sequence or ⊗)]
  I --> J[Schedules + Work Packages<br/>↳ Constrained by physical logic<br/>↳ Derived from process structure<br/>↳ Represented as string diagrams]
  J --> K[TOOLING LAYERS<br/>• Catlab.jl / AlgebraicJulia<br/>• DPO Rewriting for dynamics<br/>• StockFlow & CatColab logics]`}
        </code>
      </pre>
    </section>
  );
}
