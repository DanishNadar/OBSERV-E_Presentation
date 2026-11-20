import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { Eye, EyeOff } from "lucide-react";
import { colors } from "../theme";
import { Aperture, Kicker } from "../components/ui";
import { useMotion } from "../lib/hooks";
import { StageCanvas } from "../three/StageCanvas";

interface Obstacle {
  id: string;
  label: string;
  color: string;
  position: [number, number, number];
  size: [number, number, number];
  risk: "low" | "elevated" | "high";
  note: string;
  moving?: { axis: "x" | "z"; speed: number; range: number };
}

// Everyday things on a walk, each with its own color
const obstacles: Obstacle[] = [
  { id: "bench", label: "bench", color: colors.violet, position: [-2.3, 0, -3.5], size: [1.8, 0.9, 0.6], risk: "elevated", note: "Edge of the path" },
  { id: "cone", label: "traffic cone", color: colors.orange, position: [0.5, 0, -1.6], size: [0.45, 0.75, 0.45], risk: "high", note: "Directly ahead" },
  { id: "bicycle", label: "bicycle", color: colors.sky, position: [3, 0, -5.5], size: [1.6, 1.0, 0.4], risk: "high", note: "Crossing from the right", moving: { axis: "x", speed: 0.45, range: 4 } },
  { id: "chair", label: "chair", color: colors.lime, position: [-0.7, 0, 0.8], size: [0.6, 0.95, 0.6], risk: "elevated", note: "Left in the walkway" },
  { id: "plant", label: "potted plant", color: colors.green, position: [2.1, 0, -0.4], size: [0.6, 1.1, 0.6], risk: "low", note: "Off the path" },
  { id: "bin", label: "trash can", color: colors.magenta, position: [-2.4, 0, 1.2], size: [0.55, 0.9, 0.55], risk: "low", note: "Kerbside" },
  { id: "car", label: "car", color: colors.indigo, position: [5.6, 0, -9], size: [2.0, 1.2, 4], risk: "high", note: "Road traffic", moving: { axis: "z", speed: 1.2, range: 7 } },
];

const riskColor = { low: colors.green, elevated: colors.amber, high: colors.red };

// Glassy material that brightens when OBSERV-E is looking
const Glass = ({ color, aware }: { color: string; aware: boolean }) => (
  <meshPhysicalMaterial color={aware ? color : "#3a4060"} emissive={color} emissiveIntensity={aware ? 0.35 : 0.02} transparent opacity={aware ? 0.82 : 0.32} roughness={0.2} clearcoat={1} />
);

// Low-poly shapes per class
const Shape = ({ o, aware }: { o: Obstacle; aware: boolean }) => {
  const [w, h, d] = o.size;
  const m = <Glass color={o.color} aware={aware} />;
  switch (o.id) {
    case "cone":
      return (
        <group>
          <mesh position={[0, h / 2, 0]}><coneGeometry args={[w / 2, h, 24]} />{m}</mesh>
          <mesh position={[0, 0.03, 0]}><boxGeometry args={[w * 1.2, 0.06, w * 1.2]} />{m}</mesh>
        </group>
      );
    case "bench":
      return (
        <group>
          <RoundedBox args={[w, 0.08, d]} radius={0.03} position={[0, h * 0.5, 0]}>{m}</RoundedBox>
          <RoundedBox args={[w, 0.4, 0.06]} radius={0.03} position={[0, h * 0.8, -d / 2]}>{m}</RoundedBox>
          {[-w / 2 + 0.12, w / 2 - 0.12].map((x) => <mesh key={x} position={[x, h * 0.25, 0]}><boxGeometry args={[0.08, h * 0.5, d]} />{m}</mesh>)}
        </group>
      );
    case "chair":
      return (
        <group>
          <mesh position={[0, h * 0.45, 0]}><boxGeometry args={[w, 0.07, d]} />{m}</mesh>
          <mesh position={[0, h * 0.75, -d / 2]}><boxGeometry args={[w, h * 0.55, 0.06]} />{m}</mesh>
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => <mesh key={`${x}${z}`} position={[(x * w) / 2.4, h * 0.22, (z * d) / 2.4]}><boxGeometry args={[0.05, h * 0.45, 0.05]} />{m}</mesh>)}
        </group>
      );
    case "plant":
      return (
        <group>
          <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.2, 0.16, 0.4, 16]} />{m}</mesh>
          <mesh position={[0, 0.7, 0]}><icosahedronGeometry args={[0.38, 0]} />{m}</mesh>
        </group>
      );
    case "bin":
      return <mesh position={[0, h / 2, 0]}><cylinderGeometry args={[w / 2, w / 2.3, h, 20]} />{m}</mesh>;
    case "bicycle":
      return (
        <group>
          {[-0.55, 0.55].map((x) => <mesh key={x} position={[x, 0.32, 0]}><torusGeometry args={[0.3, 0.035, 8, 28]} />{m}</mesh>)}
          <mesh position={[0, 0.55, 0]} rotation={[0, 0, 0.2]}><boxGeometry args={[1.0, 0.05, 0.05]} />{m}</mesh>
          <mesh position={[0.3, 0.75, 0]}><boxGeometry args={[0.05, 0.45, 0.05]} />{m}</mesh>
          <mesh position={[0.1, 1.15, 0]}><capsuleGeometry args={[0.16, 0.4, 4, 10]} />{m}</mesh>
        </group>
      );
    case "car":
      return (
        <group>
          <RoundedBox args={[w, h * 0.5, d]} radius={0.12} position={[0, h * 0.4, 0]}>{m}</RoundedBox>
          <RoundedBox args={[w * 0.85, h * 0.4, d * 0.5]} radius={0.12} position={[0, h * 0.82, -0.1]}>{m}</RoundedBox>
          <mesh position={[0, h * 0.42, d / 2 + 0.01]}><planeGeometry args={[w * 0.8, 0.12]} /><meshBasicMaterial color="#fff6c0" /></mesh>
        </group>
      );
    default:
      return <mesh position={[0, h / 2, 0]}><boxGeometry args={o.size} />{m}</mesh>;
  }
};

