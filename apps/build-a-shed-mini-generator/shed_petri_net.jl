###############################
#  Build‑a‑Shed mini‑generator #
#  Reachability (markings) + HTML viz
#  Julia (no external runtime deps beyond stdlib)
###############################
#
# Why “stdlib‑only”?
# -----------------
# In earlier iterations we gestured at Catlab / AlgebraicRewriting.
# In practice, package resolution is the first thing that breaks in
# sandboxed / offline environments. For the *marking enumeration* and
# reachability graph, we can implement the Petri semantics directly
# (collective‑token philosophy) and keep this file runnable anywhere.
#
# This file therefore:
#   1) Defines the shed Petri net (places, transitions, pre/post incidence)
#   2) BFS‑enumerates all reachable markings from the initial marking
#   3) Builds a reachability graph (nodes=markings, edges=firings)
#   4) Writes:
#        • shed_markings.tsv
#        • shed_edges.tsv
#        • shed_reachability.html (self‑contained HTML + Tailwind + D3)
#
# Run:
#   julia shed_petri_net.jl
#
# Outputs:
#   /tmp/shed_markings.tsv
#   /tmp/shed_edges.tsv
#   /tmp/shed_reachability.html
#
# NOTE: If you *do* want the Catlab / AlgebraicPetri version later, we can
# add it as an optional path guarded by `ENV["USE_CATLAB"]=1`.

using Printf
using Random
using Dates

# -------------------------
# 1) Petri net definition
# -------------------------

"""A plain, collective‑token Petri net.

- `places` is an ordered list of place symbols
- `transitions` is an ordered list of transition symbols
- `pre[i,j]` is tokens required from place i to fire transition j
- `post[i,j]` is tokens produced into place i by transition j
"""
struct PetriNet
    places::Vector{Symbol}
    transitions::Vector{Symbol}
    pre::Matrix{Int}
    post::Matrix{Int}
end

"""A marking is an Int vector aligned with `net.places`."""
const Marking = Vector{Int}

"""Pretty name for places (for UI)."""
const PLACE_LABELS = Dict(
    :SiteClear        => "Site clear",
    :FoundationDone   => "Foundation done",
    :FrameDone        => "Frame done",
    :RoofDone         => "Roof done",
    :WallsDone        => "Walls done",
    :DoorHung         => "Door hung",
    :ShedPainted      => "Shed painted"
)

"""Pretty name for transitions (for UI)."""
const TRANS_LABELS = Dict(
    :ClearSite       => "Clear site",
    :PourFoundation  => "Pour foundation",
    :ErectFrame      => "Erect frame",
    :SheathRoof      => "Sheath roof",
    :AttachWalls     => "Attach walls",
    :HangDoor        => "Hang door",
    :PaintShed       => "Paint shed"
)

"""Duration (days) for an evaluation‑functor-ish time score."""
const TRANS_DAYS = Dict(
    :ClearSite       => 1,
    :PourFoundation  => 2,
    :ErectFrame      => 2,
    :SheathRoof      => 1,
    :AttachWalls     => 1,
    :HangDoor        => 1,
    :PaintShed       => 2
)

