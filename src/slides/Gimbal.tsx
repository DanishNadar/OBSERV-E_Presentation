import { useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Html } from "@react-three/drei";
import * as THREE from "three";
import { colors } from "../theme";
import { Aperture, Kicker, PlayControls, Slider } from "../components/ui";
import { setupCanvas, useMotion } from "../lib/hooks";
import { StageCanvas } from "../three/StageCanvas";
import { ObserveRobot } from "../three/ObserveRobot";

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const deg = (r: number) => (r * 180) / Math.PI;

interface Controls { walking: boolean; lead: boolean; slipRing: boolean; gain: number; running: boolean }
interface Readout { error: number; yaw: number; command: number; unwinding: boolean; turns: number }

const freshSim = () => ({ t: 0, targetAngle: 0.6, targetRadius: 3.2, yaw: 0, yawRate: 0, prevTarget: 0.6, history: [] as number[], unwinding: false, frames: 0 });

// Controller + scene objects that move each frame
const GimbalWorld = ({ controls, sim, dragging, onReadout, chart }: {
  controls: MutableRefObject<Controls>;
  sim: MutableRefObject<ReturnType<typeof freshSim>>;
  dragging: MutableRefObject<boolean>;
  onReadout: (r: Readout) => void;
  chart: MutableRefObject<HTMLCanvasElement | null>;
}) => {
  const yawRef = useRef(0);
  const target = useRef<THREE.Group>(null);
  const aim = useRef<THREE.Line>(null);
  const arc = useRef<THREE.Mesh>(null);
  const ghost = useRef<THREE.Mesh>(null);
  const aimLine = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color: colors.amber }));
  }, []);

  useFrame((_, rawDt) => {
    const c = controls.current;
    const w = sim.current;
    const dt = c.running ? Math.min(0.05, rawDt) : 0;
    if (dt > 0) {
      w.t += dt;
      if (c.walking && !dragging.current) w.targetAngle += dt * (0.55 + 0.35 * Math.sin(w.t * 0.4));
      const targetRate = wrap(w.targetAngle - w.prevTarget) / Math.max(dt, 0.001);
      w.prevTarget = w.targetAngle;
      const aimAngle = w.targetAngle + targetRate * (c.lead ? 0.12 : 0);
      let error: number;
      if (c.slipRing) {
        error = wrap(aimAngle - w.yaw);
        w.unwinding = false;
      } else {
        // Cable limit at ±170°: the shortest path may be forbidden
        const limit = (170 * Math.PI) / 180;
        let goal = w.yaw + wrap(aimAngle - w.yaw);
        if (goal > limit) goal -= 2 * Math.PI;
        if (goal < -limit) goal += 2 * Math.PI;
        error = goal - w.yaw;
        w.unwinding = Math.abs(error) > Math.PI * 0.9;
      }
      const maxRate = 4.5;
      const command = Math.max(-maxRate, Math.min(maxRate, c.gain * error));
      w.yawRate += (command - w.yawRate) * Math.min(1, dt * 14);
      w.yaw += w.yawRate * dt;
      if (c.slipRing) w.yaw = wrap(w.yaw);
      const trackErr = wrap(w.targetAngle - w.yaw);
      w.history.push(deg(trackErr));
      if (w.history.length > 300) w.history.shift();
      w.frames += 1;
      if (w.frames % 6 === 0) onReadout({ error: deg(trackErr), yaw: deg(w.yaw), command: deg(command), unwinding: w.unwinding, turns: w.yaw / (2 * Math.PI) });
    }
    yawRef.current = w.yaw;
    const tx = Math.sin(w.targetAngle) * w.targetRadius;
    const tz = Math.cos(w.targetAngle) * w.targetRadius;
    if (target.current) {
      target.current.position.set(tx, 0, tz);
      target.current.rotation.y = w.targetAngle + Math.PI / 2;
    }
    const pos = aimLine.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, 0, 1.95, -0.1);
    pos.setXYZ(1, tx, 1.1, tz);
    pos.needsUpdate = true;
    const err = wrap(w.targetAngle - w.yaw);
    if (arc.current) {
      arc.current.geometry.dispose();
      arc.current.geometry = new THREE.RingGeometry(1.55, 1.72, 48, 1, Math.PI / 2 - w.yaw - Math.max(0, err), Math.max(0.01, Math.abs(err)));
      (arc.current.material as THREE.MeshBasicMaterial).color.set(Math.abs(err) > 0.35 ? colors.red : colors.amber);
    }
    if (ghost.current) {
      // Where the predictor says the person will be in 0.4 s
      const ahead = w.targetAngle + (controls.current.walking ? 0.25 : 0);
      ghost.current.position.set(Math.sin(ahead) * w.targetRadius, 0.02, Math.cos(ahead) * w.targetRadius);
      ghost.current.visible = controls.current.lead;
    }
    const cv = chart.current;
    if (cv) {
      const ctx = setupCanvas(cv, 560, 150);
      ctx.clearRect(0, 0, 560, 150);
      ctx.strokeStyle = "rgba(190,205,255,.18)";
      ctx.beginPath();
      ctx.moveTo(0, 75);
      ctx.lineTo(560, 75);
      ctx.stroke();
      ctx.save();
      ctx.strokeStyle = colors.red;
      ctx.shadowColor = colors.red;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      w.history.forEach((e, i) => {
        const x = (i / 300) * 560;
        const y = 75 - Math.max(-70, Math.min(70, e * 1.2));
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "rgba(190,205,255,.6)";
      ctx.font = '13px "JetBrains Mono"';
      ctx.fillText("+60°", 4, 16);
      ctx.fillText("−60°", 4, 144);
    }
  });

  const setTarget = (e: ThreeEvent<PointerEvent>) => {
    const w = sim.current;
    w.targetAngle = Math.atan2(e.point.x, e.point.z);
    w.targetRadius = Math.max(1.9, Math.min(4.4, Math.hypot(e.point.x, e.point.z)));
  };

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerDown={(e) => { dragging.current = true; (e.target as Element)?.setPointerCapture?.(e.pointerId); setTarget(e); }} onPointerMove={(e) => dragging.current && setTarget(e)} onPointerUp={() => { dragging.current = false; }}>
        <circleGeometry args={[5, 96]} />
        <meshStandardMaterial color="#0b0d26" transparent opacity={0.85} />
      </mesh>
      {[1.5, 2.5, 3.5, 4.5].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
          <ringGeometry args={[r - 0.008, r + 0.008, 128]} />
          <meshBasicMaterial color={colors.violet} transparent opacity={0.25} />
        </mesh>
      ))}
      <ObserveRobot yawRef={yawRef} beamColor={colors.amber} />
      <primitive object={aimLine} ref={aim} />
      <mesh ref={arc} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.55, 1.72, 48]} />
        <meshBasicMaterial color={colors.amber} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ghost} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.4, 40]} />
        <meshBasicMaterial color={colors.amber} transparent opacity={0.6} />
      </mesh>
      <group ref={target}>
        <mesh position={[0, 0.75, 0]}><capsuleGeometry args={[0.22, 0.85, 6, 16]} /><meshStandardMaterial color="#eef3fa" emissive={colors.green} emissiveIntensity={0.15} /></mesh>
        <mesh position={[0, 1.5, 0]}><sphereGeometry args={[0.19, 20, 20]} /><meshStandardMaterial color="#eef3fa" /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}><ringGeometry args={[0.38, 0.46, 40]} /><meshBasicMaterial color={colors.green} side={THREE.DoubleSide} /></mesh>
        <Html position={[0, 2, 0]} center><div className="hotLabel" style={{ ["--hc" as string]: colors.green }}>drag me</div></Html>
      </group>
      <ContactShadows opacity={0.5} scale={10} blur={2} far={3} />
    </>
  );
};

