import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { colors } from "../theme";
import { Aperture, Kicker, Legend } from "../components/ui";
import { useMotion } from "../lib/hooks";

type Status = "implemented" | "optional" | "partial";
interface ArchNode { id: string; name: string; file: string; x: number; y: number; color: string; status: Status; purpose: string; inputs: string; outputs: string; method: string }

const c = { sense: colors.cyan, perceive: colors.cyan, predict: colors.amber, understand: colors.indigo, speak: colors.magenta, act: colors.green, record: "#9aa8c2" };

const deep: ArchNode[] = [
  { id: "camera", name: "Camera frames", file: "runObserveDemo.py", x: 110, y: 330, color: c.sense, status: "implemented", purpose: "Reads frames from the external tracking camera, an optional second hazard camera, or a video file.", inputs: "Camera index / video path", outputs: "BGR frames", method: "OpenCV VideoCapture" },
  { id: "detector", name: "Person detector", file: "detector.py", x: 360, y: 170, color: c.perceive, status: "implemented", purpose: "Finds people in the frame.", inputs: "Frame (every 2nd, or when lock is weak)", outputs: "Person boxes + confidence", method: "Ultralytics YOLO (yolo11n / yolo26n), imgsz 416, CPU" },
  { id: "selector", name: "Target selector", file: "targetSelector.py", x: 600, y: 110, color: c.perceive, status: "implemented", purpose: "Chooses which person to follow and keeps the identity stable.", inputs: "Detections, predicted centre, previous box", outputs: "One selected detection", method: "Centre/confidence score; distance + IoU gate with 0.55/0.25/0.20 weights" },
  { id: "tracker", name: "Correlation tracker", file: "correlationTracker.py", x: 600, y: 250, color: c.perceive, status: "implemented", purpose: "Keeps the box attached between detector runs.", inputs: "Frame, last box", outputs: "Tracked box", method: "OpenCV CSRT → KCF → MIL, fallback LK optical flow + template match" },
  { id: "kalman", name: "Kalman filter", file: "kalmanFilter.py", x: 850, y: 180, color: c.predict, status: "implemented", purpose: "Smooths the target box and estimates velocity.", inputs: "Measured box [x, y, w, h]", outputs: "State [x, y, vx, vy, w, h] + covariance", method: "Constant-velocity model, dt from frame timing" },
  { id: "projector", name: "High-rate projector", file: "pipeline.py, gimbalOutput.py", x: 1090, y: 120, color: c.predict, status: "implemented", purpose: "Publishes predicted target state faster than vision runs.", inputs: "Latest filter snapshot", outputs: "stateMatrix, nextCenter, normalizedError (stdout / UDP / JSONL)", method: "100–300 Hz loop, prediction lead 8 ms" },
  { id: "gimbal", name: "Gimbal hardware", file: "observe_firmware, servo_classification", x: 1330, y: 120, color: c.act, status: "partial", purpose: "Points the external camera at the person.", inputs: "Target error (intended); IMU orientation", outputs: "Servo PWM; IMU telemetry over USB", method: "STM32 + BNO085 at 1 kHz; servo 1.5 ± 0.6 ms. Closing the loop is in progress." },
  { id: "hazard", name: "Hazard detector", file: "hazardDetector.py", x: 360, y: 500, color: c.understand, status: "implemented", purpose: "Scores everything in view as a potential hazard.", inputs: "Hazard frame", outputs: "Label, side, in-path flag, proximity, danger", method: "Second YOLO pass, class base danger + size + corridor" },
  { id: "risk", name: "Risk engine", file: "riskEngine.py, observEPipeline.py", x: 600, y: 470, color: c.understand, status: "implemented", purpose: "Combines hazard, fall, motion, voice and silence into one risk score.", inputs: "Seven signals", outputs: "riskScore, eventLevel 0–4, reasons", method: "Weighted sum, thresholds 0.33 / 0.52 / 0.72 / 0.88" },
  { id: "voiceCmd", name: "Voice commands", file: "voiceCommands.py", x: 360, y: 640, color: c.understand, status: "implemented", purpose: "Recognises help, cancel, okay, stop and follow.", inputs: "Transcribed text", outputs: "Boolean intents", method: "Keyword matching" },
  { id: "vlm", name: "Vision-language model", file: "groqVisionNarrator.py", x: 850, y: 620, color: colors.violet, status: "optional", purpose: "Adds a one-sentence scene description and suggested action.", inputs: "Sampled frame + detector metadata", outputs: "short_summary, priority_hazard, recommended_action, confidence", method: "Groq API (hosted), Llama 4 Scout, async every 2 s, JSON output" },
  { id: "narration", name: "Narration engine", file: "narration.py", x: 850, y: 440, color: c.understand, status: "implemented", purpose: "Turns state into immediate alerts and short summaries.", inputs: "eventLevel, top hazard", outputs: "Alert text, summary text", method: "Rule templates" },
  { id: "speech", name: "Speech planner", file: "conversationSpeech.py", x: 1090, y: 470, color: c.speak, status: "implemented", purpose: "Decides whether and what to say right now.", inputs: "State, alerts, context", outputs: "Speech event with priority", method: "Priorities, gaps and cooldowns" },
  { id: "webapp", name: "Voice companion", file: "web companion app", x: 1330, y: 470, color: c.speak, status: "implemented", purpose: "Shows and speaks each line.", inputs: "Speech lines via BLE, Web Serial or SSE bridge", outputs: "Audio", method: "Express + ElevenLabs streaming TTS" },
  { id: "outreach", name: "Outreach", file: "outreach.py", x: 1090, y: 650, color: c.record, status: "implemented", purpose: "Records escalation to a trusted contact.", inputs: "eventLevel ≥ 3", outputs: "JSONL escalation record", method: "Log only, 30 s cooldown. No calls placed." },
  { id: "store", name: "Event store", file: "profileStore.py", x: 1330, y: 650, color: c.record, status: "implemented", purpose: "Keeps users, contacts and every state and utterance.", inputs: "State, speech, escalations", outputs: "SQLite observe.db, JSONL logs", method: "SQLite" },
  { id: "base", name: "Mobile base", file: "car_firmware", x: 110, y: 640, color: c.act, status: "partial", purpose: "Drives the robot.", inputs: "Four int8 speeds over BLE", outputs: "Sabertooth packets", method: "STM32WB55 BLE peripheral “OBSV”" },
];
const deepEdges = [["camera", "detector"], ["camera", "tracker"], ["detector", "selector"], ["selector", "kalman"], ["tracker", "kalman"], ["kalman", "selector"], ["kalman", "projector"], ["projector", "gimbal"], ["camera", "hazard"], ["hazard", "risk"], ["kalman", "risk"], ["voiceCmd", "risk"], ["risk", "narration"], ["hazard", "narration"], ["camera", "vlm"], ["narration", "speech"], ["vlm", "speech"], ["risk", "speech"], ["speech", "webapp"], ["risk", "outreach"], ["outreach", "store"], ["speech", "store"]];

