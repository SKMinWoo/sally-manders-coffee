import type { Trend, Visual } from "@/server/office";
import s from "./visual.module.css";

// Each exhibit's proof, drawn from the same stored facts as the card's figures. Server-renderable
// (no hooks), so /office ships it as markup; the bead card on the home page draws the compact cut.
// Colour carries the kind of thing (teal held, red broke, mustard wobbled); every mark has its
// word beside it too, so nothing is told by colour alone.

const n = (x: number) => x.toLocaleString("en-US");

/** A run-by-run line, the last run dotted and its value written at the end. */
function Spark({ t, label, fmt }: { t: Trend; label: string; fmt: (v: number) => string }) {
  if (t.length < 2) return null;
  const W = 120, H = 28;
  const vs = t.map((p) => p.value);
  const lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const pts = vs.map((v, i) => [(i / (vs.length - 1)) * W, H - 3 - ((v - lo) / span) * (H - 6)] as const);
  const last = pts[pts.length - 1]!;
  return (
    <div className={s.spark}>
      <svg viewBox={`-2 0 ${W + 4} ${H}`} aria-hidden="true">
        <polyline points={pts.map((p) => p.join(",")).join(" ")} className={s.sparkLine} pathLength={1} />
        <circle cx={last[0]} cy={last[1]} r="2.6" className={s.sparkDot} />
      </svg>
      <span>
        {label}, last {t.length} runs: <b>{fmt(vs[vs.length - 1]!)}</b>
        <span className={s.quiet}> (range {fmt(lo)}–{fmt(hi)})</span>
      </span>
    </div>
  );
}

/** One bar, 0–100%, with an optional bar line for the gate. */
function Meter({ label, value, bar }: { label: string; value: number; bar?: number | null }) {
  return (
    <div className={s.meter}>
      <span className={s.meterLabel}>{label}</span>
      <span className={s.track}>
        <span className={s.fill} style={{ transform: `scaleX(${value / 100})` }} />
        {bar != null && <span className={s.bar} style={{ left: `${bar}%` }} title={`The gate's bar, ${bar}%`} />}
      </span>
      <b className={s.meterValue}>{value.toFixed(1)}%</b>
    </div>
  );
}

/** A row of cells, one per thing counted, coloured by what became of it. */
function Cells({ groups, cap = 160 }: { groups: { n: number; cls: string | undefined; label: string }[]; cap?: number }) {
  const total = groups.reduce((a, g) => a + g.n, 0);
  const scale = total > cap ? cap / total : 1; // past the cap, a cell stands for more than one
  return (
    <>
      <div className={s.cells} aria-hidden="true">
        {groups.flatMap((g) => Array.from({ length: Math.round(g.n * scale) }, (_, i) => <i key={`${g.cls}${i}`} className={g.cls} />))}
      </div>
      <p className={s.key}>
        {groups.filter((g) => g.n > 0 || g.cls === s.bad).map((g) => (
          <span key={g.label}><i className={g.cls} aria-hidden="true" /> {n(g.n)} {g.label}</span>
        ))}
        {scale < 1 && <span className={s.quiet}>one cell ≈ {(1 / scale).toFixed(1)}</span>}
      </p>
    </>
  );
}

const SEVERITIES = ["critical", "high", "moderate", "low"] as const;

function FullStack({ v, compact }: { v: Extract<Visual, { kind: "full-stack" }>; compact: boolean }) {
  const share = v.orders ? v.visitor / v.orders : 0;
  return (
    <>
      <div className={s.split} aria-hidden="true">
        <span className={s.splitSim} style={{ flexGrow: 1 - share }} />
        {/* a few visitors among thousands still get a sliver you can see; none get nothing */}
        {v.visitor > 0 && <span className={s.splitVisitor} style={{ flexGrow: Math.max(0.012, share) }} />}
      </div>
      <p className={s.key}>
        <span><i className={s.sim} aria-hidden="true" /> {n(v.orders - v.visitor)} by the simulator</span>
        <span><i className={s.ok} aria-hidden="true" /> {n(v.visitor)} by visitors</span>
      </p>
      {!compact && <Spark t={v.tests} label="Tests passing on main" fmt={n} />}
    </>
  );
}

