// Canvas drawing primitives shared by the camera-view simulations
import { alpha, colors } from "../theme";
import type { Box } from "./hazards";

// Per-class fill colors so every object reads at a glance
export const objectColors: Record<string, string> = {
  person: "#f2f5ff",
  bench: colors.violet,
  cone: colors.orange,
  "traffic cone": colors.orange,
  bicycle: colors.sky,
  chair: colors.lime,
  "potted plant": colors.green,
  car: colors.indigo,
  "trash can": colors.magenta,
};

export const colorFor = (kind: string) => objectColors[kind] ?? colors.cyan;

// Perspective walkway with neon lane lines and skyline; returns horizon y
export const drawStreet = (ctx: CanvasRenderingContext2D, w: number, h: number, scroll: number, raw = false) => {
  const horizon = h * 0.36;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, raw ? "#161b28" : "#090722");
  sky.addColorStop(0.65, raw ? "#232b3b" : "#1a1240");
  sky.addColorStop(1, raw ? "#2c3445" : "#3a1d55");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);
  // Glow band at the horizon
  if (!raw) {
    const band = ctx.createLinearGradient(0, horizon - 60, 0, horizon + 10);
    band.addColorStop(0, "rgba(255,95,210,0)");
    band.addColorStop(1, "rgba(255,95,210,.28)");
    ctx.fillStyle = band;
    ctx.fillRect(0, horizon - 60, w, 70);
  }
  const ground = ctx.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, raw ? "#2b2f37" : "#120d2c");
  ground.addColorStop(1, raw ? "#3a3e46" : "#06121f");
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, w, h - horizon);
  // Skyline blocks with lit windows
  [0.02, 0.1, 0.16, 0.27, 0.34, 0.62, 0.7, 0.79, 0.88].forEach((x, i) => {
    const bh = h * (0.08 + ((i * 37) % 11) / 70);
    ctx.fillStyle = raw ? "#1d2330" : i % 2 ? "#120f33" : "#0d1530";
    ctx.fillRect(x * w, horizon - bh, w * 0.075, bh);
    if (!raw) {
      ctx.fillStyle = i % 3 ? "rgba(63,224,255,.35)" : "rgba(255,181,71,.35)";
      for (let k = 0; k < 6; k++) ctx.fillRect(x * w + 6 + (k % 3) * (w * 0.02), horizon - bh + 10 + Math.floor(k / 3) * 18, 4, 6);
    }
  });
  const cx = w / 2;
  ctx.lineWidth = 2;
  ctx.strokeStyle = raw ? "rgba(220,220,220,.25)" : "rgba(178,123,255,.45)";
  ctx.beginPath();
  ctx.moveTo(cx - 30, horizon);
  ctx.lineTo(w * 0.08, h);
  ctx.moveTo(cx + 30, horizon);
  ctx.lineTo(w * 0.92, h);
  ctx.stroke();
  for (let i = 0; i < 14; i++) {
    const t = (i + (scroll % 1)) / 14;
    const d = t * t;
    const y = horizon + d * (h - horizon);
    const half = 30 + d * (w * 0.42 - 30);
    ctx.strokeStyle = raw ? `rgba(220,220,220,${0.05 + d * 0.15})` : `rgba(63,224,255,${0.05 + d * 0.22})`;
    ctx.beginPath();
    ctx.moveTo(cx - half, y);
    ctx.lineTo(cx + half, y);
    ctx.stroke();
  }
  return horizon;
};

