import { useRef, type MutableRefObject } from "react";
import { motion } from "framer-motion";
import { useFrame } from "@react-three/fiber";
import { ContactShadows, Html, PresentationControls, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { colors } from "../theme";
import { Logo, Motif } from "../components/ui";
import { useMotion } from "../lib/hooks";
import { StageCanvas } from "../three/StageCanvas";
import { ObserveRobot } from "../three/ObserveRobot";

// Rotating holographic rings under the robot
const HoloPlatform = () => {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (a.current) a.current.rotation.z += dt * 0.35;
    if (b.current) b.current.rotation.z -= dt * 0.22;
  });
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <mesh>
        <circleGeometry args={[2.6, 64]} />
        <meshBasicMaterial color={colors.violet} transparent opacity={0.08} />
      </mesh>
      <mesh ref={a}>
        <ringGeometry args={[2.3, 2.36, 96, 1, 0, Math.PI * 1.4]} />
        <meshBasicMaterial color={colors.cyan} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={b}>
        <ringGeometry args={[2.7, 2.72, 96, 1, 0.6, Math.PI * 0.9]} />
        <meshBasicMaterial color={colors.magenta} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <ringGeometry args={[1.9, 1.92, 96]} />
        <meshBasicMaterial color={colors.amber} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// Hologram of the person being followed; the pan stage turns to keep them centred
const HoloPerson = ({ yawRef }: { yawRef: MutableRefObject<number> }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const x = 2.1 + Math.sin(t * 0.5) * 0.4;
    const z = -0.2 + Math.sin(t * 0.37) * 1.7;
    ref.current.position.set(x, 0, z);
    const goal = Math.atan2(x, z + 0.1);
    yawRef.current += (goal - yawRef.current) * Math.min(1, dt * 4);
  });
  return (
    <group ref={ref} scale={0.58}>
      <mesh position={[0, 0.85, 0]}>
        <capsuleGeometry args={[0.22, 0.85, 6, 16]} />
        <meshBasicMaterial color={colors.green} transparent opacity={0.28} />
      </mesh>
      <mesh position={[0, 1.62, 0]}>
        <sphereGeometry args={[0.18, 20, 20]} />
        <meshBasicMaterial color={colors.green} transparent opacity={0.35} />
      </mesh>
      <lineSegments position={[0, 0.95, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(0.8, 1.95, 0.5)]} />
        <lineBasicMaterial color={colors.green} />
      </lineSegments>
      <Html position={[0, 2.1, 0]} center>
        <div className="hotLabel" style={{ ["--hc" as string]: colors.green }}>person 0.91 · LOCK</div>
      </Html>
    </group>
  );
};

export const Hook = () => {
  const { reducedMotion } = useMotion();
  const yawRef = useRef(1.5);
  return (
    <div className="slide hook">
      <div className="hookStage">
        <StageCanvas camera={{ position: [5.2, 3.4, 7.4], fov: 34 }} frameloop={reducedMotion ? "demand" : "always"}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[4, 8, 5]} intensity={2.2} />
          <pointLight position={[-4, 3, 2]} intensity={30} color={colors.violet} />
          <pointLight position={[3, 1, 4]} intensity={20} color={colors.cyan} />
          <PresentationControls global={false} polar={[-0.1, 0.2]} azimuth={[-0.8, 0.8]} snap>
            <group position={[-0.3, -0.9, -0.2]} rotation={[0, 0.25, 0]}>
              <ObserveRobot yawRef={yawRef} beamColor={colors.green} />
              <HoloPlatform />
              <HoloPerson yawRef={yawRef} />
              <ContactShadows position={[0, 0, 0]} opacity={0.6} scale={8} blur={2.4} far={3} color="#000" />
            </group>
          </PresentationControls>
          <Sparkles count={70} scale={[8, 4, 8]} size={3} speed={0.3} color={colors.violet} />
        </StageCanvas>
      </div>
      <div className="vignette" />

      <div className="hookCopy">
        <motion.div className="hookLogoWrap" initial={reducedMotion ? false : { opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}>
          <div className="logoHalo" style={{ width: 520, height: 520, left: -90, top: -110 }} />
          <Logo height={300} />
        </motion.div>
        <motion.p className="hookTag grad" initial={reducedMotion ? false : { opacity: 0, letterSpacing: "0.3em" }} animate={{ opacity: 1, letterSpacing: "-0.02em" }} transition={{ delay: 0.4, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}>
          Better robots. Better vision.
        </motion.p>
        <p className="lede hookLede">
          A new assistive robot that keeps a person in view, predicts where they're going, and speaks up about what's in their path.
        </p>
        <Motif size="lg" delay={1.1} />
      </div>
      <p className="hookFooter">
        <span className="pill c-green">● In development</span>
        <span>External camera · Mini PC · Mecanum base · Voice companion</span>
      </p>
    </div>
  );
};
