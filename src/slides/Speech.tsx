import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Armchair, Car, Clapperboard, Eye, EyeOff, Pause, RotateCcw, ScanText, Sparkles, Volume2, VolumeX, Wind } from "lucide-react";
import { colors, alpha } from "../theme";
import { Kicker, ProvenanceTag, Tilt } from "../components/ui";
import { setupCanvas, useAnimationLoop, useMotion, motionVars } from "../lib/hooks";
import type { Hazard, Side } from "../lib/hazards";
import { SpeechPlanner, type SpeechEvent } from "../lib/speechPlanner";

const hazard = (label: string, side: Side, inPath: boolean, danger: number): Hazard => ({ label, side, inPathCorridor: inPath, dangerScore: danger, confidence: 0.8, distanceScore: 0.5, box: [0, 0, 1, 1] });

interface Sandbox { hazard: Hazard | null; pathDanger: number; traffic: number; locked: boolean; level: number; context: { timestamp: number; summary: string; action?: string } | null }

const triggers: { name: string; icon: typeof Car; color: string; source: string; apply: (s: Sandbox, t: number) => void }[] = [
  { name: "Chair enters path", icon: Armchair, color: colors.lime, source: "hazardDetector", apply: (s) => { s.hazard = hazard("chair", "center", true, 0.66); s.pathDanger = 0.66; s.traffic = 0; } },
  { name: "Chair, still there", icon: Armchair, color: colors.lime, source: "hazardDetector", apply: (s) => { s.hazard = hazard("chair", "center", true, 0.67); s.pathDanger = 0.67; } },
  { name: "Car from the left", icon: Car, color: colors.indigo, source: "hazardDetector", apply: (s) => { s.hazard = hazard("car", "left", false, 0.72); s.traffic = 0.8; s.pathDanger = 0; } },
  { name: "Path clears", icon: Wind, color: colors.green, source: "hazardDetector", apply: (s) => { s.hazard = null; s.pathDanger = 0; s.traffic = 0; } },
  { name: "Lose the person", icon: EyeOff, color: colors.red, source: "tracker", apply: (s) => { s.locked = false; } },
  { name: "Find them again", icon: Eye, color: colors.cyan, source: "tracker", apply: (s) => { s.locked = true; } },
  { name: "Scene summary arrives", icon: ScanText, color: colors.violet, source: "Groq VLM", apply: (s, t) => { s.context = { timestamp: t, summary: "A crosswalk with a signal on the right", action: "Wait for the walk signal" }; } },
];

// Scripted walk for auto-play: [time, trigger index]
const story: [number, number][] = [[0.6, 0], [2.6, 1], [4.2, 2], [5.0, 4], [7.2, 5], [9.0, 6], [12.4, 3]];

const bands = [
  { from: 100, to: 120, label: "Interrupts", note: "lost · check-in · escalation", color: colors.red },
  { from: 64, to: 96, label: "Hazards", note: "new or worse only", color: colors.amber },
  { from: 36, to: 46, label: "Calm & context", note: "path clear · scene summary", color: colors.cyan },
];

const cooldowns = [
  { key: "pathHazard", label: "same hazard", sec: 5, color: colors.amber },
  { key: "contextSpeech", label: "context", sec: 3.5, color: colors.violet },
  { key: "pathClear", label: "path clear", sec: 5, color: colors.green },
];

const sourceColor: Record<SpeechEvent["source"], string> = { tracking: colors.cyan, risk: colors.red, hazard: colors.amber, vlm: colors.violet };

interface Mark { t: number; kind: "in" | "out"; color: string; label: string }

const freshSandbox = (): Sandbox => ({ hazard: null, pathDanger: 0, traffic: 0, locked: true, level: 0, context: null });