const overview: ArchNode[] = [
  { id: "sense", name: "Sense", file: "Camera + IMU", x: 190, y: 400, color: c.sense, status: "implemented", purpose: "Capture the world: camera frames for vision, orientation from the IMU on the gimbal.", inputs: "Light, motion", outputs: "Frames, quaternions", method: "OpenCV capture, BNO085 SH-2" },
  { id: "perceive", name: "Perceive", file: "Detect, select, track", x: 540, y: 230, color: c.perceive, status: "implemented", purpose: "Find people, pick the one to follow, keep the lock between detections.", inputs: "Frames", outputs: "Target box", method: "YOLO + selector + CSRT/KCF/MIL/optical flow" },
  { id: "predict", name: "Predict", file: "Kalman + projector", x: 900, y: 230, color: c.predict, status: "implemented", purpose: "Estimate velocity and project the target ahead for control.", inputs: "Target box", outputs: "6×1 state at up to 300 Hz", method: "Constant-velocity Kalman filter" },
  { id: "act", name: "Act", file: "Gimbal + base", x: 1260, y: 230, color: c.act, status: "partial", purpose: "Point the camera and move the robot.", inputs: "Predicted state, BLE commands", outputs: "Servo PWM, motor packets", method: "STM32 firmware" },
  { id: "understand", name: "Understand", file: "Hazards, risk, VLM", x: 720, y: 580, color: c.understand, status: "implemented", purpose: "Score hazards and the person’s situation, optionally describe the scene with a VLM.", inputs: "Frames, target state, voice", outputs: "Risk level, top hazard, context", method: "Second YOLO pass, weighted risk, optional Groq" },
  { id: "speak", name: "Speak", file: "Planner + web app", x: 1100, y: 580, color: c.speak, status: "implemented", purpose: "Say the right thing at the right moment, or escalate.", inputs: "Risk, hazards, context", outputs: "Spoken lines, logged escalations", method: "Priority planner + ElevenLabs" },
];
const overviewEdges = [["sense", "perceive"], ["perceive", "predict"], ["predict", "act"], ["sense", "understand"], ["predict", "understand"], ["understand", "speak"], ["perceive", "understand"]];

const statusLabel: Record<Status, string> = { implemented: "Implemented", optional: "Optional integration", partial: "Partly implemented" };

