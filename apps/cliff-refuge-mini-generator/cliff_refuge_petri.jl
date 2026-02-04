###############################
#  Cliff‑Refuge (Shed‑on‑a‑Cliff) mini‑generator
#  Reachability (markings) + HTML viz
#  Julia (stdlib‑only)
###############################
#
# This script is deliberately dependency‑free (stdlib only):
# we want a “tiny sharable artifact” that runs anywhere.
#
# What it does
# ------------
#  1) Defines a *Petri net* for a mountain refuge halfway up a cliff
#     (places = physical preconditions/resources, transitions = tasks).
#  2) Auto‑enumerates all reachable markings from the initial marking.
#  3) Builds the reachability graph (nodes = markings, edges = firings).
#  4) Emits:
#       - /tmp/cliff_refuge_markings.tsv
#       - /tmp/cliff_refuge_reachability.html
#
# Run
# ---
#   julia cliff_refuge_petri.jl
# Then open the HTML in a browser.
#
# Notes on modeling style
# -----------------------
# We stick to the “collective token” philosophy: markings are multisets of places.
# This is the Petri‑net/CMC stance (Baez–Master), which is exactly what you want
# if you interpret markings as “state snapshots” and transitions as “task firings”.

using Random
using Printf

###############################
# 0. Petri net core
###############################

"""A Petri net over named places and named transitions.

pre[t][p]  = tokens required from place p to fire transition t
post[t][p] = tokens produced into place p after firing transition t

All token counts are nonnegative integers.
"""
struct PetriNet
    places::Vector{String}
    transitions::Vector{String}
    pre::Matrix{Int}   # |T| × |P|
    post::Matrix{Int}  # |T| × |P|
    duration::Vector{Float64}  # per‑transition estimate (days)
end

"""Return true iff transition t is enabled at marking m."""
function enabled(net::PetriNet, m::Vector{Int}, t::Int)
    @inbounds for p in eachindex(m)
        if m[p] < net.pre[t,p]
            return false
        end
    end
    return true
end

"""Fire transition t at marking m, producing a new marking."""
function fire(net::PetriNet, m::Vector{Int}, t::Int)
    m2 = copy(m)
    @inbounds for p in eachindex(m)
        m2[p] = m2[p] - net.pre[t,p] + net.post[t,p]
        if m2[p] < 0
            error("Bug: negative token count after firing $(net.transitions[t]) at place $(net.places[p])")
        end
    end
    return m2
end

"""Stable string key for a marking (for hashing / indexing)."""
marking_key(m::Vector{Int}) = join(m, ",")

###############################
# 1. Cliff‑refuge toy project net
###############################

