import { useEffect, useRef, useState, type CSSProperties } from "react";
import { colors } from "../theme";
import { Aperture, Kicker, PlayControls } from "../components/ui";
import { setupCanvas, useAnimationLoop, useMotion } from "../lib/hooks";
import { KalmanFilter } from "../lib/kalman";
import { seededRandom } from "../lib/random";
import { assessRisk, immediateAlert, scoreHazard, summarizeHazards, type Box } from "../lib/hazards";
import { drawBox, drawCorridor, drawObject, drawReticle, drawStreet, riskColor } from "../lib/draw";

const W = 1180;
const H = 664;
const horizon = H * 0.36;

const layers = [
  { id: "raw", name: "Raw camera", color: "#c9d1e0", text: "Pixels only. Nothing in the frame has meaning yet." },
  { id: "detection", name: "Object detection", color: colors.cyan, text: "YOLO finds people and objects and gives each a class and a confidence score." },
  { id: "tracking", name: "Human tracking", color: colors.green, text: "One person is locked and followed. Between detections, a CSRT, KCF or MIL tracker (or optical flow) keeps the box attached." },
  { id: "prediction", name: "Motion prediction", color: colors.amber, text: "A Kalman filter smooths the box and projects it slightly ahead, so the gimbal aims where the person is going." },
  { id: "hazard", name: "Hazard awareness", color: colors.red, text: "A second detection pass scores every object by class, size, height in frame and whether it sits inside the walking corridor." },
  { id: "full", name: "Full system view", color: colors.violet, text: "Everything together, plus the alert the narration engine would generate this frame." },
] as const;

type LayerId = (typeof layers)[number]["id"];

// Scripted walkway objects approaching the camera
const props = [
  { kind: "bench", start: 0, duration: 9, laneStart: -0.95, laneEnd: -1.05, size: 1 },
  { kind: "cone", start: 3, duration: 8, laneStart: 0.05, laneEnd: 0.12, size: 0.55 },
  { kind: "bicycle", start: 9, duration: 6, laneStart: 1.6, laneEnd: -0.2, size: 1.1 },
  { kind: "potted plant", start: 13, duration: 8, laneStart: 0.9, laneEnd: 1, size: 0.7 },
  { kind: "person", start: 15, duration: 9, laneStart: -0.55, laneEnd: -0.75, size: 1.3 },
  { kind: "chair", start: 19, duration: 7, laneStart: -0.1, laneEnd: -0.25, size: 0.8 },
];
const loop = 24;

const propBox = (p: (typeof props)[number], t: number): Box | null => {
  const local = (((t - p.start) % loop) + loop) % loop;
  if (local > p.duration) return null;
  const k = local / p.duration;
  const depth = 0.04 + k * k * 0.96;
  const laneX = p.laneStart + (p.laneEnd - p.laneStart) * k;
  const feet = horizon + depth * (H - horizon) * 0.98;
  const s = 0.12 + depth * 1.05;
  const w = 120 * p.size * s * (p.kind === "bicycle" ? 1.6 : 1);
  const h = 120 * p.size * s * (p.kind === "person" ? 2.2 : 1);
  const cx = W / 2 + laneX * (30 + depth * W * 0.42);
  return feet > H + 40 ? null : [cx - w / 2, feet - h, cx + w / 2, feet];
};

// The followed person weaves in the middle distance
const targetBox = (t: number): Box => {
  const cx = W / 2 + Math.sin(t * 0.42) * 250 + Math.sin(t * 1.1) * 30;
  const feet = horizon + (H - horizon) * (0.55 + 0.12 * Math.sin(t * 0.23));
  const h = 150 + (feet - horizon) * 0.55;
  return [cx - h * 0.2, feet - h, cx + h * 0.2, feet];
};

const freshState = () => ({ t: 2, frame: 0, acc: 0, filter: new KalmanFilter(), random: seededRandom(11), trail: [] as [number, number][], lastMeasured: null as Box | null, source: "detector", conf: 0.9 });

