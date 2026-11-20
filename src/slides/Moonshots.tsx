import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { Accessibility, Ear, Footprints, KeyRound, MapPinned, MessageCircleQuestion } from "lucide-react";
import { colors } from "../theme";
import { Kicker, Tilt } from "../components/ui";
import { useMotion } from "../lib/hooks";

const ideas = [
  { icon: Ear, title: "Ears for the blind spot", line: "A mic array hears sirens, horns and bells behind you.", color: colors.cyan },
  { icon: MessageCircleQuestion, title: "Ask it why", line: "“Why did you say that?” It reads back the signals.", color: colors.violet },
  { icon: KeyRound, title: "It remembers what it saw", line: "“Where did I leave my keys?”", color: colors.amber },
  { icon: Footprints, title: "Catch the stumble early", line: "Gait drift becomes a risk signal before a fall.", color: colors.green },
  { icon: Accessibility, title: "One brain, any wheels", line: "A clip-on head for walkers, wheelchairs and carts.", color: colors.orange },
  { icon: MapPinned, title: "Every walk maps the city", line: "Robots share hazards and hand travellers off.", color: colors.magenta },
];

export const Moonshots = () => {
  const { reducedMotion } = useMotion();
  return (
    <div className="slide moonshots">
      <Kicker act="IX" color={colors.magenta}>Future prospects · moonshots</Kicker>
      <h2 className="title" style={{ fontSize: 58, maxWidth: 1500 }}>
        Same pieces, <span className="grad" style={{ "--g1": colors.magenta, "--g2": colors.orange, "--g3": colors.amber } as CSSProperties}>bigger ideas.</span>
        <span className="prov-future provenanceInline">Future direction</span>
      </h2>
      <div className="moonGrid">
        {ideas.map((m, i) => {
          const Icon = m.icon;
          return (
            <motion.div key={m.title} initial={reducedMotion ? false : { opacity: 0, y: 30, rotateX: -40 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.15 + i * 0.1, duration: 0.6 }}>
              <Tilt className="moonCard glass" style={{ "--mc": m.color } as CSSProperties} max={12}>
                <Icon size={40} />
                <h4>{m.title}</h4>
                <p>{m.line}</p>
              </Tilt>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
