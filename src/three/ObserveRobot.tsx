// Procedural OBSERV-E, styled after the prototype photo. Conceptual, not CAD.
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { colors } from "../theme";

export type RobotPart = "camera" | "turret" | "compute" | "base" | "face" | null;

interface RobotProps {
  yawRef?: MutableRefObject<number>;
  pitchRef?: MutableRefObject<number>;
  autoScan?: boolean;
  xray?: boolean;
  highlight?: RobotPart;
  showBeam?: boolean;
  beamColor?: string;
  wheelSpeed?: number;
}

// Physical shell material, or a glassy x-ray variant
const useShell = (color: string, xray: boolean, emphasis: boolean) =>
  useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: xray ? 0.15 : 0.42,
        metalness: 0.05,
        clearcoat: 0.6,
        clearcoatRoughness: 0.3,
        transparent: xray,
        opacity: xray ? 0.22 : 1,
        emissive: new THREE.Color(emphasis ? color : "#000000"),
        emissiveIntensity: emphasis ? 0.55 : 0,
        depthWrite: !xray,
      }),
    [color, xray, emphasis],
  );

// Mecanum wheel: hub plus angled rollers
const MecanumWheel = ({ position, side, spin }: { position: [number, number, number]; side: 1 | -1; spin: MutableRefObject<number> }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.x = spin.current;
  });
  const rollers = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2);
  return (
    <group position={position}>
      <group ref={ref}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.26, 24]} />
          <meshStandardMaterial color="#8e96a3" metalness={0.8} roughness={0.3} />
        </mesh>
        {rollers.map((a) => (
          <mesh key={a} position={[0, Math.sin(a) * 0.29, Math.cos(a) * 0.29]} rotation={[a, side * 0.78, 0]}>
            <capsuleGeometry args={[0.055, 0.16, 4, 10]} />
            <meshStandardMaterial color="#1b1d22" roughness={0.75} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

// Triangle eye on the face panel
const Eye = ({ x, glow }: { x: number; glow: string }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.15, -0.11);
    s.lineTo(0.15, -0.11);
    s.lineTo(0, 0.15);
    s.closePath();
    return s;
  }, []);
  return (
    <mesh position={[x, 0.98, 0.84]}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color="#fff5e6" emissive={glow} emissiveIntensity={0.9} />
    </mesh>
  );
};

// Bundled wire from the camera down into the chassis
const Wire = ({ points, color }: { points: [number, number, number][]; color: string }) => {
  const geometry = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 40, 0.012, 6), [points]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  );
};