"""Build a Petri net for a small refuge halfway up a cliff.

Interpretation heuristics:
- Places are *facts/resources* that must hold.
- Tokens are coarse "available" flags (mostly 0/1) except where noted.

We include the cliff‑specific constraints that make this richer than a garden shed:
- Access logistics: approach path, fixed lines, anchor points
- Lift window: helicopter / winch availability as a token
- Safety gating: method statement + permit + buddy check
- Weather window: treated as a tokenized resource (a single usable window)

This is still a toy model: it’s meant to stress concurrency vs gating, not realism.
"""
function build_cliff_refuge_net()
    # Places
    P = String[
        # logistical / safety
        "BaseCampReady",          # staging area established
        "ApproachRouteOpen",      # approach path usable
        "FixedLinesRigged",       # ropes fixed / protection installed
        "AnchorsCertified",       # anchor points tested/certified
        "PermitApproved",         # local permission / safety plan approved
        "WeatherWindow",          # a good weather window exists (token consumed by some tasks)
        "HeliSlot",               # helicopter/winch slot available (token consumed)
        "CrewOnLedge",            # crew positioned at ledge site

        # build state
        "RockPadPrepared",        # leveled/secured pad or terrace prepared
        "FoundationSet",          # micro‑foundation / anchors drilled & cured
        "FrameErected",           # structure framed
        "RoofSealed",             # roof on & sealed
        "WallCladdingOn",         # walls/cladding on
        "StoveFlueFitted",         # stove/flue installed
        "DoorInstalled",          # door installed
        "InteriorBunkBuilt",       # bunks fitted
        "Painted",                # protective coating applied
        "RefugeComplete"          # end state
    ]

    # Transitions (tasks)
    T = String[
        "EstablishBaseCamp",
        "ApprovePermitAndMethod",
        "RigFixedLines",
        "TestAndCertifyAnchors",
        "MoveCrewToLedge",
        "PrepareRockPad",
        "DrillAndSetFoundation",
        "WinchMaterialsToLedge",
        "ErectFrame",
        "SealRoof",
        "AttachWallCladding",
        "FitDoor",
        "FitStoveAndFlue",
        "BuildBunks",
        "PaintProtectiveCoat",
        "FinalSafetyAndSignoff"
    ]

    np = length(P)
    nt = length(T)
    pre  = zeros(Int, nt, np)
    post = zeros(Int, nt, np)

    # Helper to index places / transitions by name
    pidx = Dict(P[i] => i for i in eachindex(P))
    tidx = Dict(T[i] => i for i in eachindex(T))

    # Convenience setters
    function req(tname::String, pname::String, k::Int=1)
        pre[tidx[tname], pidx[pname]] += k
    end
    function prod(tname::String, pname::String, k::Int=1)
        post[tidx[tname], pidx[pname]] += k
    end

    # --- Define task semantics ---

    # Establish basecamp: requires open approach route + weather; yields basecamp
    req("EstablishBaseCamp", "ApproachRouteOpen")
    req("EstablishBaseCamp", "WeatherWindow")
    prod("EstablishBaseCamp", "BaseCampReady")

    # Permit/method statement approval: yields permit
    prod("ApprovePermitAndMethod", "PermitApproved")

    # Rig fixed lines: requires basecamp, permit, weather; yields fixed lines
    req("RigFixedLines", "BaseCampReady")
    req("RigFixedLines", "PermitApproved")
    req("RigFixedLines", "WeatherWindow")
    prod("RigFixedLines", "FixedLinesRigged")

    # Certify anchors: requires fixed lines; yields anchors certified
    req("TestAndCertifyAnchors", "FixedLinesRigged")
    prod("TestAndCertifyAnchors", "AnchorsCertified")

    # Move crew to ledge: requires fixed lines + anchors certified
    req("MoveCrewToLedge", "FixedLinesRigged")
    req("MoveCrewToLedge", "AnchorsCertified")
    prod("MoveCrewToLedge", "CrewOnLedge")

    # Prepare rock pad: requires crew on ledge + weather
    req("PrepareRockPad", "CrewOnLedge")
    req("PrepareRockPad", "WeatherWindow")
    prod("PrepareRockPad", "RockPadPrepared")

    # Drill & set foundation: requires rock pad prepared + anchors certified + weather
    req("DrillAndSetFoundation", "RockPadPrepared")
    req("DrillAndSetFoundation", "AnchorsCertified")
    req("DrillAndSetFoundation", "WeatherWindow")
    prod("DrillAndSetFoundation", "FoundationSet")

    # Winch materials: requires basecamp + heli slot + crew on ledge
    # We model the heli slot as consumable (one lift); basecamp and crew persist.
    req("WinchMaterialsToLedge", "BaseCampReady")
    req("WinchMaterialsToLedge", "CrewOnLedge")
    req("WinchMaterialsToLedge", "HeliSlot")
    prod("WinchMaterialsToLedge", "HeliSlot", 0)  # consumed by not reproducing
    # (No explicit material inventory place in this toy model; the effect is enabling later tasks
    #  via the fact that we can schedule this transition before frame/roof/etc in the reachability graph.)

    # Erect frame: requires foundation set + crew on ledge
    req("ErectFrame", "FoundationSet")
    req("ErectFrame", "CrewOnLedge")
    prod("ErectFrame", "FrameErected")

    # Seal roof: requires frame erected + weather
    req("SealRoof", "FrameErected")
    req("SealRoof", "WeatherWindow")
    prod("SealRoof", "RoofSealed")

    # Attach wall cladding: requires frame erected
    req("AttachWallCladding", "FrameErected")
    prod("AttachWallCladding", "WallCladdingOn")

    # Fit door: requires wall cladding
    req("FitDoor", "WallCladdingOn")
    prod("FitDoor", "DoorInstalled")

    # Fit stove/flue: requires roof sealed + wall cladding
    req("FitStoveAndFlue", "RoofSealed")
    req("FitStoveAndFlue", "WallCladdingOn")
    prod("FitStoveAndFlue", "StoveFlueFitted")

    # Build bunks: requires wall cladding
    req("BuildBunks", "WallCladdingOn")
    prod("BuildBunks", "InteriorBunkBuilt")

    # Paint protective coat: requires roof sealed + door installed
    req("PaintProtectiveCoat", "RoofSealed")
    req("PaintProtectiveCoat", "DoorInstalled")
    prod("PaintProtectiveCoat", "Painted")

    # Final safety/signoff: requires painted + stove/flue + bunks
    req("FinalSafetyAndSignoff", "Painted")
    req("FinalSafetyAndSignoff", "StoveFlueFitted")
    req("FinalSafetyAndSignoff", "InteriorBunkBuilt")
    prod("FinalSafetyAndSignoff", "RefugeComplete")

    # --- Durations (days), deliberately rough ---
    dur = Dict(
        "EstablishBaseCamp" => 1.0,
        "ApprovePermitAndMethod" => 0.5,
        "RigFixedLines" => 1.0,
        "TestAndCertifyAnchors" => 0.5,
        "MoveCrewToLedge" => 0.5,
        "PrepareRockPad" => 1.0,
        "DrillAndSetFoundation" => 1.5,
        "WinchMaterialsToLedge" => 0.5,
        "ErectFrame" => 1.0,
        "SealRoof" => 0.5,
        "AttachWallCladding" => 1.0,
        "FitDoor" => 0.5,
        "FitStoveAndFlue" => 0.5,
        "BuildBunks" => 0.5,
        "PaintProtectiveCoat" => 0.5,
        "FinalSafetyAndSignoff" => 0.5
    )
    duration = [dur[t] for t in T]

    return PetriNet(P, T, pre, post, duration)