function build_shed_net()::Tuple{PetriNet,Marking}
    places = [:SiteClear,:FoundationDone,:FrameDone,:RoofDone,:WallsDone,:DoorHung,:ShedPainted]
    transitions = [:ClearSite,:PourFoundation,:ErectFrame,:SheathRoof,:AttachWalls,:HangDoor,:PaintShed]

    P = length(places)
    T = length(transitions)
    pre  = zeros(Int, P, T)
    post = zeros(Int, P, T)

    # Helper: index lookup
    pidx = Dict(p=>i for (i,p) in enumerate(places))
    tidx = Dict(t=>j for (j,t) in enumerate(transitions))

    # t0: ClearSite  SiteClear -> (consumes it, representing “done”)
    pre[pidx[:SiteClear], tidx[:ClearSite]] = 1

    # t1: PourFoundation  SiteClear -> FoundationDone
    pre[pidx[:SiteClear], tidx[:PourFoundation]] = 1
    post[pidx[:FoundationDone], tidx[:PourFoundation]] = 1

    # t2: ErectFrame  FoundationDone -> FrameDone
    pre[pidx[:FoundationDone], tidx[:ErectFrame]] = 1
    post[pidx[:FrameDone], tidx[:ErectFrame]] = 1

    # t3: SheathRoof  FrameDone -> RoofDone
    pre[pidx[:FrameDone], tidx[:SheathRoof]] = 1
    post[pidx[:RoofDone], tidx[:SheathRoof]] = 1

    # t4: AttachWalls  FrameDone -> WallsDone
    pre[pidx[:FrameDone], tidx[:AttachWalls]] = 1
    post[pidx[:WallsDone], tidx[:AttachWalls]] = 1

    # t5: HangDoor  WallsDone -> DoorHung
    pre[pidx[:WallsDone], tidx[:HangDoor]] = 1
    post[pidx[:DoorHung], tidx[:HangDoor]] = 1

    # t6: PaintShed  RoofDone + DoorHung -> ShedPainted
    pre[pidx[:RoofDone], tidx[:PaintShed]] = 1
    pre[pidx[:DoorHung], tidx[:PaintShed]] = 1
    post[pidx[:ShedPainted], tidx[:PaintShed]] = 1

    net = PetriNet(places, transitions, pre, post)

    # Initial marking: token at SiteClear
    m0 = zeros(Int, P)
    m0[pidx[:SiteClear]] = 1

    return net, m0
end

# ---------------------------------
# 2) Core semantics: fire & enabled
# ---------------------------------

"""Return true iff transition `tj` is enabled at marking `m`."""
@inline function enabled(net::PetriNet, m::Marking, tj::Int)::Bool
    @inbounds for i in eachindex(net.places)
        if m[i] < net.pre[i,tj]
            return false
        end
    end
    return true
end

"""Fire transition `tj` at marking `m`, returning a new marking (does not mutate `m`)."""
function fire(net::PetriNet, m::Marking, tj::Int)::Marking
    newm = similar(m)
    @inbounds for i in eachindex(net.places)
        newm[i] = m[i] - net.pre[i,tj] + net.post[i,tj]
    end
    return newm
end

"""Canonical key for hashing a marking."""
@inline marking_key(m::Marking) = join(m, ",")

"""Short human label like: [Site clear=0, Foundation done=1, ...] but compact."""
function marking_label(net::PetriNet, m::Marking)::String
    parts = String[]
    for (i,p) in enumerate(net.places)
        v = m[i]
        v == 0 && continue
        push!(parts, "$(get(PLACE_LABELS,p,string(p)))=$v")
    end
    isempty(parts) ? "∅" : join(parts, ", ")
end

# -----------------------------------
# 3) Enumerate reachable markings BFS
# -----------------------------------

"""Enumerate all reachable markings, returning:
- `nodes::Vector{Marking}`
- `edges::Vector{NamedTuple}` with fields: from, to, tname, days
"""
function enumerate_reachability(net::PetriNet, m0::Marking)
    nodes = Marking[]
    node_index = Dict{String,Int}()
    edges = NamedTuple[]

    function add_node!(m::Marking)
        k = marking_key(m)
        if haskey(node_index, k)
            return node_index[k]
        else
            push!(nodes, copy(m))
            idx = length(nodes)
            node_index[k] = idx
            return idx
        end
    end

    q = Int[]
    start_idx = add_node!(m0)
    push!(q, start_idx)

    head = 1
    while head <= length(q)
        u = q[head]; head += 1
        m = nodes[u]

        for (tj, tname) in enumerate(net.transitions)
            if enabled(net, m, tj)
                m2 = fire(net, m, tj)
                v = add_node!(m2)
                push!(edges, (from=u, to=v, tname=tname, days=get(TRANS_DAYS,tname,0)))
                # BFS frontier discovery
                if v == length(nodes) # heuristic: new node just appended
                    push!(q, v)
                end
            end
        end
    end

    return nodes, edges
end

# ------------------------
# 4) Simple path scoring
# ------------------------

