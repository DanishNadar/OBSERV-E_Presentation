import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { colors } from "../theme";
import { Aperture, Kicker } from "../components/ui";
import { acquireScore, keepScore, type Box } from "../lib/hazards";

const W = 1100;
const H = 620;

interface Candidate { id: string; cx: number; feet: number; height: number; confidence: number; color: string }

const initial: Candidate[] = [
  { id: "A", cx: 520, feet: 520, height: 330, confidence: 0.88, color: colors.cyan },
  { id: "B", cx: 230, feet: 470, height: 250, confidence: 0.93, color: colors.magenta },
  { id: "C", cx: 860, feet: 560, height: 380, confidence: 0.71, color: colors.lime },
];

const boxOf = (c: Candidate): Box => [c.cx - c.height * 0.21, c.feet - c.height, c.cx + c.height * 0.21, c.feet];

const Figure = ({ c, color }: { c: Candidate; color: string }) => (
  <g fill={color} stroke={color} strokeLinecap="round">
    <circle cx={c.cx} cy={c.feet - c.height * 0.88} r={c.height * 0.09} />
    <line x1={c.cx} y1={c.feet - c.height * 0.76} x2={c.cx} y2={c.feet - c.height * 0.5} strokeWidth={c.height * 0.16} />
    <line x1={c.cx} y1={c.feet - c.height * 0.48} x2={c.cx - c.height * 0.07} y2={c.feet} strokeWidth={c.height * 0.085} />
    <line x1={c.cx} y1={c.feet - c.height * 0.48} x2={c.cx + c.height * 0.07} y2={c.feet} strokeWidth={c.height * 0.085} />
  </g>
);

