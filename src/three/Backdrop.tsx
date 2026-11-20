// Deck-wide ambient scene: glass shapes, particles and a neon floor grid tinted per act
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

const Particles = ({ color, count = 1400 }: { color: string; count?: number }) => {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 60;
      p[i * 3 + 1] = (Math.random() - 0.5) * 34;
      p[i * 3 + 2] = -Math.random() * 40;
    }
    return p;
  }, [count]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.012;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.06} transparent opacity={0.7} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

// Translucent glass solid with a glowing wire shell
const GlassShape = ({ geometry, color, position, scale = 1 }: { geometry: THREE.BufferGeometry; color: string; position: [number, number, number]; scale?: number }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.x += dt * 0.08;
    ref.current.rotation.y += dt * 0.12;
  });
  return (
    <Float speed={1.2} rotationIntensity={0.4} floatIntensity={1.4}>
      <group ref={ref} position={position} scale={scale}>
        <mesh geometry={geometry}>
          <meshPhysicalMaterial color={color} transparent opacity={0.1} roughness={0.08} metalness={0.1} clearcoat={1} iridescence={1} iridescenceIOR={1.4} emissive={color} emissiveIntensity={0.12} depthWrite={false} />
        </mesh>
        <lineSegments>
          <edgesGeometry args={[geometry, 20]} />
          <lineBasicMaterial color={color} transparent opacity={0.3} />
        </lineSegments>
      </group>
    </Float>
  );
};

// Pointer parallax for depth
const Rig = () => {
  useFrame((state) => {
    const { camera, pointer } = state;
    camera.position.x += (pointer.x * 1.4 - camera.position.x) * 0.03;
    camera.position.y += (pointer.y * 0.8 + 0.6 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, -8);
  });
  return null;
};

const Scene = ({ accent, secondary }: { accent: string; secondary: string }) => {
  const shapes = useMemo(
    () => ({
      ico: new THREE.IcosahedronGeometry(1.4, 0),
      torus: new THREE.TorusGeometry(1.2, 0.36, 18, 48),
      octa: new THREE.OctahedronGeometry(1.1, 0),
      knot: new THREE.TorusKnotGeometry(0.9, 0.26, 90, 12),
      dodeca: new THREE.DodecahedronGeometry(0.9, 0),
    }),
    [],
  );
  return (
    <>
      <fog attach="fog" args={["#04050d", 12, 46]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[-10, 6, 4]} intensity={80} color={accent} />
      <pointLight position={[12, -4, 2]} intensity={60} color={secondary} />
      <Particles color={accent} />
      <GlassShape geometry={shapes.ico} color={accent} position={[-24, 11, -30]} scale={1.6} />
      <GlassShape geometry={shapes.torus} color={secondary} position={[25, -10, -30]} scale={1.8} />
      <GlassShape geometry={shapes.octa} color="#b27bff" position={[22, 12, -34]} scale={1.3} />
      <GlassShape geometry={shapes.knot} color={accent} position={[-26, -11, -34]} scale={1.5} />
      <GlassShape geometry={shapes.dodeca} color="#ff5fd2" position={[4, 15, -40]} scale={1.4} />
      <Rig />
    </>
  );
};

export const Backdrop = ({ accent, secondary, paused }: { accent: string; secondary: string; paused: boolean }) => (
  <div className="backdrop" aria-hidden="true">
    <Canvas dpr={1} frameloop={paused ? "demand" : "always"} camera={{ position: [0, 0.6, 10], fov: 55 }} gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}>
      <Scene accent={accent} secondary={secondary} />
    </Canvas>
  </div>
);