end

# Initial marking (tokens)
function initial_marking(net::PetriNet)
    m = zeros(Int, length(net.places))
    idx = Dict(net.places[i] => i for i in eachindex(net.places))
    # We start with: approach route open, a weather window, and one heli slot.
    # Everything else must be achieved.
    m[idx["ApproachRouteOpen"]] = 1
    m[idx["WeatherWindow"]] = 1
    m[idx["HeliSlot"]] = 1
    return m
end

###############################
# 2. Reachability enumeration
###############################

"""Enumerate all reachable markings and the labeled edges between them.

Returns:
  markings :: Vector{Vector{Int}}      # list of unique markings
  edges    :: Vector{NamedTuple}       # (src, dst, t)

We do a standard BFS over the state graph of markings.
"""
function enumerate_reachability(net::PetriNet, m0::Vector{Int}; max_states::Int=50_000)
    q = Vector{Int}()                # queue of node indices
    markings = Vector{Vector{Int}}() # index -> marking
    seen = Dict{String, Int}()       # key -> index
    edges = NamedTuple{(:src,:dst,:t),Tuple{Int,Int,Int}}[]

    function add_marking!(m::Vector{Int})
        k = marking_key(m)
        if haskey(seen, k)
            return seen[k]
        end
        push!(markings, m)
        idx = length(markings)
        seen[k] = idx
        push!(q, idx)
        return idx
    end

    add_marking!(copy(m0))

    head = 1
    while head <= length(q)
        if length(markings) > max_states
            error("State explosion: exceeded max_states=$(max_states). Consider tightening the model.")
        end
        src_idx = q[head]
        head += 1
        m = markings[src_idx]

        for t in eachindex(net.transitions)
            if enabled(net, m, t)
                m2 = fire(net, m, t)
                dst_idx = add_marking!(m2)
                push!(edges, (src=src_idx, dst=dst_idx, t=t))
            end
        end
    end

    return markings, edges