function DevSecOps({ v }: { v: Extract<Visual, { kind: "devsecops" }> }) {
  return (
    <>
      {v.coverage && (
        <div className={s.meters}>
          <Meter label="Lines" value={v.coverage.lines} bar={v.coverage.bars?.lines} />
          <Meter label="Branches" value={v.coverage.branches} bar={v.coverage.bars?.branches} />
          <Meter label="Functions" value={v.coverage.functions} bar={v.coverage.bars?.functions} />
          {v.coverage.bars && <p className={s.key}><span><i className={s.barKey} aria-hidden="true" /> the gate&rsquo;s bar</span></p>}
        </div>
      )}
      {v.audit &&
        (["shipped", "tooling"] as const).map((k) => {
          const sev = v.audit![k];
          const groups = SEVERITIES.map((l) => ({ n: sev[l], cls: s[l], label: l }));
          const total = groups.reduce((a, g) => a + g.n, 0);
          return (
            <div key={k} className={s.auditRow}>
              <span className={s.meterLabel}>{k === "shipped" ? "Shipped" : "Dev tools"}</span>
              {total === 0 ? (
                <span className={s.none}><i className={s.ok} aria-hidden="true" /> no known holes</span>
              ) : (
                <span className={s.auditCells}>
                  <span className={s.cells} aria-hidden="true">
                    {groups.flatMap((g) => Array.from({ length: Math.min(g.n, 40) }, (_, i) => <i key={`${g.label}${i}`} className={g.cls} />))}
                  </span>
                  <span className={s.quiet}>{groups.filter((g) => g.n).map((g) => `${n(g.n)} ${g.label}`).join(", ")}</span>
                </span>
              )}
            </div>
          );
        })}
    </>
  );
}

function UiTests({ v, compact }: { v: Extract<Visual, { kind: "ui-tests" }>; compact: boolean }) {
  return (
    <>
      <Cells
        cap={compact ? 60 : 160}
        groups={[
          { n: v.passed, cls: s.ok, label: "passed" },
          { n: v.flaky, cls: s.wobble, label: "flaky" },
          { n: v.failed, cls: s.bad, label: "failed" },
          { n: v.skipped, cls: s.empty, label: "skipped" },
        ]}
      />
      {!compact && <p className={s.quiet}>{n(v.tests)} tests × {v.projects.join(" and ")}: one cell a run</p>}
      {!compact && <Spark t={v.took} label="Suite time" fmt={(ms) => `${Math.round(ms / 1000)} s`} />}
    </>
  );
}

/** Rows and peak heap, each against the short export's: the rows climb, the memory doesn't. */
function Export({ v }: { v: Extract<Visual, { kind: "excel-export" }> }) {
  const [a, b] = v.spans as [(typeof v.spans)[0], (typeof v.spans)[0]];
  const rows = b.rows / Math.max(1, a.rows), heap = b.heapMb / Math.max(0.01, a.heapMb);
  const top = Math.max(rows, heap, 2);
  // the day labels sit above the plot, so the flat heap line along the bottom never meets them
  const W = 240, H = 86, L = 34, R = W - 84, T = 20, B = H - 6;
  const y = (k: number) => B - ((k - 1) / (top - 1)) * (B - T - 4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.slope} role="img" aria-label={`From ${a.days} to ${b.days} days, rows grew ${rows.toFixed(1)} times and peak heap ${heap.toFixed(1)} times`}>
      <line x1={L} x2={L} y1={T} y2={B + 2} className={s.axisLine} />
      <line x1={R} x2={R} y1={T} y2={B + 2} className={s.axisLine} />
      <text x={L} y={10} className={s.tick} textAnchor="middle">{a.days}-day</text>
      <text x={R} y={10} className={s.tick} textAnchor="middle">{b.days}-day</text>
      <line x1={L} x2={R} y1={y(1)} y2={y(rows)} className={s.lineRows} pathLength={1} />
      <line x1={L} x2={R} y1={y(1)} y2={y(heap)} className={s.lineHeap} pathLength={1} />
      <circle cx={L} cy={y(1)} r="3" className={s.dotRows} />
      <circle cx={R} cy={y(rows)} r="3" className={s.dotRows} />
      <circle cx={R} cy={y(heap)} r="3" className={s.dotHeap} />
      <text x={R + 7} y={y(rows) + 4} className={s.end}>rows ×{rows.toFixed(1)}</text>
      <text x={R + 7} y={y(heap) + 4} className={s.end}>heap ×{heap.toFixed(1)}</text>
    </svg>
  );
}

function Gates({ v }: { v: Extract<Visual, { kind: "quality-gates" }> }) {
  const mark = { success: "✓", failure: "✕", cancelled: "✕", skipped: "–" } as const;
  const cls = { success: s.ok, failure: s.bad, cancelled: s.bad, skipped: s.empty } as const;
  return (
    <>
      <ol className={s.gates}>
        {v.gates.map((g) => (
          <li key={g.name}>
            <i className={cls[g.outcome]} aria-hidden="true">{mark[g.outcome]}</i>
            <span>{g.name}<span className="visually-hidden">: {g.outcome}</span></span>
          </li>
        ))}
      </ol>
      {v.baselines && (
        <div className={s.meter}>
          <span className={s.meterLabel}>Baselines</span>
          <span className={s.track}>
            <span className={s.fill} style={{ transform: `scaleX(${v.baselines.matched / Math.max(1, v.baselines.compared)})` }} />
          </span>
          <b className={s.meterValue}>{n(v.baselines.matched)}/{n(v.baselines.compared)}</b>
        </div>
      )}
    </>
  );
}