export const Whom = () => {
  const [people, setPeople] = useState(initial);
  const [mode, setMode] = useState<"acquire" | "keep">("acquire");
  const [dragging, setDragging] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const previous = boxOf(initial[0]);
  const predicted: [number, number] = [initial[0].cx + 30, initial[0].feet - initial[0].height / 2];
  const gate = Math.hypot(W, H) * 0.3;

  const scored = people.map((c) => {
    const box = boxOf(c);
    const cy = c.feet - c.height / 2;
    if (mode === "acquire") return { c, total: acquireScore(c.cx, cy, c.confidence, W, H), passes: true, parts: "0.65·centred + 0.35·conf" };
    const k = keepScore(box, c.confidence, predicted, previous, W, H);
    return { c, total: k.passesGate ? k.total : -1, passes: k.passesGate, parts: `0.55·dist ${k.distanceScore.toFixed(2)} + 0.25·IoU ${k.overlap.toFixed(2)} + 0.20·conf` };
  });
  const pool = scored.filter((s) => s.passes);
  const winner = (pool.length ? pool : scored).reduce((a, b) => (b.total > a.total ? b : a));

  const toLocal = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    const p = toLocal(e);
    setPeople((list) => list.map((c) => (c.id === dragging ? { ...c, cx: Math.max(60, Math.min(W - 60, p.x)), feet: Math.max(c.height + 10, Math.min(H - 10, p.y + c.height / 2)) } : c)));
  };

  return (
    <div className="slide whom">
      <div className="whomCopy">
        <Kicker act="III" color={colors.green}>Target selection</Kicker>
        <h2 className="title" style={{ fontSize: 60 }}>How does it know <span className="grad" style={{ "--g1": colors.green, "--g2": colors.cyan } as CSSProperties}>whom to follow?</span></h2>
        <p className="lede" style={{ fontSize: 24 }}>
          On the first lock it prefers the person nearest the centre of the frame. After that it stays loyal to whoever is closest to where the filter predicted the target would be.
        </p>
        <div className="controlBar" style={{ margin: "26px 0" }}>
          <button className={`chip green ${mode === "acquire" ? "on" : ""}`} onClick={() => setMode("acquire")}>First lock</button>
          <button className={`chip amber ${mode === "keep" ? "on" : ""}`} onClick={() => setMode("keep")}>Keeping the lock</button>
          <button className="chip" onClick={() => setPeople(initial)}>Reset positions</button>
        </div>
        <div className="scoreTable">
          {scored.map((s) => (
            <div key={s.c.id} className={`scoreRow glass ${s.c.id === winner.c.id ? "win" : ""}`} style={{ "--sc": s.c.color } as CSSProperties}>
              <span className="scoreId">{s.c.id}</span>
              <div className="scoreBar"><i style={{ width: `${Math.max(0, s.total) * 100}%` }} /></div>
              <span className="mono scoreValue">{s.passes ? s.total.toFixed(2) : "gated"}</span>
              <span className="scoreParts mono">{s.passes ? s.parts : "outside 0.30 × diagonal and IoU < 0.05"}</span>
            </div>
          ))}
        </div>
        <p className="faint hint">Drag the people around the frame.</p>
      </div>
      <Aperture style={{ left: 720, top: 150, width: W, height: H }} provenance="simulated" provenanceText="Simulated, real selector formulas" glow={winner.c.color}>
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} width={W} height={H} onPointerMove={move} onPointerUp={() => setDragging(null)} onPointerLeave={() => setDragging(null)} style={{ touchAction: "none" }}>
          <defs>
            <linearGradient id="whomFloor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#120d33" />
              <stop offset="0.36" stopColor="#2a1450" />
              <stop offset="0.37" stopColor="#0c0f2a" />
              <stop offset="1" stopColor="#081a26" />
            </linearGradient>
            <filter id="glow"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <rect width={W} height={H} fill="url(#whomFloor)" />
          {Array.from({ length: 12 }, (_, i) => <line key={i} x1={W / 2} y1={H * 0.36} x2={(i / 11) * W * 1.6 - W * 0.3} y2={H} stroke="rgba(178,123,255,.12)" />)}
          <g stroke="rgba(255,230,120,.85)" fill="none" filter="url(#glow)">
            <circle cx={W / 2} cy={H / 2} r="12" />
            <line x1={W / 2 - 24} y1={H / 2} x2={W / 2 + 24} y2={H / 2} />
            <line x1={W / 2} y1={H / 2 - 24} x2={W / 2} y2={H / 2 + 24} />
          </g>
          {mode === "keep" && (
            <g>
              <circle cx={predicted[0]} cy={predicted[1]} r={gate} fill="rgba(255,181,71,.06)" stroke="rgba(255,181,71,.5)" strokeDasharray="8 8" />
              <rect x={previous[0]} y={previous[1]} width={previous[2] - previous[0]} height={previous[3] - previous[1]} fill="none" stroke="rgba(255,181,71,.6)" strokeDasharray="5 6" />
              <circle cx={predicted[0]} cy={predicted[1]} r="7" fill={colors.amber} filter="url(#glow)" />
              <text x={predicted[0] + 14} y={predicted[1] - 12} fill={colors.amber} fontSize="16" fontFamily="JetBrains Mono">predicted centre</text>
            </g>
          )}
          {people.map((c) => {
            const b = boxOf(c);
            const win = c.id === winner.c.id;
            const stroke = win ? colors.green : c.color;
            return (
              <g key={c.id} style={{ cursor: "grab" }} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDragging(c.id); }}>
                <ellipse cx={c.cx} cy={c.feet} rx={c.height * 0.2} ry={c.height * 0.04} fill="rgba(0,0,0,.4)" />
                <Figure c={c} color={win ? "#ffffff" : c.color} />
                <rect x={b[0]} y={b[1]} width={b[2] - b[0]} height={b[3] - b[1]} fill={win ? "rgba(52,224,161,.08)" : "transparent"} stroke={stroke} strokeWidth={win ? 3 : 2} filter={win ? "url(#glow)" : undefined} />
                <rect x={b[0] - 1} y={b[1] - 26} width={win ? 168 : 112} height="24" fill={stroke} rx="3" />
                <text x={b[0] + 7} y={b[1] - 8} fontSize="16" fontFamily="JetBrains Mono" fill="#04050d">{`${c.id} conf ${c.confidence.toFixed(2)}${win ? "  LOCK" : ""}`}</text>
              </g>
            );
          })}
        </svg>
      </Aperture>
    </div>
  );
};
