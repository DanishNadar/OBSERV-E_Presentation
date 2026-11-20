import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { colors } from "../theme";
import { Kicker } from "../components/ui";
import { useMotion, motionVars } from "../lib/hooks";

const today = [
  "Proximity and risk come from one camera image. No depth, no ground truth.",
  "Hazard classes are COCO labels; curbs, stairs and holes aren’t among them yet.",
  "Escalation and speech input are test-safe stand-ins.",
  "The gimbal control loop is still being closed.",
  "No measured accuracy, latency or user testing yet.",
];

const next = [
  { text: "Close the loop: drive the pan stage from normalizedError, stabilized by the IMU.", color: colors.amber },
  { text: "Finish the slip-ring turret for continuous yaw.", color: colors.orange },
  { text: "Add depth (stereo or ToF) so proximity is measured, not inferred.", color: colors.cyan },
  { text: "Train hazard classes that matter for walking: curbs, steps, poles.", color: colors.green },
  { text: "Measure lock rate, prediction error and warning latency on recorded walks.", color: colors.violet },
  { text: "Co-design with blind and low-vision users before any real-world use.", color: colors.magenta },
];

export const Roadmap = () => {
  const { reducedMotion } = useMotion();
  return (
    <div className="slide roadmap">
      <Kicker act="IX" color={colors.magenta}>Limitations and what’s next</Kicker>
      <h2 className="title" style={{ fontSize: 58, maxWidth: 1500 }}>
        A robot that thinks ahead, and is <span className="grad" style={{ "--g1": colors.magenta, "--g2": colors.violet, "--g3": colors.cyan } as CSSProperties}>honest about how far ahead.</span>
      </h2>
      <div className="limitGrid">
        <div className="panel">
          <h3 className="c-amber">Today</h3>
          <ul className="limitList">{today.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        <div className="roadPath">
          <h3>Next <span className="prov-future provenanceInline">Future direction</span></h3>
          <ol>
            {next.map((n, i) => (
              <motion.li key={n.text} style={motionVars({ "--rc": n.color })} initial={reducedMotion ? false : { opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.12 }}>
                <span className="roadNode mono">{String(i + 1).padStart(2, "0")}</span>
                <span>{n.text}</span>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
      <p className="callout red" style={{ position: "absolute", left: 112, bottom: 118, fontSize: 19, maxWidth: "100ch" }}>
        OBSERV-E is an early prototype in active development. Its hazard awareness is not validated or certified, and it should not be relied on for real-world navigation.
      </p>
    </div>
  );
};
