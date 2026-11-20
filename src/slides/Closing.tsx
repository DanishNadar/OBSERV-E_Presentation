import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { ContactShadows, Float, PresentationControls, Sparkles } from "@react-three/drei";
import { colors } from "../theme";
import { Logo, Motif } from "../components/ui";
import { useMotion } from "../lib/hooks";
import { StageCanvas } from "../three/StageCanvas";
import { ObserveRobot } from "../three/ObserveRobot";

const team = ["Braulio Gomez", "Ashhar Adnan", "Julian Ogden", "Danish Nadar"];

export const Closing = () => {
  const { reducedMotion } = useMotion();
  return (
    <div className="slide closing">
      <div className="closingStage">
        <StageCanvas camera={{ position: [-5, 3, 7], fov: 34 }} frameloop={reducedMotion ? "demand" : "always"}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[-4, 8, 5]} intensity={2.2} />
          <pointLight position={[3, 3, 2]} intensity={30} color={colors.magenta} />
          <pointLight position={[-3, 1, 4]} intensity={20} color={colors.cyan} />
          <PresentationControls global={false} azimuth={[-0.9, 0.9]} polar={[-0.1, 0.2]} snap>
            <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.5}>
              <group position={[0, -1, 0]} rotation={[0, 0.5, 0]}>
                <ObserveRobot autoScan={!reducedMotion} beamColor={colors.magenta} />
                <ContactShadows opacity={0.5} scale={7} blur={2.4} far={3} />
              </group>
            </Float>
          </PresentationControls>
          <Sparkles count={90} scale={[9, 5, 9]} size={3} speed={0.35} color={colors.cyan} />
        </StageCanvas>
      </div>
      <div className="closingCopy">
        <motion.div initial={reducedMotion ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} style={{ position: "relative" }}>
          <div className="logoHalo" style={{ width: 380, height: 380, left: -70, top: -80 }} />
          <Logo height={200} />
        </motion.div>
        <h2 className="title" style={{ fontSize: 80, maxWidth: 980, marginTop: 30 }}>
          Giving machines the ability to <span className="c-cyan">see</span>, <span className="c-violet">understand</span>, and <span className="grad" style={{ "--g1": colors.magenta, "--g2": colors.orange } as CSSProperties}>assist.</span>
        </h2>
        <Motif delay={0.6} />
        <div className="teamRow">
          <span className="faint mono">Team</span>
          {team.map((n) => <span key={n} className="teamName">{n}</span>)}
        </div>
        <p className="mono faint" style={{ fontSize: 17, marginTop: 8 }}>github.com/DanishNadar/OBSERV-E</p>
      </div>
    </div>
  );
};
