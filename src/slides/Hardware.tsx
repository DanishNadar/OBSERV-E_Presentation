import { Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import { useFrame } from "@react-three/fiber";
import { Center, ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { colors } from "../theme";
import { Aperture, Kicker, Tilt } from "../components/ui";
import { useMotion } from "../lib/hooks";
import { StageCanvas } from "../three/StageCanvas";

const parts = [
  { file: "IMU_Servo_Coupling.stl", name: "IMU–servo coupling", size: "53 × 27 × 9 mm", color: colors.cyan, note: "Connects the servo output to the IMU and camera stage." },
  { file: "servo_arm.stl", name: "Servo arm", size: "127 × 54 × 71 mm", color: colors.amber, note: "Printed arm driven by the GoBilda servo." },
  { file: "IMU_Phone_Mount.stl", name: "Camera + IMU mount", size: "60 × 110 × 29 mm", color: colors.violet, note: "First-generation sensor mount: the IMU shares one rigid body with the camera, so it measures exactly how the camera moves. Being adapted to the external camera." },
  { file: "Phone_Mount_Slider.stl", name: "Mount slider", size: "60 × 33 × 29 mm", color: colors.magenta, note: "Adjustable clamp from the first-generation mount." },
  { file: "Phone_Mount_Nut.stl", name: "Mount nut", size: "19.5 × 19.5 × 10 mm", color: colors.orange, note: "Locks the slider position." },
  { file: "IMU_Ground_Plate.stl", name: "IMU ground plate", size: "60 × 30 × 8.5 mm", color: colors.green, note: "Mounting plate for the BNO085 breakout." },
  { file: "support_suspension_arm.stl", name: "Support suspension arm", size: "33 × 62.5 × 15 mm", color: colors.sky, note: "Structural support for the assembly." },
];

const loader = new STLLoader();
const cache = new Map<string, THREE.BufferGeometry>();

// Parts are stored as base64 STL inside JSON
const loadPart = async (file: string) => {
  if (cache.has(file)) return cache.get(file)!;
  const res = await fetch(`./models/${file}.json`);
  if (!res.ok) throw new Error(String(res.status));
  const json = (await res.json()) as { data: string };
  const bytes = Uint8Array.from(atob(json.data), (ch) => ch.charCodeAt(0));
  const geometry = loader.parse(bytes.buffer);
  geometry.computeBoundingBox();
  geometry.center();
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  const size = new THREE.Vector3();
  geometry.computeBoundingBox();
  geometry.boundingBox!.getSize(size);
  const s = 2.6 / Math.max(size.x, size.y, size.z);
  geometry.scale(s, s, s);
  cache.set(file, geometry);
  return geometry;
};

const Part = ({ geometry, color, spin }: { geometry: THREE.BufferGeometry; color: string; spin: boolean }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current && spin) ref.current.rotation.y += dt * 0.35;
  });
  return (
    <group ref={ref}>
      <Center>
        <mesh geometry={geometry}>
          <meshPhysicalMaterial color={color} roughness={0.3} metalness={0.1} clearcoat={1} transparent opacity={0.78} emissive={color} emissiveIntensity={0.12} />
        </mesh>
        <lineSegments>
          <edgesGeometry args={[geometry, 28]} />
          <lineBasicMaterial color={color} transparent opacity={0.9} />
        </lineSegments>
      </Center>
    </group>
  );
};

export const Hardware = () => {
  const [index, setIndex] = useState(0);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { reducedMotion } = useMotion();
  const part = parts[index];

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadPart(part.file)
      .then((g) => !cancelled && setGeometry(g))
      .catch(() => !cancelled && setError("Could not load this part file."));
    return () => {
      cancelled = true;
    };
  }, [part.file]);

  return (
    <div className="slide hardware">
      <div className="hwCopy">
        <Kicker act="IV" color={colors.violet}>The gimbal hardware</Kicker>
        <h2 className="title" style={{ fontSize: 54 }}>
          A camera, a servo and an IMU on <span className="grad">one printed stage.</span>
        </h2>
        <div className="partList" role="listbox" aria-label="Printed parts">
          {parts.map((p, i) => (
            <Tilt key={p.file} className={`partButton ${i === index ? "on" : ""}`} style={{ "--pc": p.color } as CSSProperties} onClick={() => setIndex(i)} role="option" tabIndex={0} max={8}>
              <i className="partSwatch" />
              <span>{p.name}</span>
              <span className="mono faint">{p.size}</span>
            </Tilt>
          ))}
        </div>
      </div>
      <Aperture style={{ left: 760, top: 96, width: 1050, height: 640 }} provenance="real" provenanceText={`Real CAD: ${part.file}`} glow={part.color}>
        <StageCanvas camera={{ position: [3.2, 2.4, 4.2], fov: 32 }} frameloop={reducedMotion ? "demand" : "always"}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 6, 4]} intensity={2.4} />
          <pointLight position={[-4, 1, -3]} intensity={30} color={part.color} />
          <Suspense fallback={null}>{geometry && <Part geometry={geometry} color={part.color} spin={!reducedMotion} />}</Suspense>
          <ContactShadows position={[0, -1.4, 0]} opacity={0.5} scale={6} blur={2.5} far={3} />
          <OrbitControls enableZoom={false} enablePan={false} />
        </StageCanvas>
        {error && <p className="loadError">{error}</p>}
        <p className="partNote">{part.note} Drag to rotate.</p>
      </Aperture>
      <div className="hwFacts">
        <div className="glass" style={{ "--fc": colors.green } as CSSProperties}>
          <h4 className="c-green">BNO085 IMU</h4>
          <p>Gyro-integrated rotation vector every 1000 µs: a quaternion plus angular velocity, read over UART with the SH-2 library on an STM32WB55 and streamed over USB.</p>
        </div>
        <div className="glass" style={{ "--fc": colors.cyan } as CSSProperties}>
          <h4 className="c-cyan">GoBilda servo</h4>
          <p>PWM pulse of 1.5 ms ± 0.6 ms from an STM32F401 timer. A test rig in <span className="mono">servo_classification</span> steps it in 0.05 ms increments and reads back supply voltage.</p>
        </div>
        <div className="glass" style={{ "--fc": colors.amber } as CSSProperties}>
          <h4 className="c-amber">Status</h4>
          <p>The vision side publishes gimbal targets and the IMU firmware streams telemetry. Joining them into one closed loop is the next build step.</p>
        </div>
      </div>
    </div>
  );
};