export const See = () => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { reducedMotion } = useMotion();
  const [layer, setLayer] = useState<LayerId>("full");
  const [running, setRunning] = useState(!reducedMotion);
  const [readout, setReadout] = useState({ source: "detector", conf: 0.9, ex: 0, ey: 0, risk: 0, level: 0, alert: "" as string | null });
  const sim = useRef(freshState());

  // One 30 Hz vision frame: detector/tracker measurement or a dropout
  const step = () => {
    const s = sim.current;
    const truth = targetBox(s.t);
    s.filter.predict(1 / 30);
    if (s.random.next() < 0.06) {
      s.source = "predictionOnly";
      s.conf *= 0.98;
    } else {
      const m = truth.map((v) => v + s.random.gaussian() * 5) as Box;
      s.filter.update((m[0] + m[2]) / 2, (m[1] + m[3]) / 2, m[2] - m[0], m[3] - m[1]);
      s.lastMeasured = m;
      s.source = s.frame % 2 === 0 ? "detector" : "tracker";
      s.conf = 0.86 + s.random.next() * 0.1;
    }
    const [x, y] = s.filter.vector;
    s.trail.push([x, y]);
    if (s.trail.length > 40) s.trail.shift();
    s.frame += 1;
  };

  const render = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx = setupCanvas(c, W, H);
    const s = sim.current;
    const raw = layer === "raw";
    const on = (id: LayerId) => layer === id || layer === "full";
    drawStreet(ctx, W, H, s.t * 0.45, raw);
    const visible = props.map((p) => ({ p, box: propBox(p, s.t) })).filter((v): v is { p: (typeof props)[number]; box: Box } => v.box !== null);
    visible.forEach(({ p, box }) => drawObject(ctx, p.kind, box, raw ? 0.55 : 0.9, s.t * 4, raw ? "#b9bec7" : undefined));
    const truth = targetBox(s.t);
    drawObject(ctx, "person", truth, 0.95, s.t * 5, raw ? "#e6e8ec" : "#ffffff");
    if (raw) {
      const noise = seededRandom(Math.floor(s.t * 30));
      ctx.fillStyle = "rgba(255,255,255,.05)";
      for (let i = 0; i < 900; i++) ctx.fillRect(noise.next() * W, noise.next() * H, 1.5, 1.5);
    }
    const conf = (i: number) => 0.62 + ((i * 37 + Math.floor(s.t * 3)) % 30) / 100;
    if (on("detection") && layer !== "full") {
      visible.forEach(({ p, box }, i) => drawBox(ctx, box, colors.cyan, `${p.kind} ${conf(i).toFixed(2)}`, false, true));
      drawBox(ctx, s.lastMeasured ?? truth, colors.cyan, `person ${s.conf.toFixed(2)}`, false, true);
    }
    const hazards = visible.map(({ p, box }, i) => scoreHazard({ label: p.kind, confidence: conf(i), box }, W, H));
    const summary = summarizeHazards(hazards);
    if (on("hazard")) {
      drawCorridor(ctx, W, H, horizon);
      hazards.forEach((h) => drawBox(ctx, h.box, riskColor(h.dangerScore), `${h.label} ${h.dangerScore.toFixed(2)} ${h.side}`, !h.inPathCorridor));
    }
    if (on("tracking")) {
      const box = s.lastMeasured ?? truth;
      drawBox(ctx, box, s.source === "predictionOnly" ? colors.amber : colors.green, `target · ${s.source}`);
      drawReticle(ctx, W / 2, H / 2, 16, "rgba(255,230,120,.9)");
      const [fx, fy] = s.filter.vector;
      ctx.strokeStyle = "rgba(255,230,120,.5)";
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(W / 2, H / 2);
      ctx.lineTo(fx, fy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (on("prediction") && s.filter.isInitialized) {
      ctx.save();
      ctx.strokeStyle = colors.cyan;
      ctx.shadowColor = colors.cyan;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3;
      ctx.beginPath();
      s.trail.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
      ctx.restore();
      const future = s.filter.predictFuture(0.4);
      for (let i = 1; i <= 6; i++) {
        const f = s.filter.predictFuture(i * 0.08);
        ctx.fillStyle = `rgba(255,181,71,${1 - i / 8})`;
        ctx.beginPath();
        ctx.arc(f[0], f[1], 5, 0, Math.PI * 2);
        ctx.fill();
      }
      const [px, py, vx, vy, pw, ph] = future;
      drawBox(ctx, [px - pw / 2, py - ph / 2, px + pw / 2, py + ph / 2], colors.amber, "predicted +0.4 s", true);
      ctx.font = '15px "JetBrains Mono", monospace';
      ctx.fillStyle = colors.amber;
      ctx.fillText(`v = (${vx.toFixed(0)}, ${vy.toFixed(0)}) px/s`, px + pw / 2 + 10, py);
    }
    const risk = assessRisk({ pathDanger: summary.pathDanger, trafficThreat: summary.vehicleThreat, hazardProximity: summary.hazardProximity });
    const alert = immediateAlert(risk.eventLevel, summary.topHazard);
    if (layer === "full" && alert) {
      const g = ctx.createLinearGradient(0, H - 80, 0, H);
      g.addColorStop(0, "rgba(4,5,13,0)");
      g.addColorStop(1, "rgba(4,5,13,.92)");
      ctx.fillStyle = g;
      ctx.fillRect(0, H - 90, W, 90);
      ctx.fillStyle = colors.magenta;
      ctx.font = '600 25px "Space Grotesk Variable", sans-serif';
      ctx.fillText(`“${alert}”`, 28, H - 28);
    }
    if (raw) {
      ctx.fillStyle = "rgba(0,0,0,.25)";
      ctx.fillRect(0, 0, W, H);
    }
    if (s.frame % 6 === 0) {
      const [fx, fy] = s.filter.vector;
      setReadout({ source: s.source, conf: s.conf, ex: (fx - W / 2) / W, ey: (fy - H / 2) / H, risk: risk.riskScore, level: risk.eventLevel, alert });
    }
  };

  useAnimationLoop((dt) => {
    const s = sim.current;
    s.t += dt;
    s.acc += dt;
    while (s.acc >= 1 / 30) {
      step();
      s.acc -= 1 / 30;
    }
    render();
  }, running);

  useEffect(() => {
    for (let i = 0; i < 20; i++) step();
    render();
  }, []);
  useEffect(render, [layer]);

  const active = layers.find((l) => l.id === layer)!;
  return (
    <div className="slide see">
      <div className="seeCopy">
        <Kicker act="III" color={colors.cyan}>Experience A</Kicker>
        <h2 className="title" style={{ fontSize: 60 }}>What does <span className="grad">OBSERV-E</span> see?</h2>
        <div className="layerList" role="radiogroup" aria-label="Perception layers">
          {layers.map((l, i) => (
            <button key={l.id} role="radio" aria-checked={layer === l.id} className={`layerButton ${layer === l.id ? "on" : ""}`} style={{ "--lc": l.color } as CSSProperties} onClick={() => setLayer(l.id)}>
              <span className="mono">{String(i + 1).padStart(2, "0")}</span>
              {l.name}
            </button>
          ))}
        </div>
        <p className="body layerExplain" style={{ borderColor: active.color }}>{active.text}</p>
        <div className="readout glass">
          <div><span>source</span><b style={{ color: readout.source === "predictionOnly" ? colors.amber : colors.green }}>{readout.source}</b></div>
          <div><span>confidence</span><b>{readout.conf.toFixed(2)}</b></div>
          <div><span>normError</span><b className="c-amber">({readout.ex.toFixed(3)}, {readout.ey.toFixed(3)})</b></div>
          <div><span>riskScore</span><b style={{ color: readout.level ? colors.amber : colors.green }}>{readout.risk.toFixed(2)} · level {readout.level}</b></div>
        </div>
      </div>
      <Aperture style={{ left: 630, top: 110, width: W, height: H }} provenance="simulated" glow={active.color}>
        <canvas ref={canvas} style={{ width: W, height: H }} aria-label={`Simulated camera view, ${active.name} layer`} />
      </Aperture>
      <div style={{ position: "absolute", left: 630, top: 806, display: "flex", gap: 30, alignItems: "center" }}>
        <PlayControls running={running} onToggle={() => setRunning((v) => !v)} onReset={() => { sim.current = freshState(); render(); }} />
        <p className="faint" style={{ fontSize: 16, margin: 0, maxWidth: "70ch" }}>
          Synthetic scene. Scores come from the repo's hazard and risk formulas running live on simulated boxes.
        </p>
      </div>
    </div>
  );
};
