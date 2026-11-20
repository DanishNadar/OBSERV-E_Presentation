import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { colors } from "../theme";
import { Kicker } from "../components/ui";
import { useMotion, motionVars } from "../lib/hooks";

// Category-level gaps from a public-source market scan; not head-to-head tests
const market = [
  { kind: "Canes and guide robots", names: "WeWALK, Glidance Glide", gap: "Watch the path, never you", color: colors.sky },
  { kind: "Wearable guides", names: "biped NOA, .lumen", gap: "Worn on the body, costly", color: colors.indigo },
  { kind: "Apps and smart glasses", names: "Be My Eyes, Seeing AI, Envision", gap: "Help on demand; you aim", color: colors.violet },
  { kind: "Room cameras and companions", names: "SafelyYou, ElliQ", gap: "Stay in one room", color: colors.amber },
];

const widen = [
  { text: "Escalation that really calls someone", color: colors.red },
  { text: "Sees locally, keeps no video", color: colors.green },
  { text: "Ask it: what’s ahead? why did you say that?", color: colors.magenta },
  { text: "Weekly walking report for family", color: colors.amber },
  { text: "Subscription, not a $5k purchase", color: colors.sky },
  { text: "Venues own fleets; users ride free", color: colors.cyan },
];

export const Edge = () => {
  const { reducedMotion } = useMotion();
  return (
    <div className="slide edge">
      <Kicker act="IX" color={colors.cyan}>Future prospects · competitive edge</Kicker>
      <h2 className="title" style={{ fontSize: 58, maxWidth: 1600 }}>
        Others watch the path or a room. <span className="grad" style={{ "--g1": colors.cyan, "--g2": colors.violet, "--g3": colors.magenta } as CSSProperties}>OBSERV-E watches you and the path.</span>
      </h2>
      <div className="edgeGrid">
        <div className="edgeMarket">
          {market.map((m, i) => (
            <motion.div
              key={m.kind}
              className="edgeRow glass"
              style={motionVars({ "--ec": m.color })}
              initial={reducedMotion ? false : { opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
            >
              <div>
                <b>{m.kind}</b>
                <span className="mono faint">{m.names}</span>
              </div>
              <span className="edgeGap">{m.gap}</span>
            </motion.div>
          ))}
          <p className="mono faint" style={{ fontSize: 14, margin: "6px 0 0" }}>Public-source market scan, Nov 2026. Not head-to-head tested.</p>
        </div>
        <div className="edgeUs glass">
          <h3>OBSERV-E keeps you in view</h3>
          <p className="body" style={{ fontSize: 22, margin: "0 0 22px" }}>One robot warns about what is ahead and notices when you fall.</p>
          <p className="edgeVerbs"><span className="c-cyan">Follows</span> · <span className="c-amber">predicts</span> · <span className="c-magenta">warns</span> · <span className="c-green">checks in</span></p>
          <h4 className="edgeWidenHead">Features that widen the gap <span className="prov-future provenanceInline">Future direction</span></h4>
          <ul className="edgeWiden">
            {widen.map((w) => (
              <li key={w.text} style={{ "--wc": w.color } as CSSProperties}>{w.text}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
