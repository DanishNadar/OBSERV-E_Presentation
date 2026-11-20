import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { colors, alpha } from "../theme";
import { Aperture, Kicker, PlayControls } from "../components/ui";
import { setupCanvas, useAnimationLoop, useMotion } from "../lib/hooks";
import { drawBox, drawPerson } from "../lib/draw";

const maxLost = 20;
const W = 900;
const H = 380;
const pillar: [number, number] = [430, 560];
const floorY = 320;

type Source = "detector" | "tracker" | "predictionOnly" | "none";

const states: { id: Source; label: string; x: number; y: number; color: string; detail: string }[] = [
  { id: "detector", label: "Detector", x: 140, y: 120, color: colors.green, detail: "YOLO person box. Runs every 2nd frame, or whenever the lock is weak." },
  { id: "tracker", label: "Tracker", x: 580, y: 120, color: colors.cyan, detail: "CSRT, KCF or MIL, falling back to optical flow plus template matching." },
  { id: "predictionOnly", label: "Prediction only", x: 380, y: 320, color: colors.amber, detail: "No measurement. The Kalman filter coasts on its velocity estimate for up to 20 frames while confidence decays 2% per frame." },
  { id: "none", label: "Searching", x: 380, y: 520, color: colors.red, detail: "After 20 lost frames the tracker and filter reset and OBSERV-E says it lost sight of you. The detector then runs every frame until someone is found." },
];

// Transitions with their guards, as the pipeline evaluates them
const edges: { from: Source; to: Source; guard: string; bend: number; lx: number; ly: number }[] = [
  { from: "detector", to: "tracker", guard: "odd frame, lock strong", bend: -110, lx: 360, ly: 50 },
  { from: "tracker", to: "detector", guard: "2nd frame / weak lock", bend: 110, lx: 360, ly: 204 },
  { from: "tracker", to: "predictionOnly", guard: "tracker fails", bend: 30, lx: 560, ly: 250 },
  { from: "detector", to: "predictionOnly", guard: "no person box", bend: -30, lx: 150, ly: 232 },
  { from: "predictionOnly", to: "detector", guard: "re-detected in gate", bend: 70, lx: 140, ly: 300 },
  { from: "predictionOnly", to: "none", guard: "lost > 20 frames", bend: 0, lx: 450, ly: 425 },
  { from: "none", to: "detector", guard: "found → first lock", bend: -230, lx: 120, ly: 470 },
];

const scenarios = {
  quick: { name: "Quick pass", speed: 13, dwell: 0, note: "Hidden for ~12 frames: prediction bridges the gap." },
  linger: { name: "Pauses behind it", speed: 8, dwell: 40, note: "Hidden for ~60 frames: the lock is released." },
} as const;
type ScenarioId = keyof typeof scenarios;

const fresh = () => ({ frame: 0, lost: 0, conf: 0.9, source: "detector" as Source, prev: "detector" as Source, x: 120, lastX: 120, vel: 0, coastX: 120, acc: 0, occludedFor: 0, confHistory: [] as number[], spoken: null as string | null, spokenAt: -99 });

const edgePath = (from: (typeof states)[number], to: (typeof states)[number], bend: number) => {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const horizontalBend = from.id === "none";
  return `M${from.x},${from.y} Q${mx + (horizontalBend ? bend : 0)},${my + (horizontalBend ? 0 : bend)} ${to.x},${to.y}`;
};

