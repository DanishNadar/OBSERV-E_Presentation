import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { colors } from "../theme";
import { Aperture, Kicker, PlayControls } from "../components/ui";
import { setupCanvas, useAnimationLoop, useMotion } from "../lib/hooks";
import { assessRisk, immediateAlert, riskLevels, scoreHazard, summarizeHazards, type Box, type Hazard } from "../lib/hazards";
import { SpeechPlanner, type SpeechEvent } from "../lib/speechPlanner";
import { colorFor, drawBox, drawCorridor, drawObject, drawPerson, drawStreet, riskColor } from "../lib/draw";

const W = 1040;
const H = 600;

interface Actor { id: string; kind: string; lane: number; distance: number; laneVelocity: number; fixedDistance?: boolean }

// Perspective box for an object at a lane offset and distance
const actorBox = (kind: string, lane: number, distance: number): Box => {
  const horizon = H * 0.36;
  const s = Math.max(0.03, Math.min(1, 1.6 / Math.max(0.8, distance)));
  const feet = horizon + s * (H - horizon);
  const w = 150 * (kind === "car" ? 2.6 : kind === "bicycle" ? 1.7 : kind === "bench" ? 1.6 : kind === "cone" ? 0.6 : 0.95) * s;
  const h = 150 * s * (kind === "car" ? 1.1 : kind === "cone" ? 0.9 : kind === "bench" ? 0.75 : 1.05);
  const cx = W / 2 + lane * (24 + s * W * 0.36);
  return [cx - w / 2, feet - h, cx + w / 2, feet];
};

const scenarios = [
  { id: "obstacle", name: "Obstacle ahead", color: colors.lime, build: (): Actor[] => [{ id: "chair", kind: "chair", lane: 0.08, distance: 11, laneVelocity: 0 }] },
  { id: "vehicle", name: "Bike from the side", color: colors.sky, build: (): Actor[] => [{ id: "bike", kind: "bicycle", lane: -2.6, distance: 3.2, laneVelocity: 0.75, fixedDistance: true }] },
  { id: "blocked", name: "Path blocked", color: colors.violet, build: (): Actor[] => [
    { id: "bench", kind: "bench", lane: -0.35, distance: 6, laneVelocity: 0 },
    { id: "cone", kind: "cone", lane: 0.32, distance: 5.2, laneVelocity: 0 },
    { id: "chair2", kind: "chair", lane: 0.02, distance: 6.6, laneVelocity: 0 },
  ] },
  { id: "clear", name: "Danger clears", color: colors.green, build: (): Actor[] => [] },
];

const fresh = () => ({ t: 0, actors: scenarios[0].build(), planner: new SpeechPlanner(), speech: [] as (SpeechEvent & { at: number })[], tick: 0 });