export const Speech = () => {
  const { reducedMotion } = useMotion();
  const wave = useRef<HTMLCanvasElement>(null);
  const sim = useRef({ t: 0, tick: 0, planner: new SpeechPlanner(), sandbox: freshSandbox(), speakingUntil: -1, storyAt: -1, storyIndex: 0 });
  const [voiceOn, setVoiceOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [clock, setClock] = useState(0);
  const [candidates, setCandidates] = useState<SpeechEvent[]>([]);
  const [winner, setWinner] = useState<SpeechEvent | null>(null);
  const [suppressed, setSuppressed] = useState<string | null>(null);
  const [spoken, setSpoken] = useState<(SpeechEvent & { at: number })[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [flights, setFlights] = useState<{ id: number; y: number; color: string }[]>([]);
  const [firedIndex, setFiredIndex] = useState<number | null>(null);
  const flightId = useRef(0);

  const say = (text: string, urgent: boolean) => {
    if (!voiceOn || !("speechSynthesis" in window)) return;
    if (urgent) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  };
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const fire = (index: number) => {
    const s = sim.current;
    const trig = triggers[index];
    trig.apply(s.sandbox, s.t);
    setFiredIndex(index);
    setMarks((m) => [...m.filter((x) => x.t > s.t - 20), { t: s.t, kind: "in", color: trig.color, label: trig.name }]);
    if (!reducedMotion) setFlights((f) => [...f, { id: flightId.current++, y: 40 + index * 82, color: trig.color }]);
  };

  // 10 Hz planner tick, as in the pipeline
  useAnimationLoop((dt) => {
    const s = sim.current;
    s.t += dt;
    s.tick += dt;
    if (s.storyAt >= 0) {
      const local = s.t - s.storyAt;
      while (s.storyIndex < story.length && local >= story[s.storyIndex][0]) fire(story[s.storyIndex++][1]);
      if (s.storyIndex >= story.length && local > 15) {
        s.storyAt = -1;
        setPlaying(false);
      }
    }
    const c = wave.current;
    if (c) {
      const ctx = setupCanvas(c, 500, 150);
      ctx.clearRect(0, 0, 500, 150);
      const talking = s.t < s.speakingUntil;
      const g = ctx.createLinearGradient(0, 0, 500, 0);
      g.addColorStop(0, colors.magenta);
      g.addColorStop(0.5, colors.violet);
      g.addColorStop(1, colors.cyan);
      ctx.fillStyle = g;
      ctx.shadowColor = colors.magenta;
      ctx.shadowBlur = talking ? 16 : 4;
      for (let i = 0; i < 56; i++) {
        const x = 6 + i * 8.8;
        const env = Math.sin((i / 55) * Math.PI);
        const amp = talking ? (0.25 + 0.75 * Math.abs(Math.sin(s.t * 9 + i * 0.7) * Math.sin(s.t * 3.1 + i * 0.23))) * env : 0.06 + 0.04 * Math.sin(s.t * 2 + i * 0.4);
        const h = Math.max(3, amp * 130);
        ctx.fillRect(x, 75 - h / 2, 5, h);
      }
    }
    if (s.tick < 0.1) return;
    s.tick = 0;
    const box = s.sandbox;
    const chosen = s.planner.update({ targetLocked: box.locked, eventLevel: box.level, topHazard: box.hazard, pathDanger: box.pathDanger, trafficThreat: box.traffic, contextText: box.context }, s.t);
    setClock(s.t);
    if (s.planner.lastCandidates.length || chosen) {
      setCandidates(chosen && !s.planner.lastCandidates.length ? [chosen] : s.planner.lastCandidates);
      setWinner(chosen);
    }
    if (s.planner.lastSuppression) setSuppressed(s.planner.lastSuppression);
    if (chosen) {
      setSuppressed(null);
      s.speakingUntil = s.t + Math.max(1.4, chosen.text.split(" ").length / 2.8);
      setSpoken((list) => [...list.slice(-4), { ...chosen, at: s.t }]);
      setMarks((m) => [...m.filter((x) => x.t > s.t - 20), { t: s.t, kind: "out", color: sourceColor[chosen.source], label: chosen.eventType }]);
      say(chosen.text, chosen.priority >= 100);
    }
  }, true);

  const reset = () => {
    window.speechSynthesis?.cancel();
    sim.current = { t: 0, tick: 0, planner: new SpeechPlanner(), sandbox: freshSandbox(), speakingUntil: -1, storyAt: -1, storyIndex: 0 };
    setCandidates([]);
    setWinner(null);
    setSuppressed(null);
    setSpoken([]);
    setMarks([]);
    setPlaying(false);
  };

  const playStory = () => {
    if (playing) {
      sim.current.storyAt = -1;
      setPlaying(false);
      return;
    }
    reset();
    sim.current.storyAt = 0;
    setPlaying(true);
  };

  const planner = sim.current.planner;
  const sinceSpoken = clock - planner.lastSpokenTime;
  const gapFrac = Math.min(1, sinceSpoken / planner.minGapSec);
  const interruptFrac = Math.min(1, sinceSpoken / planner.interruptGapSec);
  const latest = spoken[spoken.length - 1];
  const talking = clock < sim.current.speakingUntil;
  const yFor = (p: number) => 100 - ((Math.min(120, p) - 30) / 90) * 100;

  return (
    <div className="slide speech">
      <div className="speechHead">
        <div>
          <Kicker act="V" color={colors.magenta}>Speech planning</Kicker>
          <h2 className="title" style={{ fontSize: 58, marginBottom: 6 }}>
            How does <span className="c-cyan">perception</span> become <span className="grad" style={{ "--g1": colors.magenta, "--g2": colors.violet, "--g3": colors.cyan } as CSSProperties}>speech?</span>
          </h2>
          <p className="body" style={{ fontSize: 20, margin: 0, maxWidth: "80ch" }}>
            A robot that talks every frame is noise. The planner speaks only when something changes, ranks candidates by priority, and enforces gaps and cooldowns so warnings stay short and meaningful.
          </p>
        </div>
        <div className="speechTools">
          <button className={`chip magenta ${playing ? "on" : ""}`} onClick={playStory}>{playing ? <Pause size={18} /> : <Clapperboard size={18} />} {playing ? "Stop story" : "Play a walk"}</button>
          <button className={`chip violet ${voiceOn ? "on" : ""}`} onClick={() => { if (voiceOn) window.speechSynthesis?.cancel(); setVoiceOn((v) => !v); }} aria-pressed={voiceOn}>
            {voiceOn ? <Volume2 size={18} /> : <VolumeX size={18} />} Voice {voiceOn ? "on" : "off"}
          </button>
          <button className="chip" onClick={reset}><RotateCcw size={18} /> Reset</button>
          <ProvenanceTag kind="implemented" text="Real planner rules, ported from conversationSpeech.py" />
        </div>
      </div>

      <div className="speechGrid">
        {/* 1. Inputs */}
        <section className="spCol spInputs">
          <h5><span>01</span> Perception events</h5>
          {triggers.map((t, i) => {
            const Icon = t.icon;
            return (
              <Tilt key={t.name} className={`trigCard ${firedIndex === i ? "fired" : ""}`} style={{ "--tc": t.color } as CSSProperties} onClick={() => fire(i)} role="button" tabIndex={0} max={14}>
                <Icon size={20} />
                <span className="trigName">{t.name}</span>
                <span className="trigSrc mono">{t.source}</span>
              </Tilt>
            );
          })}
        </section>

        {/* 2. Candidates */}
        <section className="spCol spCandidates glass">
          <h5><span>02</span> Candidate lines</h5>
          <AnimatePresence initial={false}>
            {candidates.length === 0 && <motion.p key="none" className="faint" style={{ fontSize: 18 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Fire an event, or play a walk.</motion.p>}
            {candidates.map((c) => {
              const won = winner && winner.eventType === c.eventType && winner.timestamp === c.timestamp;
              return (
                <motion.div key={`${c.eventType}-${c.timestamp}`} layout className={`candidate ${won ? "won" : "lost"}`} style={motionVars({ "--cc": sourceColor[c.source] })} initial={{ opacity: 0, x: -30, rotateY: -30 }} animate={{ opacity: won ? 1 : 0.55, x: 0, rotateY: 0 }} exit={{ opacity: 0, x: 30 }}>
                  <div className="candTop">
                    <span className="mono candP">p{c.priority}</span>
                    <span className="candType mono">{c.eventType}</span>
                    <span className="candVerdict">{won ? "spoken" : "outranked / held"}</span>
                  </div>
                  <p>“{c.text}”</p>
                  <span className="candBar"><i style={{ width: `${(c.priority / 120) * 100}%` }} /></span>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <AnimatePresence>
            {suppressed && (
              <motion.div className="suppressBadge" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Sparkles size={15} /> Staying quiet: {suppressed}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* 3. Arbiter */}
        <section className="spCol spArbiter glass">
          <h5><span>03</span> Priority arbiter</h5>
          <div className="ladder">
            {bands.map((b) => (
              <div key={b.label} className="band" style={{ "--bc": b.color, top: `${yFor(b.to)}%`, height: `${Math.max(4, yFor(b.from) - yFor(b.to))}%` } as CSSProperties}>
                <span>{b.label}</span>
                <small className="mono">{b.from}–{b.to}</small>
              </div>
            ))}
            <AnimatePresence>
              {candidates.map((c) => (
                <motion.i key={`pip-${c.eventType}-${c.timestamp}`} className="pip" style={motionVars({ "--cc": sourceColor[c.source] })} initial={{ opacity: 0, scale: 0, top: "100%" }} animate={{ opacity: 1, scale: 1, top: `${yFor(c.priority)}%` }} exit={{ opacity: 0, scale: 0 }} transition={{ type: "spring", stiffness: 200, damping: 18 }} />
              ))}
            </AnimatePresence>
          </div>
          <div className="gapRings">
            {[{ label: "normal gap 1.2 s", frac: gapFrac, color: colors.amber }, { label: "interrupt 0.55 s", frac: interruptFrac, color: colors.red }].map((g) => (
              <div key={g.label} className="gapRing">
                <svg viewBox="0 0 64 64" width="64" height="64">
                  <circle cx="32" cy="32" r="26" fill="none" stroke={alpha(g.color, 0.18)} strokeWidth="6" />
                  <circle cx="32" cy="32" r="26" fill="none" stroke={g.color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${g.frac * 163} 163`} transform="rotate(-90 32 32)" style={{ filter: `drop-shadow(0 0 6px ${g.color})` }} />
                  <text x="32" y="37" textAnchor="middle" fontSize="13" fill="#fff" fontFamily="JetBrains Mono">{g.frac >= 1 ? "open" : `${Math.round(g.frac * 100)}%`}</text>
                </svg>
                <span>{g.label}</span>
              </div>
            ))}
          </div>
          <div className="cooldowns">
            {cooldowns.map((c) => {
              const key = c.key === "pathHazard" ? Object.keys(planner.lastSpokenByKey).filter((k) => k.startsWith("hazard:")).sort((a, b) => planner.lastSpokenByKey[b] - planner.lastSpokenByKey[a])[0] ?? "hazard:none" : c.key;
              const left = planner.cooldownRemaining(key, clock, c.sec);
              return (
                <div key={c.key} className="cooldown" style={{ "--kc": c.color } as CSSProperties}>
                  <span>{c.label}</span>
                  <span className="cdTrack"><i style={{ width: `${(left / c.sec) * 100}%` }} /></span>
                  <span className="mono">{left > 0 ? `${left.toFixed(1)}s` : "ready"}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. Voice */}
        <section className="spCol spVoice">
          <h5><span>04</span> Voice companion</h5>
          <div className={`voiceOrb ${talking ? "talking" : ""}`}>
            <canvas ref={wave} style={{ width: 500, height: 150 }} aria-hidden="true" />
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={latest ? latest.at : "idle"} className="speechBubble spBubble" style={motionVars({ "--bc": latest ? sourceColor[latest.source] : colors.violet })} initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}>
              {latest ? <Typewriter text={`“${latest.text}”`} /> : <span className="faint">Waiting for something worth saying.</span>}
              {latest && <span className="mono bsmPri">p{latest.priority} · {latest.eventType}</span>}
            </motion.div>
          </AnimatePresence>
          <ol className="spokenList">
            {spoken.slice(0, -1).reverse().map((l) => (
              <li key={l.at} style={{ "--lc": sourceColor[l.source] } as CSSProperties}>
                <span className="mono">{l.at.toFixed(1)}s</span> {l.text}
              </li>
            ))}
          </ol>
        </section>

        {/* Event flights from inputs to the arbiter */}
        {flights.map((f) => (
          <motion.span key={f.id} className="flight" style={motionVars({ "--fc": f.color })} initial={{ left: 330, top: f.y + 60, opacity: 1, scale: 1 }} animate={{ left: [330, 600, 980], top: [f.y + 60, 140, 260], opacity: [1, 1, 0], scale: [1, 1.4, 0.6] }} transition={{ duration: 0.9, ease: "easeInOut" }} onAnimationComplete={() => setFlights((list) => list.filter((x) => x.id !== f.id))} />
        ))}
      </div>

      {/* Timeline of the last 20 s */}
      <div className="speechTimeline glass">
        <span className="tlLabel mono">last 20 s</span>
        <div className="tlTrack">
          {marks.map((m, i) => (
            <span key={`${m.t}-${i}`} className={`tlMark ${m.kind}`} style={{ left: `${100 - ((clock - m.t) / 20) * 100}%`, "--mc": m.color } as CSSProperties} title={m.label}>
              {m.kind === "out" && <em>{m.label}</em>}
            </span>
          ))}
        </div>
        <span className="tlLegend"><i className="in" /> event <i className="out" /> spoken</span>
      </div>
    </div>
  );
};

// Reveal text a few characters at a time
const Typewriter = ({ text }: { text: string }) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = window.setInterval(() => setN((v) => (v >= text.length ? v : v + 2)), 22);
    return () => window.clearInterval(id);
  }, [text]);
  return <span>{text.slice(0, n)}<span className="caret" /></span>;
};
