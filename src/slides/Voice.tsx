import { useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { Bluetooth, Radio, Usb } from "lucide-react";
import { colors } from "../theme";
import { Aperture, Kicker, Tilt } from "../components/ui";
import { useMotion } from "../lib/hooks";

const transports = [
  { id: "ble", name: "Bluetooth", icon: Bluetooth, color: colors.sky, path: "Robot serial → Arduino BLE bridge “OBSERVE-Robot” → Web Bluetooth notify", when: "Best when the browser exposes navigator.bluetooth." },
  { id: "usb", name: "USB serial", icon: Usb, color: colors.green, path: "Robot → Arduino over USB → Web Serial in desktop Chrome", when: "Fallback on desktop when Bluetooth is missing." },
  { id: "bridge", name: "Network bridge", icon: Radio, color: colors.amber, path: "Speech log or serial → POST /api/robot-message → Server-Sent Events → phone browser", when: "For phones and browsers without Bluetooth." },
];

export const Voice = () => {
  const [selected, setSelected] = useState("ble");
  const { reducedMotion } = useMotion();
  const t = transports.find((x) => x.id === selected)!;
  const chain = [
    { label: "Speech planner", color: colors.magenta },
    { label: t.name, color: t.color },
    { label: "Web app queue", color: colors.violet },
    { label: "ElevenLabs TTS", color: colors.indigo },
    { label: "Spoken aloud", color: colors.cyan },
  ];
  return (
    <div className="slide voice">
      <div className="voiceCopy">
        <Kicker act="V" color={colors.violet}>Voice companion</Kicker>
        <h2 className="title" style={{ fontSize: 58 }}>Every word OBSERV-E says is <span className="grad">shown before it's spoken.</span></h2>
        <p className="body">
          The companion web app receives speech lines from the robot, displays exactly what will be said, and streams audio from ElevenLabs. Urgent lines interrupt normal ones; stale lines are dropped.
        </p>
        <div className="transportCards">
          {transports.map((x) => {
            const Icon = x.icon;
            return (
              <Tilt key={x.id} className={`transportCard glass ${selected === x.id ? "on" : ""}`} style={{ "--tc": x.color } as CSSProperties} onClick={() => setSelected(x.id)} role="button" tabIndex={0} max={12}>
                <Icon size={26} />
                <b>{x.name}</b>
                <span>{x.when}</span>
              </Tilt>
            );
          })}
        </div>
        <p className="mono" style={{ fontSize: 18, color: t.color, marginTop: 22 }}>{t.path}</p>
      </div>
      <Aperture style={{ left: 1000, top: 110, width: 800, height: 790 }} provenance="implemented" provenanceText="Implemented: voice companion web app" glow={t.color}>
        <svg viewBox="0 0 800 790" width="800" height="790" role="img" aria-label={`Speech path using ${t.name}`}>
          <defs>
            <filter id="vGlow"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          {chain.map((n, i) => {
            const y = 95 + i * 140;
            return (
              <g key={`${t.id}-${n.label}`}>
                {i < chain.length - 1 && (
                  <>
                    <line x1="400" y1={y + 36} x2="400" y2={y + 104} stroke={n.color} strokeOpacity=".35" strokeWidth="3" />
                    {!reducedMotion && [0, 1, 2].map((k) => (
                      <motion.circle key={k} cx="400" r="6" fill={n.color} filter="url(#vGlow)" initial={{ cy: y + 36, opacity: 0 }} animate={{ cy: [y + 36, y + 104], opacity: [0, 1, 0] }} transition={{ duration: 1, repeat: Infinity, delay: k * 0.33 + i * 0.15, ease: "easeInOut" }} />
                    ))}
                  </>
                )}
                <rect x="190" y={y - 36} width="420" height="72" rx="36" fill={i === 1 ? `${n.color}33` : "rgba(10,13,32,.85)"} stroke={n.color} strokeWidth={i === 1 ? 3 : 1.6} filter={i === 1 ? "url(#vGlow)" : undefined} />
                <circle cx="232" cy={y} r="9" fill={n.color} filter="url(#vGlow)" />
                <text x="410" y={y + 9} textAnchor="middle" fontSize="25" fontFamily="Space Grotesk Variable" fontWeight="600" fill="#eef3fa">{n.label}</text>
              </g>
            );
          })}
          <text x="400" y="770" textAnchor="middle" fontSize="16" fill="#9aa8c2" fontFamily="JetBrains Mono">voice eleven_flash_v2_5 · urgent lines use lower stability</text>
        </svg>
      </Aperture>
    </div>
  );
};