export const Hazards = () => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { reducedMotion } = useMotion();
  const [running, setRunning] = useState(!reducedMotion);
  const [scenario, setScenario] = useState("obstacle");
  const [view, setView] = useState({ hazards: [] as Hazard[], risk: 0, level: 0, speech: [] as (SpeechEvent & { at: number })[], suppressed: null as string | null });
  const sim = useRef(fresh());

  const evaluate = () => {
    const hazards = sim.current.actors.map((a) => scoreHazard({ label: a.kind, confidence: 0.82, box: actorBox(a.kind, a.lane, a.distance) }, W, H));
    const summary = summarizeHazards(hazards);
    const risk = assessRisk({ pathDanger: summary.pathDanger, trafficThreat: summary.vehicleThreat, hazardProximity: summary.hazardProximity });
    return { summary, risk };
  };

  const step = (dt: number) => {
    const s = sim.current;
    s.t += dt;
    s.actors.forEach((a) => {
      if (!a.fixedDistance) a.distance = Math.max(2.1, a.distance - dt * 1.1);
      a.lane += a.laneVelocity * dt;
    });
    s.actors = s.actors.filter((a) => Math.abs(a.lane) < 3.2);
    s.tick += dt;
    if (s.tick < 0.1) return;
    s.tick = 0;
    const { summary, risk } = evaluate();
    const said = s.planner.update({ targetLocked: true, eventLevel: risk.eventLevel, topHazard: summary.topHazard, pathDanger: summary.pathDanger, trafficThreat: summary.vehicleThreat, immediateAlert: immediateAlert(risk.eventLevel, summary.topHazard) }, s.t);
    if (said) s.speech = [...s.speech.slice(-3), { ...said, at: s.t }];
    setView({ hazards: summary.hazards, risk: risk.riskScore, level: risk.eventLevel, speech: s.speech, suppressed: s.planner.lastSuppression });
  };

  const render = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx = setupCanvas(c, W, H);
    const s = sim.current;
    const horizon = drawStreet(ctx, W, H, s.t * 0.55);
    drawCorridor(ctx, W, H, horizon);
    [...s.actors].sort((a, b) => b.distance - a.distance).forEach((a) => drawObject(ctx, a.kind, actorBox(a.kind, a.lane, a.distance), 0.92, s.t * 6));
    drawPerson(ctx, W / 2 - 230 + Math.sin(s.t * 0.6) * 12, H - 20, 230, s.t * 5, "rgba(242,245,255,.6)");
    evaluate().summary.hazards.forEach((h) => drawBox(ctx, h.box, riskColor(h.dangerScore), `${h.label} ${h.dangerScore.toFixed(2)}`, !h.inPathCorridor));
  };

  useAnimationLoop((dt) => {
    step(dt);
    render();
  }, running);
  useEffect(() => {
    for (let i = 0; i < 30; i++) step(1 / 30);
    render();
  }, []);

  const pick = (id: string) => {
    setScenario(id);
    sim.current.actors = scenarios.find((s) => s.id === id)!.build();
  };

  const latest = view.speech[view.speech.length - 1];
  const levelName = view.level ? riskLevels[view.level - 1].name : "Normal";
  const levelColor = view.level >= 2 ? colors.red : view.level === 1 ? colors.amber : colors.green;
  return (
    <div className="slide hazards">
      <div className="hazardHead">
        <Kicker act="V" color={colors.red}>Experience D</Kicker>
        <h2 className="title" style={{ fontSize: 58 }}>How are <span className="grad" style={{ "--g1": colors.amber, "--g2": colors.red, "--g3": colors.magenta } as CSSProperties}>hazards evaluated?</span></h2>
      </div>
      <Aperture style={{ left: 112, top: 250, width: W, height: H }} provenance="simulated" provenanceText="Simulated, repo scoring and speech rules" glow={levelColor}>
        <canvas ref={canvas} style={{ width: W, height: H }} aria-label="Simulated walkway with hazards" />
      </Aperture>
      <div className="scenarioBar">
        <div className="controlBar">
          {scenarios.map((s) => (
            <button key={s.id} className={`chip ${scenario === s.id ? "on" : ""}`} style={{ "--chipc": s.color } as CSSProperties} onClick={() => pick(s.id)}>{s.name}</button>
          ))}
        </div>
        <PlayControls running={running} onToggle={() => setRunning((v) => !v)} onReset={() => { sim.current = fresh(); setScenario("obstacle"); }} />
      </div>
      <div className="hazardPanel">
        <div className="hazardCards">
          {view.hazards.length === 0 && <p className="faint" style={{ fontSize: 19 }}>No objects detected</p>}
          {view.hazards.map((h, i) => (
            <div key={i} className="hazardCard glass" style={{ "--oc": colorFor(h.label), "--rc": riskColor(h.dangerScore) } as CSSProperties}>
              <span className="hzName">{h.label}{h.inPathCorridor && <em>in path</em>}</span>
              <span className="hzMeta mono">{h.side} · prox {h.distanceScore.toFixed(2)}</span>
              <span className="hzDanger mono">{h.dangerScore.toFixed(2)}</span>
              <span className="hzBar"><i style={{ width: `${h.dangerScore * 100}%` }} /></span>
            </div>
          ))}
        </div>
        <div className="riskMini glass">
          <span>Risk score</span>
          <div className="riskTrack">
            <i style={{ width: `${view.risk * 100}%`, background: levelColor, boxShadow: `0 0 16px ${levelColor}` }} />
            {riskLevels.map((l) => <b key={l.level} style={{ left: `${l.value * 100}%` }} />)}
          </div>
          <span className="mono" style={{ color: levelColor }}>{view.risk.toFixed(2)} {levelName}</span>
        </div>
        <div className="speechBox glass" aria-live="polite">
          <span className="faint" style={{ fontSize: 15 }}>
            <Volume2 size={15} style={{ verticalAlign: -2 }} /> Narration{latest ? `, priority ${latest.priority}, ${latest.eventType}` : ""}
          </span>
          <AnimatePresence mode="wait">
            <motion.p key={latest ? latest.at : "none"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {latest ? `“${latest.text}”` : "Waiting for something worth saying."}
            </motion.p>
          </AnimatePresence>
          {view.suppressed && <span className="suppressed">Staying quiet: {view.suppressed}</span>}
        </div>
        <p className="callout red" style={{ fontSize: 16 }}>
          Proximity comes from box size and height in a single camera image, with no depth sensor. It's a coarse heuristic: a large object far away and a small one close by can score alike.
        </p>
      </div>
    </div>
  );
};
