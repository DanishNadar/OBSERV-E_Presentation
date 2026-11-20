import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";
import { motif } from "../theme";
import { useMotion, motionVars } from "../lib/hooks";

const provenanceLabels = {
  simulated: "Simulated demo",
  schematic: "Schematic, not to scale",
  real: "Real project CAD",
  implemented: "Implemented in repo",
  optional: "Optional integration",
  future: "Future direction",
  illustrative: "Illustrative scenario",
} as const;

export type Provenance = keyof typeof provenanceLabels;

export const ProvenanceTag = ({ kind, text }: { kind: Provenance; text?: string }) => (
  <div className={`provenance prov-${kind}`}>
    <span className="dot" />
    {text ?? provenanceLabels[kind]}
  </div>
);

// Glass viewport with corner brackets and a provenance tag
export const Aperture = ({ children, style, provenance, provenanceText, className, glow }: {
  children: ReactNode;
  style?: CSSProperties;
  provenance?: Provenance;
  provenanceText?: string;
  className?: string;
  glow?: string;
}) => (
  <div className={`aperture ${className ?? ""}`} style={{ ...style, ...(glow ? ({ "--glow": glow } as CSSProperties) : {}) }}>
    <div className="apertureInner">
      {provenance && <ProvenanceTag kind={provenance} text={provenanceText} />}
      {children}
    </div>
    <i className="corner tl" />
    <i className="corner tr" />
    <i className="corner bl" />
    <i className="corner br" />
  </div>
);

export const Kicker = ({ act, children, color }: { act: string; children: ReactNode; color?: string }) => (
  <p className="kicker" style={color ? ({ "--kc": color } as CSSProperties) : undefined}>
    <span className="actNo">{act}</span>
    {children}
  </p>
);

export const Slider = ({ label, value, min, max, step, onChange, format, accent }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  accent?: string;
}) => {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="sliderRow">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--fill": `${fill}%`, "--accent": accent } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output style={accent ? { color: accent } : undefined}>{format ? format(value) : value}</output>
    </label>
  );
};

export const PlayControls = ({ running, onToggle, onReset }: { running: boolean; onToggle: () => void; onReset: () => void }) => (
  <div className="controlBar">
    <button className="chip" onClick={onToggle} aria-label={running ? "Pause simulation" : "Play simulation"}>
      {running ? <Pause size={18} /> : <Play size={18} />} {running ? "Pause" : "Play"}
    </button>
    <button className="chip" onClick={onReset} aria-label="Reset simulation">
      <RotateCcw size={18} /> Reset
    </button>
  </div>
);

// Pointer-driven 3D tilt with a moving specular highlight
export const Tilt = ({ children, className, style, max = 10, onClick, ...rest }: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  max?: number;
  onClick?: () => void;
  role?: string;
  tabIndex?: number;
  "aria-pressed"?: boolean;
  "aria-label"?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { reducedMotion } = useMotion();
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ref.current.style.setProperty("--rx", `${(0.5 - py) * max}deg`);
    ref.current.style.setProperty("--ry", `${(px - 0.5) * max}deg`);
    ref.current.style.setProperty("--mx", `${px * 100}%`);
    ref.current.style.setProperty("--my", `${py * 100}%`);
  };
  const leave = () => {
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  };
  return (
    <div
      ref={ref}
      className={`tilt ${className ?? ""}`}
      style={style}
      onPointerMove={move}
      onPointerLeave={leave}
      onClick={onClick}
      onKeyDown={(e) => onClick && (e.key === "Enter" || e.key === " ") && onClick()}
      {...rest}
    >
      {children}
      <span className="tiltShine" aria-hidden="true" />
    </div>
  );
};

// Six-stage pipeline motif as glowing glass chips
export const Motif = ({ highlight, size = "md", delay = 0.9 }: { highlight?: number; size?: "md" | "lg"; delay?: number }) => {
  const { reducedMotion } = useMotion();
  return (
    <div className={`motif motif-${size}`}>
      {motif.map((m, i) => (
        <motion.div
          key={m.name}
          className="motifStep"
          style={motionVars({ "--mc": m.color })}
          initial={reducedMotion ? false : { opacity: 0, y: 18, rotateX: -50 }}
          animate={{ opacity: highlight === undefined || highlight === i ? 1 : 0.3, y: 0, rotateX: 0 }}
          transition={{ delay: reducedMotion ? 0 : delay + i * 0.18, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="motifIndex">{String(i + 1).padStart(2, "0")}</span>
          <span className="motifDot" />
          <span className="motifName">{m.name}</span>
          {size === "lg" && <span className="motifBlurb">{m.blurb}</span>}
        </motion.div>
      ))}
    </div>
  );
};

export const Logo = ({ height = 220, mark = false, style }: { height?: number; mark?: boolean; style?: CSSProperties }) => (
  <img
    className="logo"
    src={mark ? "./img/observe-mark.png" : "./img/observe-logo.png"}
    alt="OBSERV-E logo"
    style={{ height, ...style }}
    draggable={false}
  />
);

export const Legend = ({ items, className, style }: { items: { label: string; color: string }[]; className?: string; style?: CSSProperties }) => (
  <div className={`legend ${className ?? ""}`} style={style}>
    {items.map((i) => (
      <span key={i.label}>
        <i style={{ background: i.color, boxShadow: `0 0 10px ${i.color}` }} />
        {i.label}
      </span>
    ))}
  </div>
);
