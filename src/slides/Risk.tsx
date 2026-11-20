import { useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { colors } from "../theme";
import { Kicker, Slider } from "../components/ui";
import { useMotion, motionVars } from "../lib/hooks";
import { assessRisk, riskLevels, riskWeights, type RiskKey } from "../lib/hazards";

const signals: { key: RiskKey; name: string; color: string; origin: string }[] = [
  { key: "fallScore", name: "Possible fall", color: "#ff7a59", origin: "Wide, low person box" },
  { key: "voiceHelp", name: "Asked for help", color: colors.red, origin: "“help” or “emergency” heard" },
  { key: "nonResponse", name: "No response", color: "#ff9db0", origin: "Silence after a check-in, ramps over 10 s" },
  { key: "trafficThreat", name: "Traffic", color: colors.amber, origin: "Vehicle danger + side boost" },
  { key: "hazardProximity", name: "Hazard proximity", color: "#ffd98a", origin: "Nearest object, monocular" },
  { key: "immobility", name: "Not moving", color: colors.indigo, origin: "Centre barely moved in 2 s" },
  { key: "pathDanger", name: "Path danger", color: colors.cyan, origin: "Worst object in the corridor" },
];

const presets: { name: string; values: Partial<Record<RiskKey, number>> }[] = [
  { name: "Clear walk", values: {} },
  { name: "Bike close by", values: { trafficThreat: 0.95, hazardProximity: 0.7, pathDanger: 0.6 } },
  { name: "Fallen, silent", values: { fallScore: 0.9, immobility: 0.9, nonResponse: 0.8, hazardProximity: 0.3 } },
  { name: "Asked for help", values: { voiceHelp: 1, immobility: 0.6, fallScore: 0.6, nonResponse: 0.5, hazardProximity: 0.4 } },
];

const responses = [
  "Keep following. Speak only about hazards.",
  "Caution: hazard warnings take priority.",
  "Check in: “Are you okay? Say I am okay or say cancel.”",
  "Contact: log a message to the trusted contact.",
  "Emergency: log an emergency escalation.",
];

const levelColors = [colors.green, colors.amber, colors.orange, colors.red, colors.magenta];
const zero = Object.fromEntries(signals.map((s) => [s.key, 0])) as Record<RiskKey, number>;

export const Risk = () => {
  const [values, setValues] = useState<Record<RiskKey, number>>({ ...zero, hazardProximity: 0.7, pathDanger: 0.6, trafficThreat: 0.95 });
  const { reducedMotion } = useMotion();
  const result = assessRisk(values);
  let base = 0;
  const levelColor = levelColors[result.eventLevel];
  return (
    <div className="slide risk">
      <div className="riskCopy">
        <Kicker act="V" color={colors.red}>Risk engine</Kicker>
        <h2 className="title" style={{ fontSize: 56 }}>Seven signals, one number, <span className="grad" style={{ "--g1": colors.amber, "--g2": colors.red, "--g3": colors.magenta } as CSSProperties}>four ways to respond.</span></h2>
        <p className="body" style={{ fontSize: 20 }}>
          Each signal is clipped to 0–1 and weighted. The weights favour things that most likely mean a person is in trouble: a fall, a call for help, traffic.
        </p>
        <div className="controlBar" style={{ marginTop: 18 }}>
          {presets.map((p) => <button key={p.name} className="chip" onClick={() => setValues({ ...zero, ...p.values })}>{p.name}</button>)}
        </div>
        <div className="sliders riskSliders">
          {signals.map((s) => (
            <div key={s.key} className="riskSignal">
              <Slider label={`${s.name} ×${riskWeights[s.key].toFixed(2)}`} value={values[s.key]} min={0} max={1} step={0.01} accent={s.color} onChange={(v) => setValues((cur) => ({ ...cur, [s.key]: v }))} format={(v) => v.toFixed(2)} />
              <span className="signalOrigin">{s.origin}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="riskVisual">
        <div className="riskTower" aria-label={`Risk score ${result.riskScore.toFixed(2)}`}>
          <div className="riskPrism">
            {riskLevels.map((l) => (
              <div key={l.level} className={`riskThreshold ${result.eventLevel >= l.level ? "hit" : ""}`} style={{ bottom: `${l.value * 100}%`, "--tc": levelColors[l.level] } as CSSProperties}>
                <span>{l.name}</span>
                <span className="mono">{l.value.toFixed(2)}</span>
              </div>
            ))}
            {signals.map((s) => {
              const h = values[s.key] * riskWeights[s.key];
              const b = base;
              base += h;
              return (
                <motion.div
                  key={s.key}
                  className="riskSegment"
                  style={motionVars({ "--seg": s.color })}
                  animate={{ bottom: `${Math.min(1, b) * 100}%`, height: `${Math.max(0, Math.min(1 - b, h)) * 100}%` }}
                  transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 22 }}
                />
              );
            })}
          </div>
        </div>
        <div className="riskOutcome">
          <span className="riskNumber mono" style={{ color: levelColor, textShadow: `0 0 40px ${levelColor}` }}>{result.riskScore.toFixed(2)}</span>
          <span className="riskLevel" style={{ color: levelColor }}>
            Level {result.eventLevel}, {result.eventLevel ? riskLevels[result.eventLevel - 1].name.toLowerCase() : "normal"}
          </span>
          <p className="body" style={{ fontSize: 21 }}>{responses[result.eventLevel]}</p>
          {result.reasons.length > 0 && (
            <div className="reasonChips">
              {result.reasons.map((r) => <span key={r} className="pill" style={{ color: levelColor }}>{r}</span>)}
            </div>
          )}
          <p className="callout" style={{ fontSize: 16 }}>
            Escalations are written to a log with a 30 s cooldown. No calls or texts are placed; that keeps testing safe while the system matures.
          </p>
        </div>
      </div>
    </div>
  );
};
