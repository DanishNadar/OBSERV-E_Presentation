import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { colors } from "../theme";
import { Kicker } from "../components/ui";
import { useMotion, motionVars } from "../lib/hooks";

const tagColor = { Safety: colors.red, ML: colors.violet, CV: colors.cyan, Product: colors.orange, Proof: colors.lime } as const;
type Tag = keyof typeof tagColor;

const horizons: { name: string; when: string; color: string; items: { text: string; tag: Tag }[] }[] = [
  {
    name: "Now", when: "weeks", color: colors.green, items: [
      { text: "Link lost, wheels stop", tag: "Safety" },
      { text: "Say “help”, always get help", tag: "Safety" },
      { text: "Remembers you, not the centre box", tag: "CV" },
      { text: "Score every warning on recorded walks", tag: "Proof" },
    ],
  },
  {
    name: "Next", when: "months", color: colors.amber, items: [
      { text: "Curbs, stairs and poles by name", tag: "CV" },
      { text: "Metres and seconds, not pixels", tag: "CV" },
      { text: "Risk weights learned from use", tag: "ML" },
      { text: "Warnings you feel, on the right side", tag: "Product" },
    ],
  },
  {
    name: "Later", when: "1+ year", color: colors.magenta, items: [
      { text: "No frames leave the robot", tag: "ML" },
      { text: "Walk a route once, remember it", tag: "CV" },
      { text: "A shared hazard map of the city", tag: "Product" },
      { text: "Pilots in care homes and campuses", tag: "Proof" },
    ],
  },
];

export const Horizons = () => {
  const { reducedMotion } = useMotion();
  return (
    <div className="slide horizons">
      <Kicker act="IX" color={colors.magenta}>Future prospects</Kicker>
      <h2 className="title" style={{ fontSize: 58, maxWidth: 1500 }}>
        From prototype to product, <span className="grad" style={{ "--g1": colors.green, "--g2": colors.amber, "--g3": colors.magenta } as CSSProperties}>in three horizons.</span>
        <span className="prov-future provenanceInline">Future direction</span>
      </h2>
      <div className="horizonGrid">
        <div className="horizonRail" />
        {horizons.map((h, i) => (
          <motion.div
            key={h.name}
            className="horizonCol glass"
            style={motionVars({ "--hc": h.color })}
            initial={reducedMotion ? false : { opacity: 0, y: 30, rotateX: -30 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.2 + i * 0.18, duration: 0.6 }}
          >
            <div className="horizonHead">
              <h3>{h.name}</h3>
              <span>{h.when}</span>
            </div>
            <ul className="horizonList">
              {h.items.map((it) => (
                <li key={it.text}>
                  <span>{it.text}</span>
                  <span className="horizonTag" style={{ color: tagColor[it.tag] }}>{it.tag}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
      <div className="tourRow">
        <p className="callout violet" style={{ margin: 0, fontSize: 20, maxWidth: "90ch" }}>
          Each step ships only when it beats today’s pipeline on the same recorded walks.
        </p>
        <a className="chip magenta tourLink" href="features.html#next">See future features as 3D scenes <ArrowRight size={20} /></a>
      </div>
    </div>
  );
};
