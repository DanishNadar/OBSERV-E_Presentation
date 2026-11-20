import { useState, type CSSProperties } from "react";
import { motionVars } from "../lib/hooks";
import { AnimatePresence, motion } from "framer-motion";
import { colors } from "../theme";
import { Kicker, Tilt } from "../components/ui";

const challenges = [
  { title: "Trackers crashed on bad boxes", color: colors.red, problem: "Some OpenCV tracker backends rejected boxes that touched the frame edge or had zero size, and threw on initialization.", response: "Boxes are sanitized before init, and the tracker falls through CSRT, KCF and MIL to a homemade optical-flow tracker that always works.", source: "correlationTracker.py" },
  { title: "Vision is slower than control", color: colors.amber, problem: "A CPU detector can’t run at the 100–300 Hz a gimbal loop wants.", response: "A separate projector thread samples the Kalman state and extrapolates it, so control output never waits for inference.", source: "pipeline.py sampleProjectionPayload; runCameraDemo --controlHz" },
  { title: "People are hard to see in real scenes", color: colors.cyan, problem: "Crowds, partial views and walking poses defeat a stock detector.", response: "Scripts merge COCO, CrowdHuman and WiderPerson into a person-only dataset for fine-tuning, and a benchmark compares yolo11n and yolo26n on lock quality, not just FPS.", source: "prepareHumanRobustDataset.py, fineTunePersonModel.py, benchmarkModels.py" },
  { title: "Every servo is a little different", color: colors.green, problem: "Pulse-width-to-angle varies between units.", response: "A dedicated STM32F401 rig steps the servo in 0.05 ms increments, runs a full-swing step test and logs supply voltage; the width mapping is a regression across the servos used.", source: "servo_classification/, servo_helper.h" },
  { title: "A cable that winds up", color: colors.orange, problem: "A camera that keeps turning to follow someone eventually twists its own cable.", response: "The turret is designed around a slip ring that carries power and signal through the rotating joint, so yaw can be continuous.", source: "Turret design, in progress" },
  { title: "Talking too much is its own hazard", color: colors.violet, problem: "Announcing every detection would bury the warnings that matter.", response: "The speech planner speaks only on change, ranks by priority and enforces gaps and cooldowns.", source: "conversationSpeech.py" },
];

export const Challenges = () => {
  const [active, setActive] = useState(0);
  const c = challenges[active];
  return (
    <div className="slide challenges">
      <Kicker act="VI" color={colors.orange}>Engineering challenges</Kicker>
      <h2 className="title" style={{ fontSize: 58, maxWidth: 1500 }}>What makes it hard, and <span className="grad" style={{ "--g1": colors.orange, "--g2": colors.magenta, "--g3": colors.violet } as CSSProperties}>what the code does about it.</span></h2>
      <div className="challengeGrid">
        <div className="challengeCards">
          {challenges.map((ch, i) => (
            <Tilt key={ch.title} className={`challengeCard glass ${i === active ? "on" : ""}`} style={{ "--cc": ch.color } as CSSProperties} onClick={() => setActive(i)} role="button" tabIndex={0} max={12}>
              <span className="mono">{String(i + 1).padStart(2, "0")}</span>
              <b>{ch.title}</b>
            </Tilt>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={active} className="challengeDetail glass" style={motionVars({ "--cc": c.color })} initial={{ opacity: 0, y: 16, rotateX: -10 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }}>
            <span className="chNum mono">{String(active + 1).padStart(2, "0")}</span>
            <h3 style={{ color: c.color }}>{c.title}</h3>
            <p className="challengeProblem">{c.problem}</p>
            <div className="chArrow" />
            <p className="body" style={{ fontSize: 25, maxWidth: "44ch", color: "#eef3fa" }}>{c.response}</p>
            <p className="mono faint" style={{ fontSize: 16, marginTop: 26 }}>Evidence: {c.source}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
