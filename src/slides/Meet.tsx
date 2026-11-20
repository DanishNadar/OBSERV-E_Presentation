import { useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ContactShadows, Html, OrbitControls } from "@react-three/drei";
import { Camera, Cpu, Disc3, Move, ScanEye, Volume2 } from "lucide-react";
import { colors } from "../theme";
import { Aperture, Kicker, Tilt } from "../components/ui";
import { useMotion, motionVars } from "../lib/hooks";
import { StageCanvas } from "../three/StageCanvas";
import { ObserveRobot, type RobotPart } from "../three/ObserveRobot";

const parts = [
  {
    id: "camera" as const,
    name: "External camera on a pan-tilt stage",
    icon: Camera,
    color: colors.cyan,
    at: [0.1, 2.25, -0.05] as [number, number, number],
    text: "A dedicated USB camera rides on a 3D-printed pan-tilt bracket driven by a GoBilda servo, with a BNO085 IMU on the same assembly. Its frames feed the whole vision pipeline.",
    spec: "USB camera · servo PWM 1.5 ± 0.6 ms · IMU at 1 kHz",
  },
  {
    id: "turret" as const,
    name: "Slip-ring turret",
    icon: Disc3,
    color: colors.amber,
    at: [-0.45, 0.95, 0.3] as [number, number, number],
    text: "The camera stage sits on a rotating turret designed around a slip ring, so it can keep turning in one direction without winding up its cable.",
    spec: "Continuous yaw · power and signal through the joint",
  },
  {
    id: "compute" as const,
    name: "On-board mini PC",
    icon: Cpu,
    color: colors.indigo,
    at: [0.55, 1.0, -0.35] as [number, number, number],
    text: "Runs YOLO detection, target selection, tracking, the Kalman predictor, hazard scoring, risk and speech planning. Tuned for CPU inference at 416 px.",
    spec: "Python · Ultralytics YOLO · OpenCV · NumPy",
  },
  {
    id: "base" as const,
    name: "Four-motor mecanum base",
    icon: Move,
    color: colors.green,
    at: [-1.05, 0.35, 0.95] as [number, number, number],
    text: "An STM32WB55 receives four signed motor commands over Bluetooth LE and drives two Sabertooth 2x12 controllers over packetized serial.",
    spec: "BLE peripheral “OBSV” · 4 × int8 speeds",
  },
  {
    id: "face" as const,
    name: "Face and voice companion",
    icon: Volume2,
    color: colors.magenta,
    at: [0.5, 1.15, 0.9] as [number, number, number],
    text: "A friendly face up front, and a web companion that shows exactly what OBSERV-E will say before streaming it through ElevenLabs over Bluetooth, USB serial or a network bridge.",
    spec: "Priority speech planner · ElevenLabs TTS",
  },
];

export const Meet = () => {
  const [selected, setSelected] = useState<(typeof parts)[number]["id"]>("camera");
  const [xray, setXray] = useState(false);
  const { reducedMotion } = useMotion();
  const part = parts.find((p) => p.id === selected)!;
  return (
    <div className="slide meet">
      <div className="meetCopy">
        <Kicker act="II" color={colors.violet}>Introducing OBSERV-E</Kicker>
        <h2 className="title" style={{ fontSize: 58 }}>
          A camera that <span className="c-cyan">follows you</span>, a computer that <span className="c-amber">thinks ahead</span>, a voice that <span className="c-magenta">tells you what's coming.</span>
        </h2>
        <div className="partList">
          {parts.map((p) => {
            const Icon = p.icon;
            return (
              <Tilt key={p.id} className={`partChip ${p.id === selected ? "on" : ""}`} style={{ "--pc": p.color } as CSSProperties} onClick={() => setSelected(p.id)} role="button" tabIndex={0} aria-pressed={p.id === selected} max={14}>
                <Icon size={22} />
                <span>{p.name}</span>
              </Tilt>
            );
          })}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={part.id} className="partCard glass" style={motionVars({ "--pc": part.color })} initial={reducedMotion ? false : { opacity: 0, y: 14, rotateX: -12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}>
            <h3>{part.name}</h3>
            <p className="body" style={{ fontSize: 21 }}>{part.text}</p>
            <span className="mono partSpec">{part.spec}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      <Aperture style={{ left: 1000, top: 96, width: 810, height: 840 }} provenance="schematic" provenanceText="3D concept, styled on our prototype" glow={part.color}>
        <StageCanvas camera={{ position: [4.6, 3.3, 5.6], fov: 36 }} frameloop={reducedMotion ? "demand" : "always"}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[4, 8, 5]} intensity={2.2} />
          <pointLight position={[-3, 2, 3]} intensity={25} color={part.color} />
          <group position={[0, -1, 0]}>
            <ObserveRobot autoScan={!reducedMotion} xray={xray} highlight={selected as RobotPart} beamColor={part.color} />
            {parts.map((p) => (
              <Html key={p.id} position={p.at} center zIndexRange={[10, 0]}>
                <button className="hotDot" style={{ "--hc": p.color } as CSSProperties} onClick={() => setSelected(p.id)} aria-label={p.name} />
              </Html>
            ))}
            <ContactShadows opacity={0.55} scale={7} blur={2.2} far={3} />
          </group>
          <OrbitControls enableZoom={false} enablePan={false} autoRotate={!reducedMotion} autoRotateSpeed={0.6} minPolarAngle={0.6} maxPolarAngle={1.45} />
        </StageCanvas>
        <div className="meetTools">
          <button className={`chip ${xray ? "on violet" : ""}`} onClick={() => setXray((v) => !v)}>
            <ScanEye size={18} /> X-ray shell
          </button>
          <span className="faint" style={{ fontSize: 15 }}>Drag to orbit · click a dot</span>
        </div>
        <figure className="protoThumb glass">
          <img src="./img/observe-prototype.png" alt="The OBSERV-E prototype build" />
          <figcaption>Current prototype build</figcaption>
        </figure>
      </Aperture>
    </div>
  );
};
