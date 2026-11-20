import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { colors } from "../theme";
import { Aperture, Kicker } from "../components/ui";
import { setupCanvas, useAnimationLoop, useMotion } from "../lib/hooks";
import { assessRisk, scoreHazard, summarizeHazards, type Box } from "../lib/hazards";
import { drawBox, drawObject, drawPerson, drawReticle, drawStreet } from "../lib/draw";

const W = 1100;
const H = 560;

const subsystems = [
  { name: "Camera", color: colors.cyan }, { name: "Detector", color: colors.cyan }, { name: "Tracker", color: colors.green },
  { name: "Kalman", color: colors.amber }, { name: "Gimbal", color: colors.orange }, { name: "Hazards", color: colors.red },
  { name: "Risk", color: colors.red }, { name: "Speech", color: colors.magenta }, { name: "Voice", color: colors.violet },
];

const steps = [
  { title: "The walk begins", detail: "Frames flow in. No one is locked yet, so the detector runs every frame.", active: ["Camera", "Detector"], locked: false, searching: true, transition: "measurementSource: none" },
  { title: "Tracking acquired", detail: "The person nearest the centre wins the first lock. The filter initializes and the gimbal starts following.", active: ["Camera", "Detector", "Tracker", "Kalman", "Gimbal"], locked: true, transition: "none → detector, targetLocked: true" },
  { title: "Something enters the scene", detail: "A bicycle appears on the far left. The hazard pass sees it, but it’s off the path and low risk.", active: ["Camera", "Tracker", "Kalman", "Gimbal", "Hazards"], locked: true, bike: { from: -3, to: -2.3, distance: 3.6 }, transition: "hazards: 1, below speech threshold" },
  { title: "The hazard is classified", detail: "Vehicle class, left side, growing in the frame. Traffic threat rises with the side boost.", active: ["Hazards", "Risk", "Kalman", "Gimbal"], locked: true, bike: { from: -2.3, to: -1.5, distance: 3.2 }, transition: "trafficThreat ↑" },
  { title: "Risk rises", detail: "Traffic carries a 0.18 weight, so a lone bicycle lifts the risk score without necessarily crossing the 0.33 caution line. The warning that follows comes from the hazard itself.", active: ["Hazards", "Risk"], locked: true, bike: { from: -1.5, to: -1, distance: 3 }, transition: "riskScore ↑" },
  { title: "A short warning", detail: "A new vehicle hazard from the side: the planner picks the traffic template at priority 82 or 96 and it goes to the voice app.", active: ["Risk", "Speech", "Voice"], locked: true, bike: { from: -1, to: -0.4, distance: 3 }, speech: "Heads up. I see a bicycle coming from your left side.", transition: "speech: trafficThreat" },
  { title: "The situation changes", detail: "The bike crosses and leaves the frame on the right. Risk falls back.", active: ["Hazards", "Risk", "Tracker", "Kalman"], locked: true, bike: { from: 0.6, to: 3.4, distance: 3 }, transition: "riskScore ↓, hazards: 0" },
  { title: "OBSERV-E updates", detail: "After a second of calm, the planner confirms the path is clear, then goes quiet again.", active: ["Speech", "Voice", "Tracker", "Gimbal"], locked: true, speech: "Okay, that immediate obstacle is no longer in your path.", transition: "speech: pathClear" },
];

