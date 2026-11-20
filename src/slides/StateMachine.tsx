import { useRef, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { Footprints, Hand, HeartPulse, Megaphone, RotateCcw, ShieldCheck, Bike, UserRound } from "lucide-react";
import { colors } from "../theme";
import { Kicker, ProvenanceTag } from "../components/ui";
import { useAnimationLoop, useMotion } from "../lib/hooks";
import { assessRisk, riskLevels, type Hazard } from "../lib/hazards";
import { SpeechPlanner } from "../lib/speechPlanner";

type Track = "searching" | "acquiring" | "locked" | "coasting" | "lost";
type Arbiter = "listening" | "candidates" | "hold" | "speaking" | "cooldown";

// Node layout in a 1280 x 720 diagram
const trackNodes: Record<Exclude<Track, "locked">, { x: number; y: number; label: string; sub: string; color: string }> = {
  searching: { x: 120, y: 150, label: "Searching", sub: "detector every frame", color: colors.red },
  acquiring: { x: 350, y: 70, label: "Acquiring", sub: "0.65·centre + 0.35·conf", color: colors.cyan },
  coasting: { x: 1120, y: 80, label: "Coasting", sub: "prediction only", color: colors.amber },
  lost: { x: 1120, y: 225, label: "Lost", sub: "reset tracker + filter", color: colors.magenta },
};
const lockedBox = { x: 545, y: 28, w: 400, h: 240 };

const levelNodes = [
  { level: 0, label: "Normal", sub: "follow quietly", color: colors.green },
  { level: 1, label: "Caution", sub: "≥ 0.33", color: colors.amber },
  { level: 2, label: "Check-in", sub: "≥ 0.52 · p110", color: colors.orange },
  { level: 3, label: "Contact", sub: "≥ 0.72 · p115 · log", color: colors.red },
  { level: 4, label: "Emergency", sub: "≥ 0.88 · p120 · log", color: colors.magenta },
].map((n, i) => ({ ...n, x: 130 + i * 255, y: 400 }));

const arbiterNodes: { id: Arbiter; label: string; sub: string; color: string }[] = [
  { id: "listening", label: "Listening", sub: "watch for change", color: colors.sky },
  { id: "candidates", label: "Rank", sub: "highest priority wins", color: colors.indigo },
  { id: "hold", label: "Hold", sub: "1.2 s gap · 0.55 urgent", color: colors.amber },
  { id: "speaking", label: "Speaking", sub: "to the voice companion", color: colors.magenta },
  { id: "cooldown", label: "Cooldown", sub: "per-key repeat limits", color: colors.violet },
];
const arbiterPos = arbiterNodes.map((n, i) => ({ ...n, x: 130 + i * 255, y: 625 }));

const bike: Hazard = { label: "bicycle", confidence: 0.84, box: [0, 0, 1, 1], distanceScore: 0.7, side: "left", inPathCorridor: true, dangerScore: 0.86 };

interface LogEntry { t: number; text: string; color: string }

interface EdgeProps { id: string; d: string; color: string; label?: string; lx?: number; ly?: number; liveId: string; animate: boolean }

// Transition path; glows and carries a fast token while it is the live transition
const BsmEdge = ({ id, d, color, label, lx, ly, liveId, animate }: EdgeProps) => {
  const live = liveId === id;
  return (
  <g>
    <path id={`bsm-${id}`} d={d} fill="none" stroke={live ? color : "rgba(190,205,255,.24)"} strokeWidth={live ? 4 : 1.8} markerEnd="url(#bsmArrow)" filter={live ? "url(#bsmGlow)" : undefined} />
    {animate && (
      <circle r={live ? 8 : 3} fill={color} opacity={live ? 1 : 0.35}>
        <animateMotion dur={live ? "0.7s" : "3s"} repeatCount="indefinite"><mpath href={`#bsm-${id}`} /></animateMotion>
      </circle>
    )}
    {label && <text x={lx} y={ly} textAnchor="middle" fontSize="14" fontFamily="JetBrains Mono" fill={live ? "#fff" : "rgba(190,205,255,.6)"}>{label}</text>}
  </g>
  );
};

const Node = ({ x, y, label, sub, color, on, w = 210 }: { x: number; y: number; label: string; sub: string; color: string; on: boolean; w?: number }) => (
  <g className={`bsmNode ${on ? "on" : ""}`} filter={on ? "url(#bsmGlow)" : undefined}>
    <rect x={x - w / 2} y={y - 34} width={w} height="68" rx="20" fill={on ? color : "rgba(10,13,32,.9)"} stroke={color} strokeWidth={on ? 0 : 1.8} />
    <text x={x} y={y - 3} textAnchor="middle" fontSize="21" fontWeight="600" fontFamily="Space Grotesk Variable" fill={on ? "#04050d" : color}>{label}</text>
    <text x={x} y={y + 20} textAnchor="middle" fontSize="13" fontFamily="JetBrains Mono" fill={on ? "rgba(4,5,13,.75)" : "rgba(190,205,255,.6)"}>{sub}</text>
  </g>
);

const fresh = () => ({
  t: 0,
  acc: 0,
  track: "locked" as Track,
  sub: "detect" as "detect" | "track",
  visible: true,
  lost: 0,
  timer: 0,
  bikeUntil: -1,
  fall: false,
  immobility: 0,
  voiceHelp: 0,
  checkInAt: null as number | null,
  okayAt: -99,
  lastLevel: 0,
  lastOutreach: -99,
  planner: new SpeechPlanner(),
  speakingUntil: -1,
  line: null as null | { text: string; priority: number; type: string },
  log: [] as LogEntry[],
  liveEdge: "",
  edgeUntil: -1,
});

export const StateMachine = () => {
  const { reducedMotion } = useMotion();
  const sim = useRef(fresh());
  const [, setFrame] = useState(0);

  const log = (text: string, color: string) => {
    const s = sim.current;
    s.log = [...s.log.slice(-3), { t: s.t, text, color }];
  };
  const edge = (id: string) => {
    sim.current.liveEdge = id;
    sim.current.edgeUntil = sim.current.t + 1.4;
  };

  // 10 Hz tick through all three regions
  const tick = () => {
    const s = sim.current;
    const dt = 0.1;
    s.t += dt;
    s.timer += dt;
    const prevTrack = s.track;
    switch (s.track) {
      case "searching":
        if (s.visible) { s.track = "acquiring"; s.timer = 0; edge("search-acq"); log("Person detected → scoring first lock", colors.cyan); }
        break;
      case "acquiring":
        if (!s.visible) { s.track = "searching"; s.timer = 0; }
        else if (s.timer > 0.6) { s.track = "locked"; s.timer = 0; edge("acq-lock"); log("Lock acquired · Kalman initialised", colors.green); }
        break;
      case "locked":
        s.sub = s.sub === "detect" ? "track" : "detect";
        if (!s.visible) { s.track = "coasting"; s.lost = 0; edge("lock-coast"); log("No measurement → coasting on velocity", colors.amber); }
        break;
      case "coasting":
        s.lost += 3;
        if (s.visible) { s.track = "locked"; edge("coast-lock"); log("Re-detected inside the gate", colors.green); }
        else if (s.lost > 20) { s.track = "lost"; s.timer = 0; edge("coast-lost"); log("Lost > 20 frames → release lock", colors.magenta); }
        break;
      case "lost":
        if (s.timer > 0.7) { s.track = "searching"; s.timer = 0; edge("lost-search"); log("Tracker + filter reset", colors.red); }
        break;
    }
    if (prevTrack !== s.track) setFrame((f) => f + 1);

    // Risk signals
    const bikeActive = s.t < s.bikeUntil;
    s.immobility = s.fall ? Math.min(0.9, s.immobility + dt * 0.45) : Math.max(0, s.immobility - dt);
    const nonResponse = s.checkInAt !== null ? Math.min(1, (s.t - s.checkInAt) / 10) : 0;
    const signals = {
      fallScore: s.fall ? 0.9 : 0,
      immobility: s.immobility,
      voiceHelp: s.voiceHelp,
      nonResponse,
      trafficThreat: bikeActive ? 0.95 : 0,
      pathDanger: bikeActive ? 0.6 : 0,
      hazardProximity: bikeActive ? 0.7 : s.fall ? 0.3 : 0,
    };
    const risk = assessRisk(signals);
    if (risk.eventLevel !== s.lastLevel) {
      edge(`lvl-${s.lastLevel}-${risk.eventLevel}`);
      log(`Risk ${risk.riskScore.toFixed(2)} → level ${risk.eventLevel}${risk.reasons.length ? ` (${risk.reasons.join(", ")})` : ""}`, levelNodes[risk.eventLevel].color);
      if (risk.eventLevel >= 2 && s.lastLevel < 2 && s.checkInAt === null) s.checkInAt = s.t;
      if (risk.eventLevel >= 3 && s.t - s.lastOutreach >= 30) { s.lastOutreach = s.t; log("outreach.py: escalation logged, no call placed", colors.red); }
      s.lastLevel = risk.eventLevel;
    }

    // Speech arbitration with the real planner
    const targetLocked = s.track === "locked" || s.track === "coasting";
    const chosen = s.planner.update({ targetLocked, eventLevel: risk.eventLevel, topHazard: bikeActive ? bike : null, pathDanger: signals.pathDanger, trafficThreat: signals.trafficThreat, nonResponse }, s.t);
    if (chosen) {
      s.line = { text: chosen.text, priority: chosen.priority, type: chosen.eventType };
      s.speakingUntil = s.t + Math.max(1.6, chosen.text.split(" ").length / 2.8);
      log(`Speak p${chosen.priority}: ${chosen.eventType}`, colors.magenta);
    } else if (s.planner.lastSuppression?.startsWith("held") && !s.log.at(-1)?.text.startsWith("Held")) log(`Held: ${s.planner.lastSuppression.replace("held: ", "")}`, colors.amber);
    return { risk, nonResponse };
  };

  const [snapshot, setSnapshot] = useState({ risk: assessRisk({}), nonResponse: 0 });
  useAnimationLoop((dt) => {
    const s = sim.current;
    s.acc += dt;
    let last = null;
    while (s.acc >= 0.1) {
      last = tick();
      s.acc -= 0.1;
    }
    if (last) setSnapshot(last);
  }, true);

  const s = sim.current;
  const arbiter: Arbiter = s.t < s.speakingUntil ? "speaking" : s.planner.lastSuppression?.startsWith("held") ? "hold" : s.t < s.speakingUntil + 1.2 ? "cooldown" : s.planner.lastCandidates.length ? "candidates" : "listening";
  const level = snapshot.risk.eventLevel;

  const fire = (name: string, apply: () => void, color: string) => {
    apply();
    log(`Event: ${name}`, color);
    setFrame((f) => f + 1);
  };

  const events = [
    { name: "Walks behind a pillar", icon: Footprints, color: colors.amber, apply: () => { s.visible = false; } },
    { name: "Steps back into view", icon: UserRound, color: colors.green, apply: () => { s.visible = true; } },
    { name: "Bike crosses the path", icon: Bike, color: colors.sky, apply: () => { s.bikeUntil = s.t + 5; } },
    { name: "Fall detected", icon: HeartPulse, color: colors.orange, apply: () => { s.fall = true; } },
    { name: "Says “help”", icon: Megaphone, color: colors.red, apply: () => { s.voiceHelp = 1; } },
    { name: "Says “I am okay”", icon: ShieldCheck, color: colors.cyan, apply: () => { s.fall = false; s.voiceHelp = 0; s.checkInAt = null; s.immobility = 0; } },
  ];

  const liveId = s.t < s.edgeUntil ? s.liveEdge : "";

  const tn = trackNodes;
  const lb = lockedBox;
  return (
    <div className="slide bsm">
      <div className="bsmHead">
        <div>
          <Kicker act="III" color={colors.magenta}>Behaviour model</Kicker>
          <h2 className="title" style={{ fontSize: 46, marginBottom: 0, maxWidth: 1500 }}>
            Three state machines run at once: <span className="c-green">who</span>, <span className="c-amber">how worried</span>, <span className="c-magenta">what to say.</span>
          </h2>
        </div>
      </div>

      <div className="bsmStage">
        <ProvenanceTag kind="illustrative" text="Composite of repo logic, simplified names" />
        <svg viewBox="0 0 1280 720" width="1280" height="720" role="img" aria-label="OBSERV-E behaviour state machine">
          <defs>
            <marker id="bsmArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="rgba(190,205,255,.6)" />
            </marker>
            <filter id="bsmGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <linearGradient id="riskGrad" x1="0" x2="1">
              <stop offset="0" stopColor={colors.green} /><stop offset="0.4" stopColor={colors.amber} /><stop offset="0.75" stopColor={colors.red} /><stop offset="1" stopColor={colors.magenta} />
            </linearGradient>
          </defs>

          {/* Region labels */}
          {[{ y: 2, t: "A · TRACKING LIFECYCLE", c: colors.green }, { y: 318, t: "B · ASSISTANCE LEVEL (risk engine)", c: colors.amber }, { y: 538, t: "C · SPEECH ARBITER", c: colors.magenta }].map((r) => (
            <text key={r.t} x="0" y={r.y + 14} fontSize="14" fontFamily="JetBrains Mono" letterSpacing="2" fill={r.c}>{r.t}</text>
          ))}
          <line x1="0" x2="1280" y1="305" y2="305" stroke="rgba(190,205,255,.1)" />
          <line x1="0" x2="1280" y1="525" y2="525" stroke="rgba(190,205,255,.1)" />

          {/* Region A edges */}
          <BsmEdge liveId={liveId} animate={!reducedMotion} id="search-acq" d={`M${tn.searching.x + 60},${tn.searching.y - 34} Q${tn.searching.x + 120},${tn.acquiring.y} ${tn.acquiring.x - 105},${tn.acquiring.y}`} color={colors.cyan} label="person detected" lx={190} ly={88} />
          <BsmEdge liveId={liveId} animate={!reducedMotion} id="acq-lock" d={`M${tn.acquiring.x + 105},${tn.acquiring.y} L${lb.x - 4},${tn.acquiring.y}`} color={colors.green} label="filter init" lx={500} ly={60} />
          <BsmEdge liveId={liveId} animate={!reducedMotion} id="lock-coast" d={`M${lb.x + lb.w + 4},${tn.coasting.y - 14} L${tn.coasting.x - 105},${tn.coasting.y - 14}`} color={colors.amber} label="no box" lx={985} ly={58} />
          <BsmEdge liveId={liveId} animate={!reducedMotion} id="coast-lock" d={`M${tn.coasting.x - 105},${tn.coasting.y + 16} L${lb.x + lb.w + 4},${tn.coasting.y + 16}`} color={colors.green} label="in gate" lx={985} ly={118} />
          <BsmEdge liveId={liveId} animate={!reducedMotion} id="coast-lost" d={`M${tn.coasting.x},${tn.coasting.y + 34} L${tn.lost.x},${tn.lost.y - 34}`} color={colors.magenta} label="> 20 frames" lx={1180} ly={158} />
          <BsmEdge liveId={liveId} animate={!reducedMotion} id="lost-search" d={`M${tn.lost.x - 60},${tn.lost.y + 34} C${tn.lost.x - 200},${300} ${300},${300} ${tn.searching.x},${tn.searching.y + 34}`} color={colors.red} label="reset · speak p100 “I lost sight of you”" lx={640} ly={292} />

          {/* Locked composite state */}
          <g filter={s.track === "locked" ? "url(#bsmGlow)" : undefined}>
            <rect x={lb.x} y={lb.y} width={lb.w} height={lb.h} rx="26" fill={s.track === "locked" ? "rgba(52,224,161,.12)" : "rgba(10,13,32,.7)"} stroke={colors.green} strokeWidth={s.track === "locked" ? 3 : 1.6} />
          </g>
          <text x={lb.x + 22} y={lb.y + 34} fontSize="22" fontWeight="600" fontFamily="Space Grotesk Variable" fill={colors.green}>Locked</text>
          <text x={lb.x + lb.w - 20} y={lb.y + 34} textAnchor="end" fontSize="13" fontFamily="JetBrains Mono" fill="rgba(190,205,255,.65)">targetLocked: true</text>
          <Node x={lb.x + 100} y={lb.y + 100} w={160} label="Detect" sub="YOLO, every 2nd" color={colors.green} on={s.track === "locked" && s.sub === "detect"} />
          <Node x={lb.x + 300} y={lb.y + 100} w={160} label="Track" sub="CSRT→KCF→MIL→LK" color={colors.cyan} on={s.track === "locked" && s.sub === "track"} />
          <path d={`M${lb.x + 180},${lb.y + 86} L${lb.x + 220},${lb.y + 86}`} stroke="rgba(190,205,255,.4)" markerEnd="url(#bsmArrow)" />
          <path d={`M${lb.x + 220},${lb.y + 114} L${lb.x + 180},${lb.y + 114}`} stroke="rgba(190,205,255,.4)" markerEnd="url(#bsmArrow)" />
          <rect x={lb.x + 40} y={lb.y + 160} width={lb.w - 80} height="56" rx="14" fill="rgba(255,181,71,.1)" stroke="rgba(255,181,71,.5)" strokeDasharray="5 5" />
          <text x={lb.x + lb.w / 2} y={lb.y + 184} textAnchor="middle" fontSize="15" fontFamily="JetBrains Mono" fill={colors.amber}>Kalman update [x, y, vx, vy, w, h]</text>
          <text x={lb.x + lb.w / 2} y={lb.y + 205} textAnchor="middle" fontSize="13" fontFamily="JetBrains Mono" fill="rgba(255,181,71,.8)">projector → gimbal at 100–300 Hz</text>

          <Node {...tn.searching} on={s.track === "searching"} />
          <Node {...tn.acquiring} on={s.track === "acquiring"} />
          <Node {...tn.coasting} on={s.track === "coasting"} />
          <Node {...tn.lost} on={s.track === "lost"} />
          {s.track === "coasting" && (
            <g transform={`translate(${tn.coasting.x + 128}, ${tn.coasting.y})`}>
              <circle r="22" fill="none" stroke="rgba(255,181,71,.2)" strokeWidth="5" />
              <circle r="22" fill="none" stroke={colors.amber} strokeWidth="5" strokeDasharray={`${Math.min(1, s.lost / 20) * 138} 138`} transform="rotate(-90)" />
              <text y="5" textAnchor="middle" fontSize="13" fontFamily="JetBrains Mono" fill="#fff">{Math.min(s.lost, 21)}</text>
            </g>
          )}

          {/* Region B: assistance levels */}
          {levelNodes.slice(0, -1).map((n, i) => {
            const next = levelNodes[i + 1];
            return <BsmEdge liveId={liveId} animate={!reducedMotion} key={n.level} id={`lvl-${n.level}-${next.level}`} d={`M${n.x + 105},${n.y - 8} L${next.x - 105},${next.y - 8}`} color={next.color} />;
          })}
          <path d={`M${levelNodes[4].x},${levelNodes[4].y + 34} C${levelNodes[4].x},${490} ${levelNodes[0].x},${490} ${levelNodes[0].x},${levelNodes[0].y + 34}`} fill="none" stroke="rgba(190,205,255,.22)" strokeDasharray="6 6" markerEnd="url(#bsmArrow)" />
          <text x={640} y={500} textAnchor="middle" fontSize="13" fontFamily="JetBrains Mono" fill="rgba(190,205,255,.6)">risk falls · “I am okay” / “cancel” clears check-in</text>
          {levelNodes.map((n) => <Node key={n.level} x={n.x} y={n.y} label={`${n.level} · ${n.label}`} sub={n.sub} color={n.color} on={level === n.level} />)}
          {/* Live risk meter */}
          <rect x="25" y="452" width="1230" height="8" rx="4" fill="rgba(255,255,255,.06)" />
          <rect x="25" y="452" width={1230 * snapshot.risk.riskScore} height="8" rx="4" fill="url(#riskGrad)" />
          {riskLevels.map((l) => <line key={l.level} x1={25 + 1230 * l.value} x2={25 + 1230 * l.value} y1="446" y2="466" stroke="rgba(255,255,255,.5)" />)}

          {/* Region C: speech arbiter */}
          {arbiterPos.slice(0, -1).map((n, i) => <BsmEdge liveId={liveId} animate={!reducedMotion} key={n.id} id={`arb-${n.id}`} d={`M${n.x + 105},${n.y} L${arbiterPos[i + 1].x - 105},${n.y}`} color={arbiterPos[i + 1].color} />)}
          <path d={`M${arbiterPos[4].x},${arbiterPos[4].y + 34} C${arbiterPos[4].x},${712} ${arbiterPos[0].x},${712} ${arbiterPos[0].x},${arbiterPos[0].y + 34}`} fill="none" stroke="rgba(190,205,255,.22)" strokeDasharray="6 6" markerEnd="url(#bsmArrow)" />
          {arbiterPos.map((n) => <Node key={n.id} x={n.x} y={n.y} label={n.label} sub={n.sub} color={n.color} on={arbiter === n.id} />)}
        </svg>
      </div>

      <aside className="bsmSide">
        <div className="bsmEvents">
          {events.map((e) => {
            const Icon = e.icon;
            return (
              <button key={e.name} className="chip bsmEvent" style={{ "--chipc": e.color } as CSSProperties} onClick={() => fire(e.name, e.apply, e.color)}>
                <Icon size={18} /> {e.name}
              </button>
            );
          })}
          <button className="chip" onClick={() => { sim.current = fresh(); setSnapshot({ risk: assessRisk({}), nonResponse: 0 }); }}>
            <RotateCcw size={18} /> Reset
          </button>
        </div>
        <div className="bsmMeters glass">
          <div><span>risk</span><b style={{ color: levelNodes[level].color }}>{snapshot.risk.riskScore.toFixed(2)}</b></div>
          <div><span>level</span><b style={{ color: levelNodes[level].color }}>{levelNodes[level].label}</b></div>
          <div><span>silence</span><b className="c-amber">{snapshot.nonResponse.toFixed(2)}</b></div>
          <div><span>track</span><b className="c-green">{s.track}</b></div>
        </div>
        <div className="bsmVoice">
          {s.line && s.t < s.speakingUntil + 2 ? (
            <motion.div key={s.line.text + s.speakingUntil} className="speechBubble" style={{ fontSize: 21 }} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
              “{s.line.text}”
              <span className="mono bsmPri">p{s.line.priority} · {s.line.type}</span>
            </motion.div>
          ) : (
            <p className="faint" style={{ fontSize: 18, margin: "6px 0" }}>
              <Hand size={16} style={{ verticalAlign: -2 }} /> Quiet. Nothing new worth saying.
            </p>
          )}
        </div>
        <ol className="bsmLog">
          {s.log.map((l, i) => (
            <li key={`${l.t}-${i}`} style={{ "--lc": l.color } as CSSProperties}>
              <span className="mono">{l.t.toFixed(1)}s</span>
              {l.text}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
};
