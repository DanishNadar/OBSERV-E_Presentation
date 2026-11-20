import { useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { colors } from "../theme";
import { Kicker, Tilt } from "../components/ui";

const statusColor = {
  Implemented: colors.cyan,
  Optional: colors.violet,
  "In progress": colors.green,
  "Test-safe stand-in": colors.amber,
  "Next up": colors.magenta,
} as const;
type Status = keyof typeof statusColor;

const items: { name: string; status: Status; evidence: string }[] = [
  { name: "YOLO person detection", status: "Implemented", evidence: "detector.py" },
  { name: "Target selection and re-acquisition", status: "Implemented", evidence: "targetSelector.py, pipeline.py" },
  { name: "Tracker with optical-flow fallback", status: "Implemented", evidence: "correlationTracker.py" },
  { name: "6-state Kalman prediction", status: "Implemented", evidence: "kalmanFilter.py" },
  { name: "100–300 Hz gimbal state output", status: "Implemented", evidence: "gimbalOutput.py, runCameraDemo.py" },
  { name: "Hazard detection and scoring", status: "Implemented", evidence: "hazardDetector.py" },
  { name: "Risk engine and event levels", status: "Implemented", evidence: "riskEngine.py" },
  { name: "Speech planner", status: "Implemented", evidence: "conversationSpeech.py" },
  { name: "Voice companion web app", status: "Implemented", evidence: "companion web app" },
  { name: "BLE motor control firmware", status: "Implemented", evidence: "car_firmware/" },
  { name: "IMU streaming firmware", status: "Implemented", evidence: "observe_firmware/" },
  { name: "Vision-language scene summaries", status: "Optional", evidence: "groqVisionNarrator.py, off by default" },
  { name: "Closed-loop gimbal stabilization", status: "In progress", evidence: "Pieces exist; loop being joined" },
  { name: "Slip-ring turret, continuous yaw", status: "In progress", evidence: "Turret design" },
  { name: "Emergency contact outreach", status: "Test-safe stand-in", evidence: "outreach.py logs instead of calling" },
  { name: "Speech-to-text input", status: "Test-safe stand-in", evidence: "--voiceText flag feeds the parser" },
  { name: "Depth sensing", status: "Next up", evidence: "Proximity is monocular today" },
  { name: "Measured accuracy and latency", status: "Next up", evidence: "Recorded-walk benchmarks planned" },
];

export const Built = () => {
  const [filter, setFilter] = useState<"All" | Status>("All");
  const counts = Object.fromEntries((Object.keys(statusColor) as Status[]).map((s) => [s, items.filter((i) => i.status === s).length]));
  return (
    <div className="slide built">
      <div className="builtHead">
        <div>
          <Kicker act="VIII" color={colors.cyan}>Building it</Kicker>
          <h2 className="title" style={{ fontSize: 58, marginBottom: 0 }}>Where the build <span className="grad">stands today.</span></h2>
          <a className="chip green tourLink" href="features.html#today">See today’s features as 3D scenes <ArrowRight size={20} /></a>
        </div>
        <div className="controlBar">
          {(["All", ...Object.keys(statusColor)] as ("All" | Status)[]).map((s) => (
            <button key={s} className={`chip ${filter === s ? "on" : ""}`} style={s !== "All" ? ({ "--chipc": statusColor[s] } as CSSProperties) : undefined} onClick={() => setFilter(s)}>
              {s !== "All" && <span className="statusDot" style={{ background: statusColor[s] }} />}
              {s}{s !== "All" && <span className="mono faint"> {counts[s]}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="capGrid">
        {items.map((item, i) => {
          const dim = filter !== "All" && filter !== item.status;
          const color = statusColor[item.status];
          return (
            <motion.div key={item.name} initial={{ opacity: 0, y: 20, rotateX: -30 }} animate={{ opacity: dim ? 0.16 : 1, y: 0, rotateX: 0, scale: dim ? 0.97 : 1 }} transition={{ duration: 0.4, delay: i * 0.025 }}>
              <Tilt className="capItem glass" style={{ "--cc": color } as CSSProperties} max={10}>
                <span className="statusDot" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
                <div>
                  <div className="capName">{item.name}</div>
                  <div className="capEvidence"><span style={{ color }}>{item.status}</span>  <span className="mono">{item.evidence}</span></div>
                </div>
              </Tilt>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