export const Scenario = () => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { reducedMotion } = useMotion();
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const [metrics, setMetrics] = useState({ risk: 0, traffic: 0 });
  const progress = useRef(0);
  const clock = useRef(0);
  const step = steps[index];

  useEffect(() => {
    progress.current = 0;
  }, [index]);

  const render = (dt: number) => {
    const c = canvas.current;
    if (!c) return;
    clock.current += dt;
    progress.current = Math.min(1, progress.current + dt / 3);
    const k = progress.current;
    const t = clock.current;
    const ctx = setupCanvas(c, W, H);
    drawStreet(ctx, W, H, t * 0.5);
    const walkerX = W / 2 + Math.sin(t * 0.7) * 40;
    let summary = summarizeHazards([]);
    if (step.bike) {
      const lane = step.bike.from + (step.bike.to - step.bike.from) * k;
      const s = 1.6 / step.bike.distance;
      const horizon = H * 0.36;
      const feet = horizon + s * (H - horizon);
      const bw = 150 * 1.7 * s;
      const bh = 150 * s * 1.05;
      const cx = W / 2 + lane * (24 + s * W * 0.36);
      const box: Box = [cx - bw / 2, feet - bh, cx + bw / 2, feet];
      drawObject(ctx, "bicycle", box, 0.92, t * 6);
      const hz = scoreHazard({ label: "bicycle", confidence: 0.8, box }, W, H);
      summary = summarizeHazards([hz]);
      if (box[2] > 0 && box[0] < W) drawBox(ctx, box, hz.dangerScore > 0.7 ? colors.red : colors.amber, `bicycle ${hz.dangerScore.toFixed(2)} ${hz.side}`);
    }
    drawPerson(ctx, walkerX, H - 20, 280, t * 5, "rgba(242,245,255,.92)");
    if (step.locked) {
      drawBox(ctx, [walkerX - 64, H - 310, walkerX + 64, H - 14], colors.green, "target locked", false, true);
      drawReticle(ctx, W / 2, H / 2, 14, "rgba(255,230,120,.85)");
    } else if (step.searching) {
      const sweep = (Math.sin(t * 2) * 0.5 + 0.5) * W;
      const g = ctx.createLinearGradient(sweep - 70, 0, sweep + 70, 0);
      g.addColorStop(0, "rgba(63,224,255,0)");
      g.addColorStop(0.5, "rgba(63,224,255,.16)");
      g.addColorStop(1, "rgba(63,224,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(sweep - 70, 0, 140, H);
      ctx.fillStyle = colors.cyan;
      ctx.font = '600 21px "Space Grotesk Variable"';
      ctx.fillText("Searching for a person…", 24, 38);
    }
    const risk = assessRisk({ trafficThreat: summary.vehicleThreat, pathDanger: summary.pathDanger, hazardProximity: summary.hazardProximity });
    setMetrics((m) => (Math.abs(m.risk - risk.riskScore) > 0.005 ? { risk: risk.riskScore, traffic: summary.vehicleThreat } : m));
    if (autoplay && progress.current >= 1) {
      progress.current = 0;
      setIndex((i) => (i + 1) % steps.length);
    }
  };

  useAnimationLoop(render, !reducedMotion || autoplay);
  useEffect(() => render(0.016), [index]);

  return (
    <div className="slide scenario">
      <div className="scenarioHead">
        <div>
          <Kicker act="VII" color={colors.cyan}>Experience F</Kicker>
          <h2 className="title" style={{ fontSize: 56, marginBottom: 0 }}>The full system <span className="grad">in motion.</span></h2>
        </div>
        <div className="controlBar">
          <button className="chip" onClick={() => setIndex((i) => Math.max(0, i - 1))} aria-label="Previous step"><ChevronLeft size={18} /> Back</button>
          <button className={`chip ${autoplay ? "on" : ""}`} onClick={() => setAutoplay((v) => !v)}>{autoplay ? <Pause size={18} /> : <Play size={18} />} {autoplay ? "Pause" : "Play through"}</button>
          <button className="chip" onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))} aria-label="Next step">Next step <ChevronRight size={18} /></button>
        </div>
      </div>
      <ol className="stepRail">
        {steps.map((s, i) => (
          <li key={s.title}>
            <button className={`stepDot ${i === index ? "on" : ""} ${i < index ? "done" : ""}`} onClick={() => setIndex(i)} aria-current={i === index ? "step" : undefined}>
              <span className="mono">{i + 1}</span>
              <span className="stepName">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <Aperture style={{ left: 112, top: 330, width: W, height: H }} provenance="illustrative" provenanceText="Illustrative scenario, not a safety validation" glow={step.speech ? colors.magenta : colors.cyan}>
        <canvas ref={canvas} style={{ width: W, height: H }} aria-label={`Scenario step ${index + 1}: ${step.title}`} />
        <AnimatePresence>
          {step.speech && (
            <motion.div key={step.speech} className="speechBubble scenarioSpeech" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.5 }}>
              “{step.speech}”
            </motion.div>
          )}
        </AnimatePresence>
      </Aperture>
      <div className="scenarioSide">
        <motion.div key={index} initial={reducedMotion ? false : { opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}>
          <h3>{step.title}</h3>
          <p className="body" style={{ fontSize: 21 }}>{step.detail}</p>
          <p className="mono c-amber" style={{ fontSize: 17 }}>{step.transition}</p>
        </motion.div>
        <div className="subsystemGrid">
          {subsystems.map((s) => (
            <div key={s.name} className={`subsystem ${step.active.includes(s.name) ? "on" : ""}`} style={{ "--sc": s.color } as CSSProperties}>{s.name}</div>
          ))}
        </div>
        <div className="scenarioMetrics mono">
          <span className="glass">trafficThreat <b>{metrics.traffic.toFixed(2)}</b></span>
          <span className="glass">riskScore <b className={metrics.risk >= 0.33 ? "c-amber" : "c-green"}>{metrics.risk.toFixed(2)}</b></span>
        </div>
      </div>
    </div>
  );
};