"""Compute a crude shortest‑time distance to each node using Dijkstra on edge weights (=days).

This is *not* a full schedule optimizer; it’s a minimal 'evaluation functor' hook.
"""
function dijkstra_days(n_nodes::Int, edges)
    adj = [Int[] for _ in 1:n_nodes]
    wts = [Int[] for _ in 1:n_nodes]
    for e in edges
        push!(adj[e.from], e.to)
        push!(wts[e.from], max(e.days, 0))
    end

    dist = fill(typemax(Int), n_nodes)
    dist[1] = 0
    visited = fill(false, n_nodes)

    for _ in 1:n_nodes
        # pick unvisited min
        u = 0
        best = typemax(Int)
        for i in 1:n_nodes
            if !visited[i] && dist[i] < best
                best = dist[i]
                u = i
            end
        end
        u == 0 && break
        visited[u] = true
        for (k,v) in enumerate(adj[u])
            alt = dist[u] + wts[u][k]
            if alt < dist[v]
                dist[v] = alt
            end
        end
    end

    return dist
end

# ------------------------
# 5) Write TSV + HTML viz
# ------------------------

function write_tsv(outdir::String, net::PetriNet, nodes::Vector{Marking}, edges)
    mkpath(outdir)

    nodes_path = joinpath(outdir, "shed_markings.tsv")
    edges_path = joinpath(outdir, "shed_edges.tsv")

    open(nodes_path, "w") do io
        println(io, "id\tlabel\tkey\tplace_counts")
        for (i,m) in enumerate(nodes)
            println(io, "$(i)\t$(replace(marking_label(net,m), '\t'=>' '))\t$(marking_key(m))\t$(join(m,','))")
        end
    end

    open(edges_path, "w") do io
        println(io, "from\tto\ttransition\tdays")
        for e in edges
            println(io, "$(e.from)\t$(e.to)\t$(e.tname)\t$(e.days)")
        end
    end

    return nodes_path, edges_path
end

function html_escape(s::AbstractString)
    s = replace(s, "&"=>"&amp;", "<"=>"&lt;", ">"=>"&gt;", "\""=>"&quot;", "'"=>"&#39;")
    return s
end