// Stick figure with walking gait
export const drawPerson = (ctx: CanvasRenderingContext2D, x: number, feet: number, height: number, phase: number, color: string) => {
  const head = height * 0.12;
  const swing = Math.sin(phase) * height * 0.11;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = height * 0.085;
  ctx.beginPath();
  ctx.moveTo(x, feet - height * 0.47);
  ctx.lineTo(x + swing, feet - height * 0.02);
  ctx.moveTo(x, feet - height * 0.47);
  ctx.lineTo(x - swing, feet - height * 0.02);
  ctx.stroke();
  ctx.lineWidth = height * 0.16;
  ctx.beginPath();
  ctx.moveTo(x, feet - height * 0.5);
  ctx.lineTo(x, feet - height * 0.76);
  ctx.stroke();
  ctx.lineWidth = height * 0.06;
  ctx.beginPath();
  ctx.moveTo(x, feet - height * 0.74);
  ctx.lineTo(x - swing * 0.8, feet - height * 0.5);
  ctx.moveTo(x, feet - height * 0.74);
  ctx.lineTo(x + swing * 0.8, feet - height * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, feet - height * 0.88, head * 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// Shaded fill that fakes a top light for a slight 3D read
const shade = (ctx: CanvasRenderingContext2D, color: string, y1: number, y2: number, opacity: number) => {
  const g = ctx.createLinearGradient(0, y1, 0, y2);
  g.addColorStop(0, alpha(color, opacity));
  g.addColorStop(1, alpha(color, opacity * 0.45));
  return g;
};

// Simple iconic objects drawn inside a box, colored per class
export const drawObject = (ctx: CanvasRenderingContext2D, kind: string, box: Box, opacity = 0.9, phase = 0, override?: string) => {
  const [x1, y1, x2, y2] = box;
  const w = x2 - x1;
  const h = y2 - y1;
  const color = override ?? colorFor(kind);
  ctx.save();
  // Ground shadow
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.ellipse(x1 + w / 2, y2, w * 0.55, Math.max(3, h * 0.06), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(ctx, color, y1, y2, opacity);
  ctx.strokeStyle = alpha(color, opacity);
  ctx.lineWidth = Math.max(2, w * 0.06);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = alpha(color, 0.55 * opacity);
  ctx.shadowBlur = 18;
  switch (kind) {
    case "person":
      drawPerson(ctx, x1 + w / 2, y2, h, phase, alpha(color, opacity));
      break;
    case "chair":
      ctx.fillRect(x1 + w * 0.1, y1, w * 0.12, h);
      ctx.fillRect(x1 + w * 0.1, y1 + h * 0.5, w * 0.8, h * 0.1);
      ctx.fillRect(x1 + w * 0.78, y1 + h * 0.5, w * 0.12, h * 0.5);
      ctx.fillRect(x1 + w * 0.1, y1, w * 0.5, h * 0.08);
      break;
    case "bench":
      ctx.fillRect(x1, y1 + h * 0.3, w, h * 0.14);
      ctx.fillRect(x1, y1, w, h * 0.1);
      ctx.fillRect(x1 + w * 0.06, y1 + h * 0.3, w * 0.06, h * 0.7);
      ctx.fillRect(x1 + w * 0.88, y1 + h * 0.3, w * 0.06, h * 0.7);
      break;
    case "cone":
    case "traffic cone":
      ctx.beginPath();
      ctx.moveTo(x1 + w / 2, y1);
      ctx.lineTo(x2 - w * 0.12, y2 - h * 0.1);
      ctx.lineTo(x1 + w * 0.12, y2 - h * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x1, y2 - h * 0.12, w, h * 0.12);
      ctx.fillStyle = `rgba(255,255,255,${0.7 * opacity})`;
      ctx.fillRect(x1 + w * 0.3, y1 + h * 0.45, w * 0.4, h * 0.1);
      break;
    case "potted plant":
      ctx.fillRect(x1 + w * 0.25, y1 + h * 0.6, w * 0.5, h * 0.4);
      ctx.beginPath();
      ctx.ellipse(x1 + w / 2, y1 + h * 0.32, w * 0.48, h * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "bicycle": {
      const r = Math.min(w * 0.22, h * 0.36);
      ctx.lineWidth = Math.max(2, r * 0.18);
      ctx.beginPath();
      ctx.arc(x1 + r + 2, y2 - r, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x2 - r - 2, y2 - r, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x1 + r + 2, y2 - r);
      ctx.lineTo(x1 + w * 0.45, y2 - r * 2.1);
      ctx.lineTo(x2 - r - 2, y2 - r);
      ctx.moveTo(x1 + w * 0.45, y2 - r * 2.1);
      ctx.lineTo(x2 - r * 1.4, y1 + h * 0.08);
      ctx.stroke();
      break;
    }
    case "car": {
      const wheel = h * 0.17;
      ctx.beginPath();
      ctx.moveTo(x1, y2 - wheel);
      ctx.lineTo(x1, y1 + h * 0.45);
      ctx.lineTo(x1 + w * 0.2, y1 + h * 0.42);
      ctx.lineTo(x1 + w * 0.32, y1 + h * 0.05);
      ctx.lineTo(x1 + w * 0.72, y1 + h * 0.05);
      ctx.lineTo(x1 + w * 0.86, y1 + h * 0.42);
      ctx.lineTo(x2, y1 + h * 0.5);
      ctx.lineTo(x2, y2 - wheel);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = colors.void;
      ctx.beginPath();
      ctx.arc(x1 + w * 0.22, y2 - wheel, wheel, 0, Math.PI * 2);
      ctx.arc(x1 + w * 0.78, y2 - wheel, wheel, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default:
      ctx.fillRect(x1, y1, w, h);
  }
  ctx.restore();
};

// Detection box: full or corner brackets, dashed when predicted, with a label tab
export const drawBox = (ctx: CanvasRenderingContext2D, box: Box, color: string, label?: string, dashed = false, brackets = false) => {
  const [x1, y1, x2, y2] = box;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  if (dashed) ctx.setLineDash([7, 6]);
  if (brackets) {
    const c = Math.min(22, (x2 - x1) / 3, (y2 - y1) / 3);
    ctx.beginPath();
    ctx.moveTo(x1, y1 + c); ctx.lineTo(x1, y1); ctx.lineTo(x1 + c, y1);
    ctx.moveTo(x2 - c, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, y1 + c);
    ctx.moveTo(x2, y2 - c); ctx.lineTo(x2, y2); ctx.lineTo(x2 - c, y2);
    ctx.moveTo(x1 + c, y2); ctx.lineTo(x1, y2); ctx.lineTo(x1, y2 - c);
    ctx.stroke();
    ctx.fillStyle = alpha(color, 0.06);
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  } else ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  if (label) {
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.font = '500 15px "JetBrains Mono", monospace';
    const tw = ctx.measureText(label).width + 14;
    ctx.fillStyle = color;
    ctx.fillRect(x1 - 1, y1 - 24, tw, 22);
    ctx.fillStyle = colors.void;
    ctx.fillText(label, x1 + 6, y1 - 8);
  }
  ctx.restore();
};

// Gimbal aim reticle at frame centre
export const drawReticle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.moveTo(x - r * 1.8, y); ctx.lineTo(x - r * 0.5, y);
  ctx.moveTo(x + r * 0.5, y); ctx.lineTo(x + r * 1.8, y);
  ctx.moveTo(x, y - r * 1.8); ctx.lineTo(x, y - r * 0.5);
  ctx.moveTo(x, y + r * 0.5); ctx.lineTo(x, y + r * 1.8);
  ctx.stroke();
  ctx.restore();
};

// Walking corridor overlay used by the hazard scorer
export const drawCorridor = (ctx: CanvasRenderingContext2D, w: number, h: number, horizon: number, fraction = 0.34) => {
  const half = (w * fraction) / 2;
  ctx.save();
  const g = ctx.createLinearGradient(0, horizon, 0, h);
  g.addColorStop(0, "rgba(255,77,94,0)");
  g.addColorStop(1, "rgba(255,77,94,.14)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 12, horizon);
  ctx.lineTo(w / 2 + 12, horizon);
  ctx.lineTo(w / 2 + half, h);
  ctx.lineTo(w / 2 - half, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,77,94,.4)";
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(w / 2 - half, horizon); ctx.lineTo(w / 2 - half, h);
  ctx.moveTo(w / 2 + half, horizon); ctx.lineTo(w / 2 + half, h);
  ctx.stroke();
  ctx.restore();
};

export const riskColor = (danger: number) => (danger >= 0.7 ? colors.red : danger >= 0.5 ? colors.amber : colors.cyan);