end

###############################
# 3. Pretty printing & TSV export
###############################

"""Human‑readable marking: only list places with nonzero tokens."""
function pretty_marking(net::PetriNet, m::Vector{Int})
    parts = String[]
    for (i, c) in enumerate(m)
        if c != 0
            if c == 1
                push!(parts, net.places[i])
            else
                push!(parts, "$(net.places[i])×$c")
            end
        end
    end
    isempty(parts) ? "∅" : join(parts, "; ")
end

function write_tsv(net::PetriNet, markings, edges, path::String)
    open(path, "w") do io
        println(io, "state_id\tmarking\tis_goal\tout_degree")
        outdeg = zeros(Int, length(markings))
        for e in edges
            outdeg[e.src] += 1
        end
        goal_idx = findfirst(i -> net.places[i] == "RefugeComplete", eachindex(net.places))
        for (i, m) in enumerate(markings)
            is_goal = (m[goal_idx] > 0) ? 1 : 0
            println(io, "$(i)\t$(pretty_marking(net, m))\t$(is_goal)\t$(outdeg[i])")
        end
    end
end

###############################
# 4. HTML + D3 visualisation
###############################

"""A self‑contained HTML page with:

- Force‑directed reachability graph
- Click node => show marking
- Click edge => show which transition fired
- Buttons:
    * How to read this
    * Model notes (cliff‑specific constraints)
    * Invariants & sanity checks
    * Possible extension (Willerton enriched scheduling / adjoints)

We include Tailwind via CDN (allowed) and D3 via CDNJS.
"""
function write_html(net::PetriNet, markings, edges, html_path::String)
    # Build JSON strings by hand to avoid extra deps
    # Nodes: {id, label, is_goal}
    goal_place = findfirst(==("RefugeComplete"), net.places)

    node_lines = String[]
    for (i, m) in enumerate(markings)
        is_goal = (m[goal_place] > 0)
        label = replace(pretty_marking(net, m), '"' => "\\\"")
        push!(node_lines, "{\\\"id\\\":$i,\\\"label\\\":\\\"$label\\\",\\\"is_goal\\\":$(is_goal ? \"true\" : \"false\")}" )
    end

    edge_lines = String[]
    for e in edges
        tname = replace(net.transitions[e.t], '"' => "\\\"")
        dur = @sprintf("%.2f", net.duration[e.t])
        push!(edge_lines, "{\\\"source\\\":$(e.src),\\\"target\\\":$(e.dst),\\\"t\\\":\\\"$tname\\\",\\\"dur\\\":$dur}" )
    end

    nodes_json = "[" * join(node_lines, ",") * "]"
    edges_json = "[" * join(edge_lines, ",") * "]"

    # Small helper: crude token conservation/invariant hints (toy only)
    # Here, we note that many places are “facts” (0/1). Not a strict invariant.

    html = """
<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>Cliff Refuge — Reachability (Markings)</title>
  <script src=\"https://cdn.tailwindcss.com?plugins=typography\"></script>
  <script src=\"https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js\"></script>
</head>
<body class=\"bg-slate-950 text-slate-100\">

<div class=\"max-w-6xl mx-auto p-4 sm:p-6\">
  <header class=\"flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3\">
    <div>
      <h1 class=\"text-2xl sm:text-3xl font-semibold tracking-tight\">Cliff Refuge (Halfway up a Cliff)</h1>
      <p class=\"text-slate-300 mt-1\">Reachability graph of Petri-net markings (states) — click nodes/edges for details.</p>
    </div>
    <div class=\"flex flex-wrap gap-2\">
      <button id=\"btnHow\" class=\"px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 shadow\">How to read this</button>
      <button id=\"btnModel\" class=\"px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 shadow\">Model notes</button>
      <button id=\"btnInv\" class=\"px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 shadow\">Invariants & sanity</button>
      <button id=\"btnExt\" class=\"px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 shadow\">Possible extension</button>
      <button id=\"btnReset\" class=\"px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 shadow\">Reset layout</button>
    </div>
  </header>

  <main class=\"mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4\">
    <section class=\"lg:col-span-2\">
      <div class=\"rounded-2xl bg-slate-900 shadow border border-slate-800 overflow-hidden\">
        <div class=\"px-4 py-3 border-b border-slate-800 flex items-center justify-between\">
          <div class=\"text-sm text-slate-300\">
            <span class=\"font-medium\">Graph</span>
            <span class=\"ml-2\" id=\"stats\"></span>
          </div>
          <div class=\"text-xs text-slate-400\">drag nodes • scroll to zoom</div>
        </div>
        <div id=\"viz\" class=\"w-full\" style=\"height: 520px\"></div>
      </div>

      <div class=\"mt-4 grid grid-cols-1 md:grid-cols-2 gap-4\">
        <div class=\"rounded-2xl bg-slate-900 shadow border border-slate-800 p-4\">
          <h2 class=\"font-semibold\">Selected node (marking)</h2>
          <p id=\"nodeText\" class=\"mt-2 text-slate-200 text-sm leading-relaxed\">Click a node…</p>
          <div class=\"mt-3 text-xs text-slate-400\" id=\"nodeMeta\"></div>
        </div>
        <div class=\"rounded-2xl bg-slate-900 shadow border border-slate-800 p-4\">
          <h2 class=\"font-semibold\">Selected edge (firing)</h2>
          <p id=\"edgeText\" class=\"mt-2 text-slate-200 text-sm leading-relaxed\">Click an edge…</p>
          <div class=\"mt-3 text-xs text-slate-400\" id=\"edgeMeta\"></div>
        </div>
      </div>
    </section>

    <aside class=\"lg:col-span-1\">
      <div class=\"rounded-2xl bg-slate-900 shadow border border-slate-800 p-4\">
        <h2 class=\"font-semibold\">Legend</h2>
        <ul class=\"mt-3 space-y-2 text-sm text-slate-200\">
          <li class=\"flex items-center gap-2\"><span class=\"inline-block w-3 h-3 rounded-full bg-slate-400\"></span> ordinary marking</li>
          <li class=\"flex items-center gap-2\"><span class=\"inline-block w-3 h-3 rounded-full bg-emerald-400\"></span> goal marking (RefugeComplete)</li>
        </ul>
        <hr class=\"my-4 border-slate-800\"/>
        <h3 class=\"font-semibold\">Quick checks</h3>
        <ul class=\"mt-2 space-y-2 text-sm text-slate-200\">
          <li>Does the goal appear reachable?</li>
          <li>Where do dead-ends (out-degree 0) occur?</li>
          <li>Which transitions branch the most?</li>
        </ul>
      </div>

      <div class=\"mt-4 rounded-2xl bg-slate-900 shadow border border-slate-800 p-4\">
        <h2 class=\"font-semibold\">Transitions</h2>
        <div class=\"mt-2 text-sm text-slate-200\" id=\"tList\"></div>
      </div>
    </aside>
  </main>
</div>

<!-- Modal -->
<div id=\"modal\" class=\"fixed inset-0 hidden items-center justify-center p-4\">
  <div class=\"absolute inset-0 bg-black/70\"></div>
  <div class=\"relative max-w-2xl w-full rounded-2xl bg-slate-900 border border-slate-700 shadow-xl overflow-hidden\">
    <div class=\"flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-800\">
      <h3 id=\"modalTitle\" class=\"font-semibold\"></h3>
      <button id=\"modalClose\" class=\"px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700\">Close</button>
    </div>
    <div id=\"modalBody\" class=\"px-4 py-4 prose prose-invert max-w-none\"></div>
  </div>
</div>

<script>
const NODES = $nodes_json;
const LINKS = $edges_json;

// Build stats
const statsEl = document.getElementById('stats');
statsEl.textContent = `${NODES.length} markings • ${LINKS.length} firings`;

// Transition list
const tList = document.getElementById('tList');
{
  const byName = new Map();
  LINKS.forEach(e => {
    const k = e.t;
    byName.set(k, (byName.get(k) || 0) + 1);
  });
  const rows = [...byName.entries()].sort((a,b)=>b[1]-a[1]).map(([t,c]) =>
    `<div class=\"flex justify-between gap-3 py-1 border-b border-slate-800/60\">
       <div class=\"truncate\">${t}</div>
       <div class=\"text-slate-400\">${c}</div>
     </div>`
  ).join('');
  tList.innerHTML = `<div class=\"text-xs text-slate-400 mb-2\">(count of outgoing firings across the state graph)</div>${rows}`;
}

// Modal helpers
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
function openModal(title, html){
  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}
function closeModal(){
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}
document.getElementById('modalClose').onclick = closeModal;
modal.addEventListener('click', (e)=>{ if(e.target === modal.firstElementChild) closeModal(); });

// Explainer buttons

document.getElementById('btnHow').onclick = () => openModal(
  'How to read this',
  `<p><b>Nodes</b> are <i>markings</i> (token distributions over places). Think: “what is true/available right now?”.</p>
   <p><b>Edges</b> are <i>firings</i>: a named transition whose pre‑places were marked, producing a new marking.</p>
   <p>This graph is the plan‑space: any path from the initial node to a green goal node is a feasible schedule skeleton.
   Concurrency shows up as <i>branching and re‑joining</i> rather than a single linear chain.</p>
   <p>Tip: click nodes to see the state; click edges to see the task name + duration estimate.</p>`
);

document.getElementById('btnModel').onclick = () => openModal(
  'Model notes (cliff specifics)',
  `<p>This is the “shed” upgraded into a <b>mountain refuge halfway up a cliff</b>. The extra structure is mainly about <i>access and safety gating</i>.</p>
   <ul>
     <li><b>Fixed lines</b> and <b>anchor certification</b> gate getting crew onto the ledge.</li>
     <li><b>WeatherWindow</b> is modeled as a tokenized condition used by exposure‑sensitive tasks (basecamp, rigging, pad prep, foundation, roof, paint).</li>
     <li><b>HeliSlot</b> is a consumable “lift opportunity” required for winching materials; in a richer model you’d track material lots explicitly.</li>
   </ul>
   <p>All of this is still toy‑level; the point is to show how a small set of places can enforce the physical logic while still generating many schedules.</p>`
);

document.getElementById('btnInv').onclick = () => openModal(
  'Invariants & sanity checks',
  `<p>In a “collective token” Petri net you can often compute linear invariants (S‑invariants) from the incidence matrix.
  In this dependency‑only toy, most places behave like <b>0/1 facts</b> rather than conserved resources, so invariants are weak.</p>
  <p>Practical sanity checks you can do visually:</p>
  <ul>
    <li><b>Deadlocks</b>: nodes with no outgoing edges. Are they expected (e.g. after consuming HeliSlot without enabling enough)?</li>
    <li><b>Goal reachability</b>: do any green nodes exist? If not, you’ve over‑constrained (or missed a producer).</li>
    <li><b>Accidental bypass</b>: can you reach FrameErected without FoundationSet? If yes, you mis‑wired a precondition.</li>
  </ul>
  <p>If you want real invariants, introduce explicit resources (crew‑hours, rope kits, battery drills, material crates) as conserved tokens.</p>`
);

document.getElementById('btnExt').onclick = () => openModal(
  'Possible extension',
  `<p><b>Second layer:</b> project the reachability graph into a <i>poset of enabling relations</i> (Willerton‑style enriched scheduling),
  and compute the <b>critical path</b> as an <i>adjoint</i> rather than by explicit search.</p>
  <p>Concretely: build the free \(\mathbb{R}\)-enriched category from task durations, take earliest‑start as a left Kan extension / colimit,
  and obtain slack/float from the right adjoint (latest‑start), so “critical” becomes “zero residuation” in the enriched order.</p>`
);

// Force‑directed graph
const width = document.getElementById('viz').clientWidth;
const height = document.getElementById('viz').clientHeight;

const svg = d3.select('#viz').append('svg')
  .attr('width', width)
  .attr('height', height)
  .attr('class', 'bg-slate-950');

const g = svg.append('g');

const zoom = d3.zoom().scaleExtent([0.2, 4]).on('zoom', (event) => {
  g.attr('transform', event.transform);
});
svg.call(zoom);

const link = g.append('g')
  .attr('stroke', '#334155')
  .attr('stroke-opacity', 0.8)
  .selectAll('line')
  .data(LINKS)
  .join('line')
  .attr('stroke-width', 1);

const node = g.append('g')
  .selectAll('circle')
  .data(NODES)
  .join('circle')
  .attr('r', d => d.is_goal ? 7 : 5)
  .attr('fill', d => d.is_goal ? '#34d399' : '#94a3b8')
  .attr('stroke', '#0b1220')
  .attr('stroke-width', 1.5)
  .call(d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended));

const label = g.append('g')
  .selectAll('text')
  .data(NODES)
  .join('text')
  .text(d => d.id)
  .attr('font-size', 10)
  .attr('fill', '#cbd5e1')
  .attr('opacity', 0.9)
  .attr('dx', 8)
  .attr('dy', 3);

const sim = d3.forceSimulation(NODES)
  .force('link', d3.forceLink(LINKS).id(d => d.id).distance(42).strength(0.6))
  .force('charge', d3.forceManyBody().strength(-160))
  .force('center', d3.forceCenter(width/2, height/2))
  .force('collide', d3.forceCollide().radius(d => d.is_goal ? 12 : 10));

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

function dragstarted(event, d) {
  if (!event.active) sim.alphaTarget(0.25).restart();
  d.fx = d.x;
  d.fy = d.y;
}
function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}
function dragended(event, d) {
  if (!event.active) sim.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}

// Selection UI
const nodeText = document.getElementById('nodeText');
const nodeMeta = document.getElementById('nodeMeta');
const edgeText = document.getElementById('edgeText');
const edgeMeta = document.getElementById('edgeMeta');

node.on('click', (event, d) => {
  node.attr('stroke', '#0b1220');
  d3.select(event.currentTarget).attr('stroke', '#60a5fa');
  nodeText.textContent = d.label;
  nodeMeta.textContent = `state #${d.id}${d.is_goal ? ' • GOAL' : ''}`;
});

link.on('click', (event, d) => {
  link.attr('stroke', '#334155');
  d3.select(event.currentTarget).attr('stroke', '#fbbf24');
  const s = (typeof d.source === 'object') ? d.source.id : d.source;
  const t = (typeof d.target === 'object') ? d.target.id : d.target;
  edgeText.textContent = `${d.t}  (≈ ${d.dur} days)`;
  edgeMeta.textContent = `from state #${s} → state #${t}`;
});

// Reset layout button

document.getElementById('btnReset').onclick = () => {
  sim.alpha(1).restart();
  svg.transition().duration(250).call(zoom.transform, d3.zoomIdentity);
};

</script>
</body>
</html>
"""

    open(html_path, "w") do io
        write(io, html)
    end
end

###############################
# 5. Main
###############################

function main()
    net = build_cliff_refuge_net()
    m0 = initial_marking(net)

    markings, edges = enumerate_reachability(net, m0)

    tsv_path  = "/tmp/cliff_refuge_markings.tsv"
    html_path = "/tmp/cliff_refuge_reachability.html"

    write_tsv(net, markings, edges, tsv_path)
    write_html(net, markings, edges, html_path)

    println("Wrote TSV  : $tsv_path")
    println("Wrote HTML : $html_path")
    println("Markings   : $(length(markings))")
    println("Firings    : $(length(edges))")
    println("\nOpen the HTML file in your browser to explore the reachability graph.")
end

main()