function Ai({ v }: { v: Extract<Visual, { kind: "ai-adoption" }> }) {
  const template = Math.max(0, v.written - v.byModel - v.guarded);
  return (
    <>
      <Cells
        groups={[
          { n: v.byModel, cls: s.ok, label: "kept from the model" },
          { n: v.guarded, cls: s.bad, label: "turned back by the guard" },
          { n: template, cls: s.empty, label: "from the template" },
        ]}
      />
      {v.gap && (
        <div className={s.meter}>
          <span className={s.meterLabel}>Test gap</span>
          <span className={s.track}>
            <span className={`${s.fill} ${s.fillBad}`} style={{ transform: `scaleX(${v.gap.uncovered / Math.max(1, v.gap.changed)})` }} />
          </span>
          <b className={s.meterValue}>{n(v.gap.uncovered)} of {n(v.gap.changed)}</b>
        </div>
      )}
    </>
  );
}

/** The domain modules round a ring, an arrow for each dependency in use. */
function Modules({ v }: { v: Extract<Visual, { kind: "re-architecture" }> }) {
  const names = [...new Set(v.uses.flat())].sort();
  const W = 260, H = 150, cx = W / 2, cy = H / 2, rx = 92, ry = 52;
  const at = new Map(names.map((m, i) => {
    const a = -Math.PI / 2 + (i / names.length) * Math.PI * 2;
    return [m, [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as const];
  }));
  const quiet = v.modules - names.length;
  const half = (m: string) => 7 + m.length * 3.1; // a box as wide as its condensed caps, padded
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className={s.graph} role="img" aria-label={`${names.length} modules; ${v.uses.map(([a, b]) => `${a} uses ${b}`).join(", ")}`}>
        <defs>
          <marker id="vis-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 8 4 0 8z" className={s.arrowHead} />
          </marker>
        </defs>
        {v.uses.map(([a, b]) => {
          const [x1, y1] = at.get(a)!, [x2, y2] = at.get(b)!;
          // leave each label at its own box's edge, plus a hair, so the arrowhead lands on the box
          const dx = x2 - x1, dy = y2 - y1;
          const edge = (m: string) => Math.min((half(m) + 3) / Math.abs(dx || 1e-6), 11 / Math.abs(dy || 1e-6));
          const k1 = edge(a), k2 = edge(b);
          return <line key={`${a}${b}`} x1={x1 + dx * k1} y1={y1 + dy * k1} x2={x2 - dx * k2} y2={y2 - dy * k2} className={s.edge} markerEnd="url(#vis-arrow)" />;
        })}
        {names.map((m) => {
          const [x, y] = at.get(m)!;
          return (
            <g key={m} className={s.node}>
              <rect x={x - half(m)} y={y - 8} width={half(m) * 2} height="16" rx="3" />
              <text x={x} y={y + 3.6} textAnchor="middle">{m}</text>
            </g>
          );
        })}
      </svg>
      <p className={s.key}>
        <span><i className={v.violations ? s.bad : s.ok} aria-hidden="true" /> {n(v.violations)} boundary breaches</span>
        {quiet > 0 && <span className={s.quiet}>+{quiet} more with no imports across</span>}
      </p>
    </>
  );
}

const CAPTION: Record<Visual["kind"], string> = {
  "full-stack": "Every order to date, by who placed it",
  devsecops: "Coverage against its gate, and known holes by severity",
  "ui-tests": "Last main's browser runs",
  "excel-export": "Longer export, same memory",
  barcode: "Every barcode the tests showed the camera",
  "quality-gates": "Each gate of the last release check, in order",
  "ai-adoption": "Every morning brief, by who wrote it",
  "re-architecture": "Who imports whom, across the domain modules",
};

export function ExhibitVisual({ v, compact = false }: { v: Visual | null; compact?: boolean }) {
  if (!v) return null;
  let body: React.ReactNode;
  switch (v.kind) {
    case "full-stack": body = <FullStack v={v} compact={compact} />; break;
    case "devsecops": body = <DevSecOps v={v} />; break;
    case "ui-tests": body = <UiTests v={v} compact={compact} />; break;
    case "excel-export": body = <Export v={v} />; break;
    case "barcode":
      body = (
        <Cells
          cap={compact ? 60 : 160}
          groups={[
            { n: v.read, cls: s.ok, label: "read" },
            { n: v.unread, cls: s.empty, label: "not read" },
            { n: v.damagedRead, cls: s.wobble, label: "damaged, read anyway" },
            { n: v.refused, cls: s.refused, label: "damaged, refused" },
            { n: v.misread, cls: s.bad, label: "misread" },
          ]}
        />
      );
      break;
    case "quality-gates": body = <Gates v={v} />; break;
    case "ai-adoption": body = <Ai v={v} />; break;
    case "re-architecture": body = <Modules v={v} />; break;
  }
  return (
    <figure className={compact ? `${s.vis} ${s.compact}` : s.vis}>
      <figcaption className={s.caption}>{CAPTION[v.kind]}</figcaption>
      {body}
    </figure>
  );
}
