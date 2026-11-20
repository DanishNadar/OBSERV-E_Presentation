// Ports of hazardDetector.py, riskEngine.py, narration.py and targetSelector.py
export type Box = [number, number, number, number];
export type Side = "left" | "center" | "right";

export interface Detection {
  label: string;
  confidence: number;
  box: Box;
}

export interface Hazard extends Detection {
  distanceScore: number;
  side: Side;
  inPathCorridor: boolean;
  dangerScore: number;
}

export const vehicleLabels = new Set(["car", "truck", "bus", "motorcycle", "bicycle", "scooter", "train"]);
const obstacleLabels = new Set([
  "chair", "bench", "potted plant", "fire hydrant", "stop sign", "parking meter",
  "traffic cone", "cone", "barrier", "bollard", "suitcase", "backpack", "stroller",
]);

const baseDanger = (label: string) =>
  vehicleLabels.has(label) ? 0.92 : obstacleLabels.has(label) ? 0.62 : label === "person" ? 0.38 : 0.48;

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Monocular proximity from box area and how low it sits in the frame
export const scoreHazard = (d: Detection, frameW: number, frameH: number, corridor = 0.34): Hazard => {
  const [x1, y1, x2, y2] = d.box;
  const w = x2 - x1;
  const h = y2 - y1;
  const cx = x1 + w / 2;
  const cy = y1 + h / 2;
  const area = clamp01(((w * h) / (frameW * frameH)) * 9);
  const lowness = clamp01(cy / frameH);
  const inPathCorridor = Math.abs(cx - frameW / 2) <= (frameW * corridor) / 2;
  const distanceScore = clamp01(0.6 * area + 0.4 * lowness);
  const dangerScore = clamp01(baseDanger(d.label) * 0.55 + d.confidence * 0.15 + distanceScore * 0.15 + (inPathCorridor ? 0.15 : 0));
  const side: Side = cx < frameW * 0.42 ? "left" : cx > frameW * 0.58 ? "right" : "center";
  return { ...d, distanceScore, side, inPathCorridor, dangerScore };
};

const movingLabels = ["car", "truck", "bus", "motorcycle", "bicycle", "scooter"];

export const summarizeHazards = (hazards: Hazard[]) => {
  const sorted = [...hazards].sort((a, b) => b.dangerScore - a.dangerScore);
  let vehicleThreat = 0;
  let pathDanger = 0;
  let hazardProximity = 0;
  for (const h of sorted) {
    hazardProximity = Math.max(hazardProximity, h.distanceScore);
    if (h.inPathCorridor) pathDanger = Math.max(pathDanger, h.dangerScore);
    if (movingLabels.includes(h.label)) {
      const sideBoost = h.side !== "center" ? 0.08 : 0;
      vehicleThreat = Math.max(vehicleThreat, Math.min(1, h.dangerScore + sideBoost));
    }
  }
  return { hazards: sorted, topHazard: sorted[0] ?? null, vehicleThreat, pathDanger, hazardProximity };
};

export const riskWeights = {
  fallScore: 0.22,
  hazardProximity: 0.16,
  immobility: 0.12,
  nonResponse: 0.18,
  voiceHelp: 0.2,
  pathDanger: 0.12,
  trafficThreat: 0.18,
} as const;

export type RiskKey = keyof typeof riskWeights;
export type RiskSignals = Partial<Record<RiskKey, number>>;

export const riskLevels = [
  { level: 1, value: 0.33, name: "Caution" },
  { level: 2, value: 0.52, name: "Check-in" },
  { level: 3, value: 0.72, name: "Contact" },
  { level: 4, value: 0.88, name: "Emergency" },
] as const;

export const assessRisk = (signals: RiskSignals) => {
  let riskScore = 0;
  for (const key of Object.keys(riskWeights) as RiskKey[]) riskScore += clamp01(signals[key] ?? 0) * riskWeights[key];
  riskScore = clamp01(riskScore);
  let eventLevel = 0;
  for (const l of riskLevels) if (riskScore >= l.value) eventLevel = l.level;
  const reasons: string[] = [];
  if ((signals.fallScore ?? 0) >= 0.5) reasons.push("possible fall posture");
  if ((signals.trafficThreat ?? 0) >= 0.55) reasons.push("traffic nearby");
  if ((signals.pathDanger ?? 0) >= 0.55) reasons.push("path blockage");
  if ((signals.immobility ?? 0) >= 0.55) reasons.push("unexpected immobility");
  if ((signals.nonResponse ?? 0) >= 0.55) reasons.push("no user response");
  if ((signals.voiceHelp ?? 0) >= 0.45) reasons.push("help request");
  return { riskScore, eventLevel, reasons };
};

// Immediate alert text from narration.py
export const immediateAlert = (eventLevel: number, top: Hazard | null) => {
  if (eventLevel >= 4) return "Emergency risk is very high. Starting emergency escalation.";
  if (eventLevel >= 3) return "High risk detected. Contacting your trusted person now.";
  if (eventLevel >= 2) return "I think you may need help. Say I am okay or press cancel.";
  if (!top) return null;
  const { label, side } = top;
  if (movingLabels.includes(label))
    return side === "center" ? `Stop. ${label} ahead.` : `${label[0].toUpperCase()}${label.slice(1)} approaching from your ${side}.`;
  if (top.inPathCorridor)
    return side === "center" ? `Obstacle ahead. ${label} in your path.` : `Obstacle near your path on the ${side}. ${label} ahead.`;
  return null;
};

// First lock prefers centred, confident people
export const acquireScore = (cx: number, cy: number, conf: number, w: number, h: number) => {
  const hx = w / 2;
  const hy = h / 2;
  return (1 - Math.hypot(cx - hx, cy - hy) / Math.hypot(hx, hy)) * 0.65 + conf * 0.35;
};

export const iou = (a: Box, b: Box) => {
  const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const inter = ix * iy;
  const union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
  return union > 0 ? inter / union : 0;
};

// Keep-lock scoring with a distance + IoU gate
export const keepScore = (box: Box, conf: number, predicted: [number, number], previous: Box, w: number, h: number, gateFraction = 0.3, minIou = 0.05) => {
  const cx = (box[0] + box[2]) / 2;
  const cy = (box[1] + box[3]) / 2;
  const gate = Math.hypot(w, h) * gateFraction;
  const dist = Math.hypot(cx - predicted[0], cy - predicted[1]);
  const overlap = iou(box, previous);
  const passesGate = dist <= gate || overlap >= minIou;
  const distanceScore = Math.max(0, 1 - dist / gate);
  return { passesGate, distanceScore, overlap, total: distanceScore * 0.55 + overlap * 0.25 + conf * 0.2 };
};