export const ObserveRobot = ({ yawRef, pitchRef, autoScan = false, xray = false, highlight = null, showBeam = true, beamColor = colors.cyan, wheelSpeed = 0 }: RobotProps) => {
  const pan = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const spin = useRef(0);
  const shell = useShell(colors.shell, xray, highlight === "face");
  const bin = useShell("#b3262e", xray, highlight === "base");
  const turretMat = useShell(colors.shell, xray, highlight === "turret");
  const bracketMat = useShell(colors.shell, xray, highlight === "camera");

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    spin.current += wheelSpeed * dt;
    const yaw = yawRef ? yawRef.current : autoScan ? Math.sin(t * 0.45) * 0.9 : 0;
    const pitch = pitchRef ? pitchRef.current : autoScan ? Math.sin(t * 0.7) * 0.08 - 0.05 : -0.05;
    if (pan.current) pan.current.rotation.y = yaw;
    if (tilt.current) tilt.current.rotation.x = pitch;
    if (beam.current) (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.1 + Math.sin(t * 2.4) * 0.03;
  });

  return (
    <group>
      {/* Wheels */}
      <MecanumWheel position={[-1.02, 0.31, 0.55]} side={1} spin={spin} />
      <MecanumWheel position={[1.02, 0.31, 0.55]} side={-1} spin={spin} />
      <MecanumWheel position={[-1.02, 0.31, -0.55]} side={-1} spin={spin} />
      <MecanumWheel position={[1.02, 0.31, -0.55]} side={1} spin={spin} />

      {/* Red lower bin and aluminium frame */}
      <RoundedBox args={[1.4, 0.52, 1.1]} radius={0.06} position={[0, 0.38, 0.05]} material={bin} />
      {[-0.68, 0.68].map((z) => (
        <mesh key={z} position={[0, 0.7, z]}>
          <boxGeometry args={[2.05, 0.09, 0.09]} />
          <meshStandardMaterial color="#c7ccd4" metalness={0.85} roughness={0.25} transparent={xray} opacity={xray ? 0.35 : 1} />
        </mesh>
      ))}
      <RoundedBox args={[1.85, 0.07, 1.45]} radius={0.03} position={[0, 0.66, 0]} material={shell} />

      {/* Compute and electronics on the deck */}
      <group position={[0.45, 0.78, -0.35]}>
        <RoundedBox args={[0.55, 0.18, 0.45]} radius={0.04}>
          <meshStandardMaterial color="#20232b" metalness={0.6} roughness={0.35} emissive={highlight === "compute" ? colors.indigo : "#000"} emissiveIntensity={highlight === "compute" ? 0.8 : 0} />
        </RoundedBox>
        <mesh position={[0, 0.1, 0.18]}>
          <boxGeometry args={[0.3, 0.012, 0.03]} />
          <meshBasicMaterial color={colors.indigo} />
        </mesh>
      </group>
      <mesh position={[-0.55, 0.74, -0.3]}>
        <boxGeometry args={[0.36, 0.03, 0.26]} />
        <meshStandardMaterial color="#1f6b3c" emissive="#0d3" emissiveIntensity={highlight === "compute" ? 0.4 : 0.05} />
      </mesh>
      <mesh position={[-0.75, 0.86, 0.1]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.12, 0.05, 0.06]} />
        <meshStandardMaterial color="#e7c72b" />
      </mesh>

      {/* Face: two angled panels, triangle eyes and a smile */}
      <group>
        <RoundedBox args={[0.98, 0.9, 0.06]} radius={0.12} position={[-0.5, 0.86, 0.8]} rotation={[0, 0.08, 0]} material={shell} />
        <RoundedBox args={[0.98, 0.9, 0.06]} radius={0.12} position={[0.5, 0.86, 0.8]} rotation={[0, -0.08, 0]} material={shell} />
        {!xray && (
          <>
            <Eye x={-0.5} glow={highlight === "face" ? colors.cyan : "#ffb15a"} />
            <Eye x={0.5} glow={highlight === "face" ? colors.cyan : "#ffb15a"} />
            <mesh position={[0, 0.66, 0.845]} rotation={[0, 0, Math.PI + 0.35]}>
              <torusGeometry args={[0.2, 0.022, 8, 32, Math.PI - 0.7]} />
              <meshStandardMaterial color="#6a3a0c" />
            </mesh>
          </>
        )}
      </group>

      {/* Turret housing the continuous-yaw slip ring */}
      <group position={[0, 0.7, -0.1]}>
        <mesh position={[0, 0.17, 0]} material={turretMat}>
          <cylinderGeometry args={[0.46, 0.48, 0.32, 48]} />
        </mesh>
        <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.465, 0.012, 8, 64]} />
          <meshStandardMaterial color="#5b3a12" />
        </mesh>
        {highlight === "turret" && (
          <mesh position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.34, 24]} />
            <meshStandardMaterial color={colors.amber} emissive={colors.amber} emissiveIntensity={1.2} />
          </mesh>
        )}

        {/* Pan stage */}
        <group ref={pan} position={[0, 0.34, 0]}>
          <mesh position={[0, 0.02, 0]} material={bracketMat}>
            <cylinderGeometry args={[0.36, 0.36, 0.05, 40]} />
          </mesh>
          {/* Upright bracket arms */}
          <RoundedBox args={[0.1, 0.52, 0.3]} radius={0.03} position={[0.42, 0.26, 0]} material={bracketMat} />
          <RoundedBox args={[0.1, 0.36, 0.3]} radius={0.03} position={[-0.3, 0.2, 0]} material={bracketMat} />
          {/* Tilt servo */}
          <RoundedBox args={[0.18, 0.24, 0.28]} radius={0.02} position={[0.56, 0.4, 0]}>
            <meshStandardMaterial color="#3b3f47" metalness={0.5} roughness={0.4} />
          </RoundedBox>
          {/* Tilt stage with the external USB webcam */}
          <group ref={tilt} position={[0.05, 0.5, 0]}>
            <RoundedBox args={[0.62, 0.1, 0.32]} radius={0.03} position={[0, -0.04, 0]} material={bracketMat} />
            <RoundedBox args={[0.24, 0.16, 0.16]} radius={0.04} position={[0, 0.08, -0.02]}>
              <meshStandardMaterial color="#2a2d33" roughness={0.5} />
            </RoundedBox>
            <group position={[0, 0.25, 0.02]}>
              <RoundedBox args={[0.56, 0.18, 0.17]} radius={0.08}>
                <meshPhysicalMaterial color="#5a5f69" metalness={0.4} roughness={0.25} clearcoat={1} emissive={highlight === "camera" ? colors.cyan : "#000"} emissiveIntensity={highlight === "camera" ? 0.35 : 0} />
              </RoundedBox>
              <mesh position={[0.08, 0, 0.09]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.055, 0.055, 0.02, 32]} />
                <meshStandardMaterial color="#05070c" metalness={0.9} roughness={0.1} />
              </mesh>
              <mesh position={[0.08, 0, 0.1]}>
                <ringGeometry args={[0.045, 0.06, 32]} />
                <meshBasicMaterial color={beamColor} />
              </mesh>
              <mesh position={[-0.14, 0.02, 0.09]}>
                <circleGeometry args={[0.012, 12]} />
                <meshBasicMaterial color="#58ff9a" />
              </mesh>
              {/* Field-of-view beam */}
              {showBeam && (
                <mesh ref={beam} position={[0.08, 0, 1.8]} rotation={[-Math.PI / 2, 0, 0]}>
                  <coneGeometry args={[0.9, 3.4, 40, 1, true]} />
                  <meshBasicMaterial color={beamColor} transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
                </mesh>
              )}
            </group>
          </group>
        </group>
      </group>

      {/* Wiring */}
      {!xray && (
        <>
          <Wire color="#c4202a" points={[[0.3, 1.55, -0.1], [0.75, 1.5, 0.1], [0.95, 1.1, 0.2], [0.8, 0.8, 0.3]]} />
          <Wire color="#121212" points={[[0.2, 1.5, -0.12], [-0.5, 1.4, -0.2], [-0.8, 1.05, 0], [-0.6, 0.78, 0.2]]} />
          <Wire color="#c4202a" points={[[-0.2, 0.75, 0.6], [0.1, 0.95, 0.5], [0.4, 0.82, 0.45], [0.8, 0.76, 0.3]]} />
        </>
      )}
    </group>
  );
};
