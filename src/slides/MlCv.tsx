import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, ScanEye } from "lucide-react";
import { colors } from "../theme";
import { Kicker } from "../components/ui";
import { useMotion } from "../lib/hooks";

// Same horizon colors as the three-horizons slide
const when = { Now: colors.green, Next: colors.amber, Later: colors.magenta } as const;
type When = keyof typeof when;

const panels: { title: string; icon: typeof BrainCircuit; color: string; items: { name: string; how: string; when: When }[] }[] = [
  {
    title: "Machine learning", icon: BrainCircuit, color: colors.violet, items: [
      { name: "Hears you offline", how: "Whisper-class speech-to-text and intent on the CPU", when: "Now" },
      { name: "Knows walking, turning, stopping", how: "Multiple-model filter in place of one constant-velocity model", when: "Now" },
      { name: "Risk weights learned from use", how: "Calibrated model trained on the event logs", when: "Next" },
      { name: "Every near-miss becomes data", how: "Auto-flag hard moments, label, retrain", when: "Next" },
      { name: "No frames leave the robot", how: "Small vision-language model on board", when: "Later" },
    ],
  },
  {
    title: "Computer vision", icon: ScanEye, color: colors.cyan, items: [
      { name: "Remembers you, not the centre box", how: "Re-ID embeddings keep the lock through crowds", when: "Now" },
      { name: "Falls from skeletons", how: "Pose keypoints replace the “wide, low box” rule", when: "Now" },
      { name: "Hazards named in plain words", how: "Open-vocabulary detection: curb, stairs, pole", when: "Next" },
      { name: "Metres and seconds, not pixels", how: "Monocular depth and time-to-contact", when: "Next" },
      { name: "Where it is safe to step", how: "Walkable-surface and drop-off segmentation", when: "Later" },
    ],
  },
];

export const MlCv = () => {
  const { reducedMotion } = useMotion();
  return (
    <div className="slide mlcv">
      <Kicker act="IX" color={colors.violet}>Future prospects · ML and CV</Kicker>
      <h2 className="title" style={{ fontSize: 58, maxWidth: 1500 }}>
        Sharper eyes, <span className="grad" style={{ "--g1": colors.cyan, "--g2": colors.violet, "--g3": colors.magenta } as CSSProperties}>a brain that learns.</span>
        <span className="prov-future provenanceInline">Future direction</span>
      </h2>
      <div className="mlcvGrid">
        {panels.map((p, pi) => {
          const Icon = p.icon;
          return (
            <div key={p.title} className="mlcvPanel glass" style={{ "--pc": p.color } as CSSProperties}>
              <h3><Icon size={30} /> {p.title}</h3>
              <ul className="mlcvList">
                {p.items.map((it, i) => (
                  <motion.li
                    key={it.name}
                    initial={reducedMotion ? false : { opacity: 0, x: pi ? 30 : -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.1, duration: 0.5 }}
                  >
                    <b>{it.name}</b>
                    <span className="pill" style={{ color: when[it.when] }}>{it.when}</span>
                    <p>{it.how}</p>
                  </motion.li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};