export const Loses = () => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { reducedMotion } = useMotion();
  const [running, setRunning] = useState(!reducedMotion);
  const [fps, setFps] = useState(10);
  const [scenario, setScenario] = useState<ScenarioId>("linger");
  const [view, setView] = useState({ frame: 0, source: "detector" as Source, prev: "detector" as Source, lost: 0, conf: 0.9, spoken: null as string | null });
  const sim = useRef(fresh());

  const step = () => {
    const s = sim.current;
    const { speed, dwell } = scenarios[scenario];
    const cross = (820 - 120) / speed;
    const period = Math.ceil(cross + dwell + 18);
    const f = s.frame % period;
    const reach = (pillar[0] + 20 - 120) / speed;
    s.x = f < reach ? 120 + f * speed : f < reach + dwell ? pillar[0] + 20 + (f - reach) * 0.4 : Math.min(860, pillar[0] + 20 + dwell * 0.4 + (f - reach - dwell) * speed);
    if (f === 0) Object.assign(s, { x: 120, lastX: 120, coastX: 120 });
    const hidden = s.x > pillar[0] - 30 && s.x < pillar[1] + 10;
    s.occludedFor = hidden ? s.occludedFor + 1 : 0;
    const detectNow = s.frame % 2 === 0 || s.source === "none" || s.lost > 0;
    s.prev = s.source;
    if (hidden) {
      if (s.occludedFor <= 2 && s.source !== "none" && s.source !== "predictionOnly") s.source = "tracker";
      else if (s.source !== "none") {
        s.lost += 1;
        if (s.source !== "predictionOnly") s.coastX = s.lastX;
        s.coastX += s.vel;
        if (s.lost > maxLost) {
          s.source = "none";
          s.conf = 0;
          s.spoken = "I lost sight of you for a moment. Please step back into view or say here.";
          s.spokenAt = s.frame;
        } else {
          s.source = "predictionOnly";
          s.conf *= 0.98;
        }
      }
    } else {
      if (s.prev === "none") {
        s.spoken = "I see you again. I am back with you.";
        s.spokenAt = s.frame;
      }
      s.source = detectNow ? "detector" : "tracker";
      s.lost = 0;
      s.conf = 0.88 + (s.frame % 5) * 0.02;
      s.vel = s.x - s.lastX;
      s.lastX = s.x;
    }
    s.confHistory.push(s.conf);
    if (s.confHistory.length > 90) s.confHistory.shift();
    s.frame += 1;
    setView({ frame: s.frame, source: s.source, prev: s.prev, lost: s.lost, conf: s.conf, spoken: s.frame - s.spokenAt < 30 ? s.spoken : null });
  };

  const render = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx = setupCanvas(c, W, H);
    const s = sim.current;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0d0a2a");
    sky.addColorStop(0.84, "#1b1240");
    sky.addColorStop(0.85, "#0a1424");
    sky.addColorStop(1, "#06101c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = alpha(colors.violet, 0.5);
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(W, floorY);
    ctx.stroke();
    drawPerson(ctx, s.x, floorY, 210, s.frame * 0.5, "rgba(242,245,255,.92)");
    // Pillar with a lit edge
    const pg = ctx.createLinearGradient(pillar[0], 0, pillar[1], 0);
    pg.addColorStop(0, "#2b2060");
    pg.addColorStop(0.15, "#3a2b7a");
    pg.addColorStop(1, "#160f38");
    ctx.fillStyle = pg;
    ctx.fillRect(pillar[0], 40, pillar[1] - pillar[0], floorY - 38);
    ctx.fillStyle = alpha(colors.violet, 0.8);
    ctx.fillRect(pillar[0], 40, 3, floorY - 38);
    ctx.fillStyle = "rgba(200,190,255,.5)";
    ctx.font = '15px "JetBrains Mono"';
    ctx.fillText("pillar", pillar[0] + 40, 68);
    const boxAt = (x: number): [number, number, number, number] => [x - 48, 102, x + 48, floorY + 4];
    if (s.source === "detector") drawBox(ctx, boxAt(s.x), colors.green, "detector", false, true);
    if (s.source === "tracker") drawBox(ctx, boxAt(s.x), colors.cyan, "tracker", false, true);
    if (s.source === "predictionOnly") {
      drawBox(ctx, boxAt(s.coastX), colors.amber, `coasting · lost ${s.lost}`, true);
      ctx.strokeStyle = alpha(colors.amber, 0.6);
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(s.lastX, 210);
      ctx.lineTo(s.coastX, 210);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (s.source === "none") {
      const sweep = (Math.sin(s.frame * 0.25) * 0.5 + 0.5) * W;
      const g = ctx.createLinearGradient(sweep - 80, 0, sweep + 80, 0);
      g.addColorStop(0, "rgba(255,77,94,0)");
      g.addColorStop(0.5, "rgba(255,77,94,.18)");
      g.addColorStop(1, "rgba(255,77,94,0)");
      ctx.fillStyle = g;
      ctx.fillRect(sweep - 80, 0, 160, H);
      ctx.fillStyle = colors.red;
      ctx.font = '600 22px "Space Grotesk Variable"';
      ctx.fillText("Searching…", 24, 38);
    }
    // Confidence sparkline
    ctx.save();
    ctx.translate(W - 250, H - 84);
    ctx.fillStyle = "rgba(4,5,13,.6)";
    ctx.fillRect(0, 0, 230, 64);
    ctx.strokeStyle = colors.green;
    ctx.lineWidth = 2;
    ctx.beginPath();
    s.confHistory.forEach((v, i) => {
      const x = (i / 89) * 230;
      const y = 58 - v * 50;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = "rgba(200,210,235,.7)";
    ctx.font = '12px "JetBrains Mono"';
    ctx.fillText("confidence", 8, 14);
    ctx.restore();
  };

  useAnimationLoop((dt) => {
    const s = sim.current;
    s.acc += dt;
    while (s.acc >= 1 / fps) {
      step();
      s.acc -= 1 / fps;
    }
    render();
  }, running);
  useEffect(render, []);

  const reset = () => {
    sim.current = fresh();
    setView({ frame: 0, source: "detector", prev: "detector", lost: 0, conf: 0.9, spoken: null });
    render();
  };

  const current = states.find((st) => st.id === view.source)!;
  const ringFrac = view.lost / maxLost;
  return (
    <div className="slide loses">
      <div className="losesTop">
        <div>
          <Kicker act="III" color={colors.amber}>Tracking resilience</Kicker>
          <h2 className="title" style={{ fontSize: 62, marginBottom: 0 }}>What happens when it <span className="grad" style={{ "--g1": colors.amber, "--g2": colors.red } as CSSProperties}>loses you?</span></h2>
        </div>
        <p className="lede" style={{ fontSize: 23, maxWidth: "42ch", margin: 0 }}>
          Losing sight for a moment shouldn't mean losing the person. The pipeline steps down through cheaper and cheaper guesses before it gives up, and says so out loud when it does.
        </p>
      </div>

      <Aperture style={{ left: 112, top: 300, width: W, height: H }} provenance="simulated" provenanceText="Simulated, real fallback logic" glow={current.color}>
        <canvas ref={canvas} style={{ width: W, height: H }} aria-label="Person walking behind a pillar" />
        <AnimatePresence>
          {view.spoken && (
            <motion.div className="speechBubble losesSpeech" initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}>
              “{view.spoken}”
            </motion.div>
          )}
        </AnimatePresence>
      </Aperture>

      <div className="losesControls">
        <PlayControls running={running} onToggle={() => setRunning((v) => !v)} onReset={reset} />
        <div className="controlBar">
          {[5, 10, 30].map((v) => (
            <button key={v} className={`chip ${fps === v ? "on" : ""}`} onClick={() => setFps(v)}>{v} fps</button>
          ))}
        </div>
        <div className="controlBar">
          {(Object.keys(scenarios) as ScenarioId[]).map((id) => (
            <button key={id} className={`chip amber ${scenario === id ? "on" : ""}`} onClick={() => { setScenario(id); reset(); }}>{scenarios[id].name}</button>
          ))}
        </div>
      </div>
      <p className="faint" style={{ position: "absolute", left: 112, top: 780, fontSize: 17, margin: 0 }}>
        {scenarios[scenario].note} &nbsp; <span className="mono">frame {view.frame} · conf {view.conf.toFixed(2)}</span>
      </p>

      <div className="smPanel glass">
        <svg viewBox="0 0 720 600" width="720" height="600" role="img" aria-label="Measurement source state machine">
          <defs>
            <marker id="smArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="rgba(190,205,255,.55)" />
            </marker>
            <filter id="smGlow"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          {edges.map((e, i) => {
            const from = states.find((st) => st.id === e.from)!;
            const to = states.find((st) => st.id === e.to)!;
            const d = edgePath(from, to, e.bend);
            const live = view.prev === e.from && view.source === e.to;
            return (
              <g key={i}>
                <path id={`sm-e${i}`} d={d} fill="none" stroke={live ? from.color : "rgba(190,205,255,.22)"} strokeWidth={live ? 3.5 : 1.8} markerEnd="url(#smArrow)" filter={live ? "url(#smGlow)" : undefined} />
                {!reducedMotion && (
                  <circle r={live ? 7 : 3} fill={from.color} opacity={live ? 1 : 0.45}>
                    <animateMotion dur={live ? "0.8s" : `${2.4 + (i % 3) * 0.5}s`} repeatCount="indefinite">
                      <mpath href={`#sm-e${i}`} />
                    </animateMotion>
                  </circle>
                )}
                <text x={e.lx} y={e.ly} textAnchor="middle" fontSize="14" fontFamily="JetBrains Mono" fill={live ? "#fff" : "rgba(190,205,255,.55)"}>
                  {e.guard}
                </text>
              </g>
            );
          })}
          {states.map((st) => {
            const on = st.id === view.source;
            return (
              <g key={st.id} filter={on ? "url(#smGlow)" : undefined}>
                <rect x={st.x - 122} y={st.y - 36} width="244" height="72" rx="36" fill={on ? st.color : "rgba(12,15,36,.85)"} stroke={st.color} strokeWidth="2" opacity={on ? 1 : 0.8} />
                <text x={st.x} y={st.y + 8} textAnchor="middle" fontSize="23" fontWeight="600" fill={on ? "#04050d" : st.color} fontFamily="Space Grotesk Variable">{st.label}</text>
              </g>
            );
          })}
          {/* Lost-frame counter ring on the prediction node */}
          <g transform={`translate(${states[2].x + 160}, ${states[2].y})`}>
            <circle r="30" fill="none" stroke="rgba(255,181,71,.2)" strokeWidth="6" />
            <circle r="30" fill="none" stroke={ringFrac >= 1 ? colors.red : colors.amber} strokeWidth="6" strokeDasharray={`${Math.min(1, ringFrac) * 188.5} 188.5`} transform="rotate(-90)" strokeLinecap="round" />
            <text y="6" textAnchor="middle" fontSize="16" fontFamily="JetBrains Mono" fill="#fff">{view.lost}/{maxLost}</text>
          </g>
        </svg>
        <AnimatePresence mode="wait">
          <motion.p key={current.id} className="body losesDetail" style={{ color: current.color }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {current.detail}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
};