export const Gimbal = () => {
  const { reducedMotion } = useMotion();
  const [walking, setWalking] = useState(true);
  const [lead, setLead] = useState(true);
  const [slipRing, setSlipRing] = useState(true);
  const [gain, setGain] = useState(6);
  const [running, setRunning] = useState(!reducedMotion);
  const [readout, setReadout] = useState<Readout>({ error: 0, yaw: 0, command: 0, unwinding: false, turns: 0 });
  const controls = useRef<Controls>({ walking, lead, slipRing, gain, running });
  controls.current = { walking, lead, slipRing, gain, running };
  const sim = useRef(freshSim());
  const dragging = useRef(false);
  const chart = useRef<HTMLCanvasElement | null>(null);

  return (
    <div className="slide gimbal">
      <Aperture style={{ left: 112, top: 96, width: 1060, height: 800 }} provenance="schematic" provenanceText="3D concept of the pan stage" glow={readout.unwinding ? colors.red : colors.amber}>
        <StageCanvas camera={{ position: [5.2, 4.6, 6.2], fov: 40 }} style={{ cursor: "crosshair" }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[4, 9, 5]} intensity={2} />
          <pointLight position={[-4, 3, -3]} intensity={30} color={colors.violet} />
          <group position={[0, -0.9, 0]}>
            <GimbalWorld controls={controls} sim={sim} dragging={dragging} onReadout={setReadout} chart={chart} />
          </group>
        </StageCanvas>
        {readout.unwinding && <div className="unwindBanner">Cable limit reached, unwinding the long way</div>}
      </Aperture>
      <div className="gimbalSide">
        <Kicker act="IV" color={colors.amber}>Experience C</Kicker>
        <h2 className="title" style={{ fontSize: 54 }}>How does the <span className="grad" style={{ ["--g1" as string]: colors.amber, ["--g2" as string]: colors.orange }}>camera respond?</span></h2>
        <p className="body" style={{ fontSize: 20 }}>
          Vision reports how far the person is from frame centre. The controller turns that error into a rotation command, and the predictor adds a little lead so the camera doesn't trail behind.
        </p>
        <div className="gimbalReadout mono">
          <div className="glass"><span>tracking error</span><b className={Math.abs(readout.error) > 20 ? "c-red" : "c-green"}>{readout.error.toFixed(1)}°</b></div>
          <div className="glass"><span>yaw</span><b>{readout.yaw.toFixed(0)}°</b></div>
          <div className="glass"><span>rate command</span><b className="c-amber">{readout.command.toFixed(0)}°/s</b></div>
        </div>
        <canvas ref={chart} style={{ width: 560, height: 150 }} aria-label="Tracking error over time" />
        <Slider label="Controller gain" value={gain} min={1} max={14} step={0.5} onChange={setGain} format={(v) => `Kp ${v}`} accent={colors.amber} />
        <div className="controlBar" style={{ marginTop: 14 }}>
          <button className={`chip ${walking ? "on" : ""}`} onClick={() => setWalking((v) => !v)} aria-pressed={walking}>Person walks</button>
          <button className={`chip amber ${lead ? "on" : ""}`} onClick={() => setLead((v) => !v)} aria-pressed={lead}>Predictive lead</button>
          <button className={`chip green ${slipRing ? "on" : ""}`} onClick={() => setSlipRing((v) => !v)} aria-pressed={slipRing}>Slip ring</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <PlayControls running={running} onToggle={() => setRunning((v) => !v)} onReset={() => { sim.current = freshSim(); }} />
        </div>
        <p className="callout" style={{ marginTop: 16, fontSize: 16 }}>
          The slip ring passes power and signal through the rotating joint, so the camera can keep turning in one direction without winding up its cable. Without it, the stage must unwind the long way at its cable limit.
        </p>
      </div>
    </div>
  );
};