function write_html(outdir::String, net::PetriNet, nodes::Vector{Marking}, edges, dist_days::Vector{Int})
    html_path = joinpath(outdir, "shed_reachability.html")

    # Build JSON-ish literals without needing a JSON package
    node_rows = String[]
    for (i,m) in enumerate(nodes)
        label = html_escape(marking_label(net,m))
        key = marking_key(m)
        counts = join(m, ",")
        days = dist_days[i] == typemax(Int) ? "null" : string(dist_days[i])
        push!(node_rows, "{id:$i,label:\"$label\",key:\"$key\",counts:\"$counts\",dmin:$days}")
    end

    edge_rows = String[]
    for (idx,e) in enumerate(edges)
        tlabel = html_escape(get(TRANS_LABELS, e.tname, string(e.tname)))
        push!(edge_rows, "{id:$idx,source:$(e.from),target:$(e.to),tname:\"$(e.tname)\",tlabel:\"$tlabel\",days:$(e.days)}")
    end

    # --- Explainer modal content ---
    explainers = Dict(
        "marking" => "A **marking** is just a token‑count vector over places (collective token semantics). Each node in this graph is one such vector; each directed edge is a single enabled firing that transforms one vector into another.",
        "reading" => "Edges are labeled by *tasks* (transitions). If two tasks are enabled from the same marking, that’s a real **choice point** (branch). If two tasks are enabled and commute (different tokens/places), you’ll see different paths that reconverge—your algebraic hint of **concurrency**.",
        "time"    => "The ‘Min days’ number is a lightweight evaluation (Dijkstra over edge durations). It’s *not* full CPM with resource calendars; it’s the simplest functorial semantics: morphisms ↦ additive costs.",
        "smc"     => "Formally, the Petri net presents a free commutative (or symmetric strict) monoidal category: markings are objects, firing sequences are morphisms. This UI is browsing the reachability relation, a shadow of that category.",
        "export"  => "TSV outputs are intentionally boring: you can drop them into Excel, Python, Neo4j, etc. The HTML is a convenience layer; the TSV is the real ‘audit trail’ for downstream tooling."
    )

    modal_items = String[]
    for (k,v) in explainers
        push!(modal_items, "\n<div class=\"hidden\" data-explainer=\"$k\">$(html_escape(v))</div>")
    end

    html = """
<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>Shed Petri Net — Reachability of Markings</title>
  <script src=\"https://cdn.tailwindcss.com?plugins=typography\"></script>
  <script src=\"https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js\"></script>
</head>
<body class=\"bg-slate-950 text-slate-100\">

  <!-- Header -->
  <div class=\"max-w-6xl mx-auto px-4 py-4\">
    <div class=\"flex flex-col gap-2 md:flex-row md:items-center md:justify-between\">
      <div>
        <h1 class=\"text-xl md:text-2xl font-semibold\">Shed Petri Net — Reachability Graph</h1>
        <p class=\"text-slate-300 text-sm\">Nodes = markings (token distributions). Edges = single firings. Tap a node to inspect its place‑vector.</p>
      </div>
      <div class=\"text-xs text-slate-400\">Generated: $(Dates.format(now(), "yyyy-mm-dd HH:MM"))</div>
    </div>

    <!-- Explainer buttons -->
    <div class=\"mt-3 flex flex-wrap gap-2\">
      <button class=\"px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-sm\" data-open=\"marking\">What is a marking?</button>
      <button class=\"px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-sm\" data-open=\"reading\">How to read the graph</button>
      <button class=\"px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-sm\" data-open=\"time\">About the time score</button>
      <button class=\"px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-sm\" data-open=\"smc\">SMC viewpoint</button>
      <button class=\"px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-sm\" data-open=\"export\">Exports</button>
    </div>
  </div>

  <!-- Main layout -->
  <div class=\"max-w-6xl mx-auto px-4 pb-6\">
    <div class=\"grid grid-cols-1 lg:grid-cols-3 gap-4\">

      <!-- Viz card -->
      <div class=\"lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl shadow-lg overflow-hidden\">
        <div class=\"p-3 flex flex-col md:flex-row gap-2 md:items-center md:justify-between border-b border-slate-800\">
          <div class=\"text-sm text-slate-300\">Drag nodes. Scroll/trackpad to zoom. Double‑click background to re-center.</div>
          <div class=\"flex flex-wrap gap-2\">
            <button id=\"btnReset\" class=\"px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm\">Reset view</button>
            <button id=\"btnFreeze\" class=\"px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm\">Freeze layout</button>
          </div>
        </div>
        <div class=\"relative\">
          <svg id=\"graph\" class=\"w-full\" style=\"height: 70vh; min-height: 420px;\"></svg>
          <div id=\"toast\" class=\"hidden absolute left-4 bottom-4 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100\"></div>
        </div>
      </div>

      <!-- Inspector card -->
      <div class=\"bg-slate-900/60 border border-slate-800 rounded-2xl shadow-lg\">
        <div class=\"p-4 border-b border-slate-800\">
          <h2 class=\"text-lg font-semibold\">Node inspector</h2>
          <p class=\"text-slate-300 text-sm\">Click any node to see its marking vector and enabled tasks.</p>
        </div>
        <div class=\"p-4 space-y-3\">
          <div class=\"p-3 rounded-xl bg-slate-950/40 border border-slate-800\">
            <div class=\"text-xs text-slate-400\">Selected node</div>
            <div id=\"selTitle\" class=\"mt-1 text-sm\">(none)</div>
          </div>

          <div class=\"grid grid-cols-2 gap-2\">
            <div class=\"p-3 rounded-xl bg-slate-950/40 border border-slate-800\">
              <div class=\"text-xs text-slate-400\">Marking key</div>
              <div id=\"selKey\" class=\"mt-1 text-xs break-all\">—</div>
            </div>
            <div class=\"p-3 rounded-xl bg-slate-950/40 border border-slate-800\">
              <div class=\"text-xs text-slate-400\">Min days (from start)</div>
              <div id=\"selDays\" class=\"mt-1 text-sm\">—</div>
            </div>
          </div>

          <div class=\"p-3 rounded-xl bg-slate-950/40 border border-slate-800\">
            <div class=\"text-xs text-slate-400\">Place counts</div>
            <div id=\"selCounts\" class=\"mt-1 text-sm whitespace-pre-wrap\">—</div>
          </div>

          <div class=\"p-3 rounded-xl bg-slate-950/40 border border-slate-800\">
            <div class=\"text-xs text-slate-400\">Enabled transitions at this marking</div>
            <div id=\"selEnabled\" class=\"mt-2 flex flex-wrap gap-2\">—</div>
          </div>

          <div class=\"p-3 rounded-xl bg-slate-950/40 border border-slate-800\">
            <div class=\"text-xs text-slate-400\">Legend</div>
            <div class=\"mt-2 text-sm text-slate-200\">
              <div><span class=\"inline-block w-3 h-3 rounded-full bg-slate-300 mr-2\"></span>Marking (state)</div>
              <div class=\"mt-1\"><span class=\"inline-block w-3 h-0.5 bg-slate-300 mr-2 align-middle\"></span>Firing (task edge)</div>
            </div>
          </div>

        </div>
      </div>

    </div>
  </div>

  <!-- Modal (no alert()) -->
  <div id=\"modal\" class=\"hidden fixed inset-0 z-50\">
    <div class=\"absolute inset-0 bg-black/60\" id=\"modalBackdrop\"></div>
    <div class=\"relative max-w-2xl mx-auto mt-16 p-4\">
      <div class=\"bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden\">
        <div class=\"p-4 border-b border-slate-800 flex items-center justify-between\">
          <div id=\"modalTitle\" class=\"text-lg font-semibold\">Explainer</div>
          <button id=\"modalClose\" class=\"px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm\">Close</button>
        </div>
        <div class=\"p-4\">
          <div id=\"modalBody\" class=\"prose prose-invert max-w-none\"></div>
        </div>
      </div>
    </div>

    <!-- Hidden explainer payloads -->
    $(join(modal_items, "\n"))
  </div>

<script>
(() => {
  // ---------------------------
  // Data injected by Julia
  // ---------------------------
  const nodes = [
    ${join(node_rows, ",\n    ")}
  ];
  const links = [
    ${join(edge_rows, ",\n    ")}
  ];

  const places = ${repr([get(PLACE_LABELS,p,string(p)) for p in net.places])};
  const transitions = ${repr([get(TRANS_LABELS,t,string(t)) for t in net.transitions])};

  // Pre/Post matrices embedded for enabled‑set computation in the UI.
  const PRE  = ${repr(net.pre)};
  const POST = ${repr(net.post)};

  // ---------------------------
  // Small UI helpers
  // ---------------------------
  const toast = document.getElementById('toast');
  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 2000);
  }

  function parseCounts(countsStr) {
    return countsStr.split(',').map(x => parseInt(x, 10));
  }

  function enabledTransitions(counts) {
    const enabled = [];
    for (let tj = 0; tj < PRE[0].length; tj++) {
      let ok = true;
      for (let pi = 0; pi < PRE.length; pi++) {
        if (counts[pi] < PRE[pi][tj]) { ok = false; break; }
      }
      if (ok) enabled.push(tj);
    }
    return enabled;
  }

  // ---------------------------
  // Modal explainers
  // ---------------------------
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalClose = document.getElementById('modalClose');
  const modalBackdrop = document.getElementById('modalBackdrop');

  function openExplainer(key, title) {
    const el = modal.querySelector(`[data-explainer="${key}"]`);
    if (!el) return;
    modalTitle.textContent = title;
    // Simple markdown-ish formatting: **bold** and newlines.
    let txt = el.textContent;
    txt = txt.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    txt = txt.replace(/\n/g, '<br/>');
    modalBody.innerHTML = `<p>${txt}</p>`;
    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
  }
  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);

  document.querySelectorAll('[data-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-open');
      openExplainer(key, btn.textContent.trim());
    });
  });

  // ---------------------------
  // D3 force graph
  // ---------------------------
  const svg = d3.select('#graph');
  const width = () => svg.node().clientWidth;
  const height = () => svg.node().clientHeight;

  const g = svg.append('g');

  // Zoom / pan
  const zoom = d3.zoom()
    .scaleExtent([0.3, 3.0])
    .on('zoom', (event) => g.attr('transform', event.transform));
  svg.call(zoom);

  // Double‑click background to re-center
  svg.on('dblclick.zoom', null);
  svg.on('dblclick', () => {
    svg.transition().duration(250).call(zoom.transform, d3.zoomIdentity);
    showToast('View reset');
  });

  // Arrow marker
  svg.append('defs').append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 18)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5');

  const link = g.append('g')
    .attr('stroke', 'currentColor')
    .attr('stroke-opacity', 0.45)
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke-width', 1.2)
    .attr('marker-end', 'url(#arrow)');

  const node = g.append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', 8)
    .attr('stroke', 'currentColor')
    .attr('stroke-opacity', 0.7)
    .attr('stroke-width', 1.2)
    .attr('fill', 'currentColor')
    .attr('fill-opacity', 0.85)
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended)
    );

  const label = g.append('g')
    .selectAll('text')
    .data(nodes)
    .join('text')
    .text(d => d.id)
    .attr('font-size', 10)
    .attr('dx', 10)
    .attr('dy', 4)
    .attr('fill', 'currentColor')
    .attr('opacity', 0.75);

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(80).strength(0.6))
    .force('charge', d3.forceManyBody().strength(-260))
    .force('center', d3.forceCenter(width()/2, height()/2))
    .force('collision', d3.forceCollide().radius(18));

  sim.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);

    label
      .attr('x', d => d.x)
      .attr('y', d => d.y);
  });

  // Responsive resize
  window.addEventListener('resize', () => {
    sim.force('center', d3.forceCenter(width()/2, height()/2));
    sim.alpha(0.6).restart();
  });

  // Freeze toggle
  let frozen = false;
  document.getElementById('btnFreeze').addEventListener('click', () => {
    frozen = !frozen;
    if (frozen) { sim.stop(); showToast('Layout frozen'); }
    else { sim.alpha(0.6).restart(); showToast('Layout resumed'); }
  });

  // Reset button
  document.getElementById('btnReset').addEventListener('click', () => {
    svg.transition().duration(250).call(zoom.transform, d3.zoomIdentity);
    sim.alpha(0.8).restart();
    showToast('Reset');
  });

  function dragstarted(event, d) {
    if (!event.active && !frozen) sim.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active && !frozen) sim.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // ---------------------------
  // Inspector
  // ---------------------------
  const selTitle = document.getElementById('selTitle');
  const selKey = document.getElementById('selKey');
  const selDays = document.getElementById('selDays');
  const selCounts = document.getElementById('selCounts');
  const selEnabled = document.getElementById('selEnabled');

  function renderCounts(counts) {
    const lines = [];
    for (let i = 0; i < places.length; i++) {
      lines.push(`${places[i]}: ${counts[i]}`);
    }
    return lines.join('\n');
  }

  function setSelected(d) {
    selTitle.textContent = d.label || `Node ${d.id}`;
    selKey.textContent = d.key;
    selDays.textContent = (d.dmin === null || d.dmin === undefined) ? '—' : String(d.dmin);

    const counts = parseCounts(d.counts);
    selCounts.textContent = renderCounts(counts);

    const ens = enabledTransitions(counts);
    selEnabled.innerHTML = '';
    if (ens.length === 0) {
      selEnabled.textContent = '—';
      return;
    }
    ens.forEach(tj => {
      const pill = document.createElement('span');
      pill.className = 'px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs';
      pill.textContent = transitions[tj];
      selEnabled.appendChild(pill);
    });
  }

  node.on('click', (event, d) => {
    // mild highlight: enlarge selected; reset others
    node.attr('r', n => (n.id === d.id ? 10 : 8));
    setSelected(d);
  });

  // Default select start node
  const start = nodes.find(n => n.id === 1);
  if (start) {
    setSelected(start);
    node.attr('r', n => (n.id === 1 ? 10 : 8));
  }
})();
</script>
</body>
</html>
"""

    open(html_path, "w") do io
        write(io, html)
    end

    return html_path
end

# ------------------------
# 6) Main
# ------------------------

function main()
    net, m0 = build_shed_net()
    nodes, edges = enumerate_reachability(net, m0)
    dist_days = dijkstra_days(length(nodes), edges)

    outdir = "/tmp"
    nodes_path, edges_path = write_tsv(outdir, net, nodes, edges)
    html_path = write_html(outdir, net, nodes, edges, dist_days)

    println("\n=== Shed reachability artefacts ===")
    println("Nodes TSV:  ", nodes_path)
    println("Edges TSV:  ", edges_path)
    println("HTML viz:   ", html_path)
    println("\nTip: open the HTML file in a browser.\n")

    return nothing
end

# Execute when run as a script
if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
