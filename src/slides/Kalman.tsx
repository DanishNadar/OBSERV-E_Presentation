import { useEffect, useRef, useState, type CSSProperties } from "react";
import { colors, alpha } from "../theme";
import { Aperture, Kicker, Legend, PlayControls, Slider } from "../components/ui";
import { setupCanvas, useAnimationLoop, useMotion } from "../lib/hooks";
import { KalmanFilter } from "../lib/kalman";
import { seededRandom } from "../lib/random";

const W = 1160;
const H = 640;
const detectorHz = 15;

// Figure-eight-ish synthetic walk
const truthAt = (t: number, speed: number): [number, number] => {
  const p = t * speed;
  return [W / 2 + Math.sin(p * 0.55) * 420 + Math.sin(p * 1.7) * 40, H / 2 + Math.sin(p * 1.1 + 0.6) * 200];
};

const fresh = () => ({
  t: 0,
  sinceMeasure: 0,
  filter: new KalmanFilter(),
  random: seededRandom(3),
  measurements: [] as { x: number; y: number; t: number }[],
  truthTrail: [] as [number, number][],
  filterTrail: [] as [number, number][],
  errors: [] as { raw: number; filtered: number; t: number }[],
  dropoutUntil: -1,
});

export const Kalman = () => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { reducedMotion } = useMotion();
  const [running, setRunning] = useState(!reducedMotion);
  const [noise, setNoise] = useState(24);
  const [speed, setSpeed] = useState(1);
  const [lead, setLead] = useState(250);
  const [showSigma, setShowSigma] = useState(true);
  const [tunedQ, setTunedQ] = useState(true);
  const [stats, setStats] = useState({ raw: 0, filtered: 0, lost: false });
  const sim = useRef(fresh());

  const advance = (dt: number) => {
    const s = sim.current;
    s.t += dt;
    s.sinceMeasure += dt;
    const truth = truthAt(s.t, speed);
    s.truthTrail.push(truth);
    if (s.truthTrail.length > 220) s.truthTrail.shift();
    if (s.sinceMeasure >= 1 / detectorHz) {
      const elapsed = s.sinceMeasure;
      s.sinceMeasure = 0;
      s.filter.config.measurementNoisePosition = Math.max(10, noise * noise);
      s.filter.config.processNoiseVelocity = tunedQ ? 1e4 : 25;
      s.filter.predict(elapsed);
      if (s.t >= s.dropoutUntil) {
        const mx = truth[0] + s.random.gaussian() * noise;
        const my = truth[1] + s.random.gaussian() * noise;
        s.filter.update(mx, my, 80, 160);
        s.measurements.push({ x: mx, y: my, t: s.t });
        const [fx, fy] = s.filter.vector;
        s.errors.push({ raw: Math.hypot(mx - truth[0], my - truth[1]), filtered: Math.hypot(fx - truth[0], fy - truth[1]), t: s.t });
      }
      if (s.measurements.length > 40) s.measurements.shift();
      while (s.errors.length && s.errors[0].t < s.t - 3) s.errors.shift();
    }
    const est = s.filter.isInitialized ? s.filter.predictFuture(s.sinceMeasure) : truth;
    s.filterTrail.push([est[0], est[1]]);
    if (s.filterTrail.length > 220) s.filterTrail.shift();
  };

  const trail = (ctx: CanvasRenderingContext2D, pts: [number, number][], color: string, width: number) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
  };

  const render = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx = setupCanvas(c, W, H);
    const s = sim.current;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(122,125,255,.08)";
    for (let x = 0; x < W; x += 58) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 58) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    trail(ctx, s.truthTrail, "rgba(238,243,250,.4)", 2);
    trail(ctx, s.filterTrail, colors.green, 3.5);
    s.measurements.forEach((m) => {
      const age = s.t - m.t;
      ctx.fillStyle = alpha(colors.cyan, Math.max(0, 1 - age / 2.5));
      ctx.beginPath();
      ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    const truth = s.truthTrail[s.truthTrail.length - 1];
    if (truth) {
      ctx.save();
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#fff";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(truth[0], truth[1], 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (s.filter.isInitialized) {
      const now = s.filter.predictFuture(s.sinceMeasure);
      const ahead = s.filter.predictFuture(s.sinceMeasure + lead / 1000);
      if (showSigma) {
        const [sx, sy] = s.filter.positionSigma;
        const g = ctx.createRadialGradient(now[0], now[1], 0, now[0], now[1], Math.min(400, 2 * Math.max(sx, sy)));
        g.addColorStop(0, "rgba(255,181,71,.18)");
        g.addColorStop(1, "rgba(255,181,71,.02)");
        ctx.fillStyle = g;
        ctx.strokeStyle = "rgba(255,181,71,.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(now[0], now[1], Math.min(400, 2 * sx), Math.min(400, 2 * sy), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.save();
      ctx.setLineDash([8, 7]);
      ctx.strokeStyle = colors.amber;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(now[0], now[1]);
      ctx.lineTo(ahead[0], ahead[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 16;
      ctx.shadowColor = colors.green;
      ctx.fillStyle = colors.green;
      ctx.beginPath();
      ctx.arc(now[0], now[1], 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = colors.amber;
      ctx.strokeStyle = colors.amber;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ahead[0], ahead[1], 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      const future = truthAt(s.t + lead / 1000, speed);
      ctx.strokeStyle = "rgba(238,243,250,.45)";
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(future[0], future[1], 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (s.t < s.dropoutUntil) {
      ctx.fillStyle = colors.red;
      ctx.font = '600 22px "Space Grotesk Variable"';
      ctx.fillText("No detections: the filter is coasting on its velocity estimate", 24, 40);
    }
  };

  const updateStats = () => {
    const s = sim.current;
    const rms = (key: "raw" | "filtered") => Math.sqrt(s.errors.reduce((a, e) => a + e[key] ** 2, 0) / Math.max(1, s.errors.length));
    setStats({ raw: rms("raw"), filtered: rms("filtered"), lost: s.t < s.dropoutUntil });
  };

  const tickCount = useRef(0);
  useAnimationLoop((dt) => {
    advance(dt);
    render();
    if (++tickCount.current % 6 === 0) updateStats();
  }, running);

  useEffect(() => {
    for (let i = 0; i < 90; i++) advance(1 / 60);
    render();
    updateStats();
  }, []);

  const improvement = stats.raw > 0 ? Math.max(0, 1 - stats.filtered / stats.raw) : 0;
  return (
    <div className="slide kalman">
      <Aperture style={{ left: 112, top: 96, width: W, height: H }} provenance="simulated" provenanceText="Simulated, repo filter ported to TypeScript" glow={colors.green}>
        <canvas ref={canvas} style={{ width: W, height: H }} aria-label="Kalman filter tracking a moving target" />
      </Aperture>
      <Legend
        style={{ position: "absolute", left: 112, top: 760 }}
        items={[
          { label: "Actual position", color: "#eef3fa" },
          { label: "Noisy detections, 15 Hz", color: colors.cyan },
          { label: "Filtered estimate", color: colors.green },
          { label: "Predicted at lead time", color: colors.amber },
          { label: "2σ uncertainty", color: "rgba(255,181,71,.45)" },
        ]}
      />
      <div className="errorCompare">
        <div className="glass" style={{ "--ec": colors.cyan } as CSSProperties}><b className="mono">{stats.raw.toFixed(1)}<small> px</small></b><span>raw detection error (RMS)</span></div>
        <div className="glass" style={{ "--ec": colors.green } as CSSProperties}><b className="mono">{stats.filtered.toFixed(1)}<small> px</small></b><span>filtered error (RMS)</span></div>
        <div className="glass" style={{ "--ec": colors.violet } as CSSProperties}><b className="mono">{Math.round(improvement * 100)}<small>%</small></b><span>less error, this run</span></div>
      </div>

      <div className="kalmanSide">
        <Kicker act="IV" color={colors.amber}>Experience B</Kicker>
        <h2 className="title" style={{ fontSize: 56 }}>Why <span className="grad" style={{ "--g1": colors.green, "--g2": colors.amber } as CSSProperties}>predict motion?</span></h2>
        <p className="body" style={{ fontSize: 20 }}>
          Detections are noisy and late. The filter weighs them against a constant-velocity model, then projects forward so the camera can lead the person instead of chasing them.
        </p>
        <div className="sliders">
          <Slider label="Detector noise" value={noise} min={2} max={60} step={1} onChange={setNoise} format={(v) => `σ ${v} px`} accent={colors.cyan} />
          <Slider label="Subject speed" value={speed} min={0.3} max={2.5} step={0.1} onChange={setSpeed} format={(v) => `${v.toFixed(1)}×`} accent={colors.green} />
          <Slider label="Prediction lead" value={lead} min={0} max={800} step={10} onChange={setLead} format={(v) => `${v} ms`} accent={colors.amber} />
        </div>
        <div className="controlBar">
          <button className={`chip red ${stats.lost ? "on" : ""}`} onClick={() => { sim.current.dropoutUntil = sim.current.t + 1.5; }}>Drop tracking 1.5 s</button>
          <button className={`chip amber ${showSigma ? "on" : ""}`} onClick={() => setShowSigma((v) => !v)} aria-pressed={showSigma}>Uncertainty</button>
        </div>
        <div className="controlBar" style={{ marginTop: 10 }}>
          <button className={`chip green ${tunedQ ? "on" : ""}`} onClick={() => setTunedQ(true)}>Q tuned for this motion</button>
          <button className={`chip amber ${tunedQ ? "" : "on"}`} onClick={() => setTunedQ(false)}>Q from repo config</button>
        </div>
        <div style={{ marginTop: 14 }}>
          <PlayControls running={running} onToggle={() => setRunning((v) => !v)} onReset={() => { sim.current = fresh(); render(); }} />
        </div>
        <p className="callout" style={{ marginTop: 16, fontSize: 16 }}>
          Long leads overshoot on curves and the estimate drifts during dropouts. With the repo's stiff process noise, this fast synthetic target makes the filter lag: tuning matters. Prediction buys time; it doesn't replace seeing.
        </p>
      </div>
    </div>
  );
};