// Expanding ripple: an unseen thing you might walk into
const Ripple = ({ color, offset }: { color: string; offset: number }) => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!ref.current) return;
    const t = (s.clock.elapsedTime * 0.6 + offset) % 1;
    ref.current.scale.setScalar(0.4 + t * 1.8);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <ringGeometry args={[0.5, 0.56, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} />
    </mesh>
  );
};

const ObstacleNode = ({ o, aware, index }: { o: Obstacle; aware: boolean; index: number }) => {
  const ref = useRef<THREE.Group>(null);
  const box = useMemo(() => new THREE.BoxGeometry(o.size[0] + 0.25, o.size[1] + 0.25, o.size[2] + 0.25), [o.size]);
  useFrame((s) => {
    if (!ref.current || !o.moving) return;
    const v = Math.sin(s.clock.elapsedTime * o.moving.speed + index) * o.moving.range;
    if (o.moving.axis === "x") ref.current.position.x = o.position[0] + v * 0.5 - 1;
    else ref.current.position.z = o.position[2] + v;
  });
  return (
    <group ref={ref} position={o.position} rotation={[0, o.id === "bench" ? 0.25 : o.id === "chair" ? -0.6 : 0, 0]}>
      <Shape o={o} aware={aware} />
      {!aware && <Ripple color={colors.amber} offset={index * 0.17} />}
      {aware && (
        <>
          <lineSegments position={[0, o.size[1] / 2 + 0.05, 0]}>
            <edgesGeometry args={[box]} />
            <lineBasicMaterial color={riskColor[o.risk]} />
          </lineSegments>
          <mesh position={[0, o.size[1] / 2 + 0.05, 0]} geometry={box}>
            <meshBasicMaterial color={riskColor[o.risk]} transparent opacity={0.06} depthWrite={false} />
          </mesh>
          <Html position={[0, o.size[1] + 0.45, 0]} center distanceFactor={9}>
            <div className="obstacleTag" style={{ "--oc": o.color, "--rc": riskColor[o.risk] } as CSSProperties}>
              <b>{o.label}</b>
              <span>{o.note}</span>
            </div>
          </Html>
        </>
      )}
    </group>
  );
};

