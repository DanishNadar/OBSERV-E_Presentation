import { useRef, useState, type PointerEvent } from "react";
import { motion } from "framer-motion";
import { colors } from "../theme";
import { Aperture, Kicker } from "../components/ui";
import { useMotion } from "../lib/hooks";
import { hex, sabertoothPacket } from "../lib/sabertooth";

const wheels: [number, number, number][] = [[28, 78, 0], [242, 78, 1], [28, 250, 2], [242, 250, 3]];

export const Base = () => {
  const [stick, setStick] = useState({ x: 0, y: 0.5 });
  const pad = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const { reducedMotion } = useMotion();
  // Illustrative tank mixing into four signed speeds
  const left = Math.max(-1, Math.min(1, stick.y + stick.x));
  const right = Math.max(-1, Math.min(1, stick.y - stick.x));
  const speeds = [left, right, left, right].map((v) => Math.round(v * 127));
  const packets = speeds.map((v, i) => sabertoothPacket(i, v));

  const move = (e: PointerEvent) => {
    const r = pad.current!.getBoundingClientRect();
    let x = ((e.clientX - r.left) / r.width) * 2 - 1;
    let y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    setStick({ x, y });
  };

  return (
    <div className="slide base">
      <div className="baseCopy">
        <Kicker act="VI" color={colors.green}>The mobile base</Kicker>
        <h2 className="title" style={{ fontSize: 56 }}>Four bytes per motor, <span className="grad" style={{ ["--g1" as string]: colors.green, ["--g2" as string]: colors.cyan }}>from a Bluetooth write to the wheels.</span></h2>
        <p className="body">
          An STM32WB55 advertises as <span className="mono c-cyan">OBSV</span> with four writable characteristics, one signed byte each. A scheduler task turns every new value into a Sabertooth packetized-serial command.
        </p>
        <div className="packetFormula mono glass">
          <div><span className="c-cyan">command</span> = motorSelect (0 or 4) + direction (0 fwd, 1 back)</div>
          <div><span className="c-amber">data</span> = |speed|, 0–127</div>
          <div><span className="c-green">checksum</span> = (address + command + data) &amp; 0x7F</div>
        </div>
        <p className="faint" style={{ fontSize: 16, maxWidth: "58ch" }}>
          The joystick mixing is illustrative; the firmware simply takes four speeds. Address 128 is the Sabertooth default for packetized serial.
        </p>
      </div>
      <div className="baseStage">
        <Aperture style={{ position: "relative", width: 420, height: 420 }} provenance="simulated" provenanceText="Drag to drive" glow={colors.cyan}>
          <svg ref={pad} viewBox="-1.2 -1.2 2.4 2.4" width="420" height="420" style={{ touchAction: "none", cursor: "grab" }}
            onPointerDown={(e) => { dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); move(e); }}
            onPointerMove={(e) => dragging.current && move(e)}
            onPointerUp={() => { dragging.current = false; setStick({ x: 0, y: 0 }); }}
            role="slider" aria-label="Drive joystick" aria-valuetext={`left ${speeds[0]}, right ${speeds[1]}`}>
            <defs>
              <radialGradient id="padGrad"><stop offset="0" stopColor="#1a1450" /><stop offset="1" stopColor="#070a20" /></radialGradient>
              <filter id="padGlow"><feGaussianBlur stdDeviation="0.03" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <circle r="1" fill="url(#padGrad)" stroke="rgba(63,224,255,.45)" strokeWidth="0.012" />
            {[0.33, 0.66].map((r) => <circle key={r} r={r} fill="none" stroke="rgba(178,123,255,.18)" strokeWidth="0.008" />)}
            <line x1="-1" y1="0" x2="1" y2="0" stroke="rgba(190,205,255,.12)" strokeWidth="0.008" />
            <line x1="0" y1="-1" x2="0" y2="1" stroke="rgba(190,205,255,.12)" strokeWidth="0.008" />
            <line x1="0" y1="0" x2={stick.x} y2={-stick.y} stroke={colors.cyan} strokeWidth="0.025" filter="url(#padGlow)" />
            <circle cx={stick.x} cy={-stick.y} r="0.17" fill={colors.cyan} filter="url(#padGlow)" />
            <circle cx={stick.x} cy={-stick.y} r="0.08" fill="#fff" />
          </svg>
        </Aperture>
        {/* Top view of the base, styled on the prototype */}
        <svg viewBox="0 0 300 360" width="300" height="360" className="robotTop" aria-label="Top view of the robot base">
          <defs>
            <linearGradient id="shellGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffb54a" /><stop offset="1" stopColor="#e3801f" /></linearGradient>
          </defs>
          <rect x="62" y="48" width="176" height="270" rx="26" fill="#b3262e" />
          <rect x="70" y="40" width="160" height="276" rx="22" fill="url(#shellGrad)" opacity=".95" />
          <circle cx="150" cy="190" r="46" fill="#f5a030" stroke="#5b3a12" strokeWidth="3" />
          <rect x="120" y="150" width="60" height="22" rx="8" fill="#5a5f69" />
          <path d="M104 62 l14 -20 l14 20 z M168 62 l14 -20 l14 20 z" fill="#fff5e6" opacity=".9" />
          {wheels.map(([x, y, i]) => {
            const v = speeds[i] / 127;
            return (
              <g key={i}>
                <rect x={x} y={y} width="30" height="64" rx="9" fill="#14161c" stroke={colors.green} strokeOpacity={0.35 + Math.abs(v) * 0.65} strokeWidth="2" />
                {[0, 1, 2, 3, 4].map((k) => <line key={k} x1={x + 4} y1={y + 8 + k * 12} x2={x + 26} y2={y + 2 + k * 12 + (i % 3 === 0 ? 10 : -4)} stroke="#3a3e47" strokeWidth="3" />)}
                {!reducedMotion && Math.abs(v) > 0.05 && (
                  <motion.rect x={x + 4} width="22" height="6" rx="2" fill={v > 0 ? colors.green : colors.amber} style={{ filter: `drop-shadow(0 0 4px ${v > 0 ? colors.green : colors.amber})` }} animate={{ y: v > 0 ? [y + 54, y + 4] : [y + 4, y + 54] }} transition={{ duration: Math.max(0.15, 1.1 - Math.abs(v)), repeat: Infinity, ease: "linear" }} />
                )}
                <text x={x + 15} y={y + 84} textAnchor="middle" fontSize="15" fill="#9aa8c2" fontFamily="JetBrains Mono">P{i + 1}</text>
              </g>
            );
          })}
          <polygon points="150,18 140,34 160,34" fill={colors.cyan} />
        </svg>
        <div className="packetTable">
          {packets.map((p, i) => (
            <div key={i} className="packetRow glass">
              <span className="mono faint">P{i + 1} write</span>
              <span className="mono packetInput" style={{ color: speeds[i] >= 0 ? colors.green : colors.amber }}>{speeds[i] > 0 ? "+" : ""}{speeds[i]}</span>
              <span className="packetBytes mono">
                <b style={{ color: "#9aa8c2" }}>{hex(p.address)}</b>
                <b className="c-cyan">{hex(p.command)}</b>
                <b className="c-amber">{hex(p.data)}</b>
                <b className="c-green">{hex(p.checksum)}</b>
              </span>
              <span className="faint packetMeaning">{p.command % 4 === 0 ? "forward" : "backward"}, motor {p.command >= 4 ? "B" : "A"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