export const Architecture = () => {
  const [mode, setMode] = useState<"overview" | "deep">("overview");
  const [selected, setSelected] = useState("perceive");
  const { reducedMotion } = useMotion();
  const nodes = mode === "overview" ? overview : deep;
  const edges = mode === "overview" ? overviewEdges : deepEdges;
  const active = nodes.find((n) => n.id === selected) ?? nodes[0];
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const linked = new Set(edges.filter(([a, b]) => a === active.id || b === active.id).flat());
  const w = mode === "overview" ? 230 : 196;
  const h = mode === "overview" ? 96 : 62;

  return (
    <div className="slide architecture">
      <div className="archHead">
        <div>
          <Kicker act="VI" color={colors.indigo}>Experience E</Kicker>
          <h2 className="title" style={{ fontSize: 56, marginBottom: 0 }}>The whole system, <span className="grad">module by module.</span></h2>
        </div>
        <div className="controlBar">
          <button className={`chip ${mode === "overview" ? "on" : ""}`} onClick={() => { setMode("overview"); setSelected("perceive"); }}>Overview</button>
          <button className={`chip violet ${mode === "deep" ? "on" : ""}`} onClick={() => { setMode("deep"); setSelected("kalman"); }}>Technical deep dive</button>
        </div>
      </div>
      <Aperture style={{ left: 112, top: 240, width: 1180, height: 680 }} provenance="implemented" provenanceText="Module names from the repo" glow={active.color}>
        <svg viewBox="0 0 1440 760" width="1180" height="680" role="group" aria-label="System architecture diagram">
          <defs>
            <marker id="archArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="rgba(190,205,255,.5)" /></marker>
            <filter id="archGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          {edges.map(([a, b], i) => {
            const from = byId[a];
            const to = byId[b];
            const hot = a === active.id || b === active.id;
            const dx = to.x - from.x;
            const d = `M${from.x},${from.y} C${from.x + dx * 0.5},${from.y} ${to.x - dx * 0.5},${to.y} ${to.x},${to.y}`;
            return (
              <g key={`${mode}-${a}-${b}`}>
                <path id={`edge-${mode}-${i}`} d={d} fill="none" stroke={hot ? from.color : "rgba(190,205,255,.16)"} strokeWidth={hot ? 3 : 1.5} filter={hot ? "url(#archGlow)" : undefined} />
                {!reducedMotion && (
                  <circle r={hot ? 6 : 3.5} fill={from.color} opacity={hot ? 1 : 0.5}>
                    <animateMotion dur={`${2.2 + (i % 4) * 0.4}s`} repeatCount="indefinite" begin={`${(i % 5) * 0.3}s`}><mpath href={`#edge-${mode}-${i}`} /></animateMotion>
                  </circle>
                )}
              </g>
            );
          })}
          {nodes.map((n) => {
            const on = n.id === active.id;
            const near = linked.has(n.id);
            return (
              <g key={`${mode}-${n.id}`} transform={`translate(${n.x - w / 2}, ${n.y - h / 2})`} onClick={() => setSelected(n.id)} role="button" tabIndex={0} aria-pressed={on} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(n.id)} style={{ cursor: "pointer" }} opacity={on || near ? 1 : 0.55} filter={on ? "url(#archGlow)" : undefined}>
                <rect width={w} height={h} rx="16" fill={on ? n.color : "rgba(10,13,32,.9)"} stroke={n.color} strokeWidth={on ? 0 : 1.8} strokeDasharray={n.status === "optional" ? "6 5" : n.status === "partial" ? "2 4" : undefined} />
                <rect x="10" y="8" width={w - 20} height="3" rx="1.5" fill={on ? "rgba(4,5,13,.3)" : n.color} opacity=".7" />
                <text x={w / 2} y={mode === "overview" ? 50 : 40} textAnchor="middle" fontSize={mode === "overview" ? 30 : 20} fontWeight="600" fontFamily="Space Grotesk Variable" fill={on ? "#04050d" : "#eef3fa"}>{n.name}</text>
                {mode === "overview" && <text x={w / 2} y="78" textAnchor="middle" fontSize="16" fill={on ? "#04050d" : "#9aa8c2"}>{n.file}</text>}
              </g>
            );
          })}
        </svg>
      </Aperture>
      <AnimatePresence mode="wait">
        <motion.aside key={`${mode}-${active.id}`} className="archDetail glass" style={{ borderColor: active.color }} initial={reducedMotion ? false : { opacity: 0, x: 20, rotateY: -15 }} animate={{ opacity: 1, x: 0, rotateY: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <span className={`archStatus st-${active.status}`}>{statusLabel[active.status]}</span>
          <h3 style={{ color: active.color }}>{active.name}</h3>
          <p className="mono faint" style={{ fontSize: 16, margin: "0 0 14px" }}>{active.file}</p>
          <p className="body" style={{ fontSize: 21 }}>{active.purpose}</p>
          <dl>
            <dt>In</dt><dd>{active.inputs}</dd>
            <dt>Out</dt><dd>{active.outputs}</dd>
            <dt>How</dt><dd>{active.method}</dd>
          </dl>
        </motion.aside>
      </AnimatePresence>
      <Legend style={{ position: "absolute", left: 112, top: 944 }} items={[{ label: "Solid: implemented", color: "#9aa8c2" }, { label: "Dashed: optional", color: colors.violet }, { label: "Dotted: partly implemented", color: colors.green }]} />
    </div>
  );
};