// Walker seen from behind, with an awareness cone when OBSERV-E is active
const Walker = ({ aware }: { aware: boolean }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (ref.current) ref.current.position.y = Math.abs(Math.sin(s.clock.elapsedTime * 3)) * 0.04;
  });
  return (
    <group ref={ref} position={[0, 0, 5.4]} scale={0.8}>
      <mesh position={[0, 0.85, 0]}><capsuleGeometry args={[0.24, 0.9, 6, 16]} /><meshStandardMaterial color="#e9edf7" roughness={0.6} /></mesh>
      <mesh position={[0, 1.68, 0]}><sphereGeometry args={[0.2, 24, 24]} /><meshStandardMaterial color="#e9edf7" /></mesh>
      {aware && (
        <mesh position={[0, 0.03, -5.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[6.5, 48, Math.PI / 2 - 0.42, 0.84]} />
          <meshBasicMaterial color={colors.cyan} transparent opacity={0.09} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
};

const Street = ({ aware, children }: { aware: boolean; children: ReactNode }) => {
  const lines = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!lines.current) return;
    lines.current.position.z = (lines.current.position.z + dt * 0.9) % 2;
  });
  return (
    <group>
      <fog attach="fog" args={["#05061a", aware ? 9 : 4, aware ? 24 : 13]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -6]}>
        <planeGeometry args={[30, 40]} />
        <meshStandardMaterial color="#0a0c24" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -6]}>
        <planeGeometry args={[4.2, 40]} />
        <meshStandardMaterial color={aware ? "#16183d" : "#0e1028"} roughness={0.8} />
      </mesh>
      <group ref={lines}>
        {Array.from({ length: 20 }, (_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 4 - i * 2]}>
            <planeGeometry args={[4.2, 0.03]} />
            <meshBasicMaterial color={aware ? colors.violet : "#2a2d52"} transparent opacity={0.5} />
          </mesh>
        ))}
      </group>
      {[-2.1, 2.1].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.012, -6]}>
          <planeGeometry args={[0.05, 40]} />
          <meshBasicMaterial color={aware ? colors.cyan : "#2a2d52"} />
        </mesh>
      ))}
      {/* Road lane beside the path */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5.6, 0.006, -6]}>
        <planeGeometry args={[3.4, 40]} />
        <meshStandardMaterial color="#090a1c" />
      </mesh>
      {children}
    </group>
  );
};

export const Problem = () => {
  const [aware, setAware] = useState(false);
  const { reducedMotion } = useMotion();
  return (
    <div className="slide problem">
      <div className="problemCopy">
        <Kicker act="I" color={colors.amber}>The human problem</Kicker>
        <h2 className="title" style={{ fontSize: 58 }}>
          A walk is a stream of decisions about <span className="grad" style={{ "--g1": colors.amber, "--g2": colors.magenta, "--g3": colors.violet } as CSSProperties}>things you may never see.</span>
        </h2>
        <p className="lede" style={{ fontSize: 25 }}>
          A bench, a cone, a bike rolling in from the side. Each one is easy to handle if you know it's there, and a hazard if you don't.
        </p>
        <div className="statCard glass">
          <span className="statFigure grad">2.2 billion</span>
          <span className="statText">
            people worldwide live with a near or distance vision impairment. For older adults it adds difficulty walking and a higher risk of falls.
            <span className="faint statSource">World Health Organization, Blindness and vision impairment fact sheet</span>
          </span>
        </div>
        <div className="controlBar" style={{ marginTop: 30 }}>
          <button className={`chip amber ${aware ? "" : "on"}`} onClick={() => setAware(false)}>
            <EyeOff size={18} /> Without awareness
          </button>
          <button className={`chip ${aware ? "on" : ""}`} onClick={() => setAware(true)}>
            <Eye size={18} /> With OBSERV-E's view
          </button>
        </div>
        <div className="classChips">
          {obstacles.map((o) => (
            <span key={o.id} className="classChip" style={{ "--oc": o.color } as CSSProperties}>
              <i /> {o.label}
            </span>
          ))}
        </div>
      </div>
      <Aperture style={{ left: 820, top: 96, width: 990, height: 840 }} provenance="illustrative" glow={aware ? colors.cyan : colors.amber}>
        <StageCanvas camera={{ position: [0, 3.6, 9.4], fov: 46 }} frameloop={reducedMotion ? "demand" : "always"}>
          <ambientLight intensity={aware ? 0.7 : 0.25} />
          <directionalLight position={[3, 6, 4]} intensity={aware ? 1.6 : 0.4} />
          <pointLight position={[0, 3, -2]} intensity={aware ? 25 : 4} color={colors.violet} />
          <Street aware={aware}>
            {obstacles.map((o, i) => <ObstacleNode key={o.id} o={o} aware={aware} index={i} />)}
            <Walker aware={aware} />
          </Street>
        </StageCanvas>
        <div className="awareBanner" data-aware={aware}>
          {aware ? "7 objects classified · 3 high risk · 2 in the walking path" : "Hazards you can't see are just ripples"}
        </div>
      </Aperture>
    </div>
  );
};
