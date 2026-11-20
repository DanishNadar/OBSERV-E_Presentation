// Port of conversationSpeech.py: speak on change, rank by priority, enforce gaps and cooldowns
import { vehicleLabels, type Hazard } from "./hazards";

export interface SpeechEvent {
  timestamp: number;
  eventType: string;
  text: string;
  priority: number;
  source: "tracking" | "risk" | "hazard" | "vlm";
}

export interface PlannerInput {
  targetLocked: boolean;
  eventLevel: number;
  topHazard: Hazard | null;
  pathDanger: number;
  trafficThreat: number;
  nonResponse?: number;
  immediateAlert?: string | null;
  contextText?: { timestamp: number; summary: string; action?: string } | null;
}

const severityBucket = (v: number) => (v >= 0.8 ? 4 : v >= 0.6 ? 3 : v >= 0.4 ? 2 : v >= 0.25 ? 1 : 0);
const hazardSignature = (h: Hazard) => `${h.label}|${h.side}|${h.inPathCorridor ? "path" : "offpath"}`;

export class SpeechPlanner {
  minGapSec = 1.2;
  interruptGapSec = 0.55;
  sameHazardCooldownSec = 5;
  contextCooldownSec = 3.5;
  clearPathHoldSec = 1;
  clearPathCooldownSec = 5;
  nonResponseReminderSec = 3;

  lastSpokenTime = -100;
  lastEventLevel = 0;
  lastTargetLocked: boolean | null = null;
  lastHazardSignature: string | null = null;
  lastHazardSeverityBucket = 0;
  lastTrafficBucket = 0;
  lastPathBucket = 0;
  lastContextSeen = 0;
  pendingContext: { text: string; priority: number } | null = null;
  lastSpokenByKey: Record<string, number> = {};
  clearPathSince: number | null = null;
  lastSuppression: string | null = null;
  // Visualization extra: every candidate considered on the last tick
  lastCandidates: SpeechEvent[] = [];

  cooldownPassed(key: string, now: number, cooldown: number) {
    return now - (this.lastSpokenByKey[key] ?? -100) >= cooldown;
  }

  // Seconds left before a key may speak again
  cooldownRemaining(key: string, now: number, cooldown: number) {
    return Math.max(0, cooldown - (now - (this.lastSpokenByKey[key] ?? -100)));
  }

  update(input: PlannerInput, now: number): SpeechEvent | null {
    const candidates: SpeechEvent[] = [];
    this.lastSuppression = null;
    const { targetLocked, eventLevel, topHazard, pathDanger, trafficThreat } = input;
    const nonResponse = input.nonResponse ?? 0;

    if (this.lastTargetLocked === null) this.lastTargetLocked = targetLocked;
    else if (this.lastTargetLocked && !targetLocked)
      candidates.push({ timestamp: now, eventType: "trackingLost", text: "I lost sight of you for a moment. Please step back into view or say here.", priority: 100, source: "tracking" });
    else if (!this.lastTargetLocked && targetLocked)
      candidates.push({ timestamp: now, eventType: "trackingRecovered", text: "I see you again. I am back with you.", priority: 88, source: "tracking" });
    this.lastTargetLocked = targetLocked;

    if (eventLevel >= 4 && this.lastEventLevel < 4)
      candidates.push({ timestamp: now, eventType: "emergencyEscalation", text: "This looks like an emergency. I am escalating now.", priority: 120, source: "risk" });
    else if (eventLevel >= 3 && this.lastEventLevel < 3)
      candidates.push({ timestamp: now, eventType: "contactEscalation", text: "I still think you may need help. I am contacting your trusted person now.", priority: 115, source: "risk" });
    else if (eventLevel >= 2 && this.lastEventLevel < 2)
      candidates.push({ timestamp: now, eventType: "checkIn", text: "I think something may be wrong. Are you okay? Say I am okay or say cancel.", priority: 110, source: "risk" });
    else if (eventLevel >= 2 && nonResponse >= 0.45 && this.cooldownPassed("checkInReminder", now, this.nonResponseReminderSec))
      candidates.push({ timestamp: now, eventType: "checkInReminder", text: "I still have not heard from you. Please say I am okay if you are safe.", priority: 112, source: "risk" });

    const hazard = this.buildHazardCandidate(topHazard, pathDanger, trafficThreat, input.immediateAlert ?? "", now);
    if (hazard) candidates.push(hazard);

    if (input.contextText && input.contextText.timestamp > this.lastContextSeen) {
      this.lastContextSeen = input.contextText.timestamp;
      let summary = input.contextText.summary.trim().replace(/[. ]+$/, "");
      const lower = summary.toLowerCase();
      if (lower.startsWith("i see ")) summary = summary.slice(6);
      else if (lower.startsWith("there is ")) summary = summary.slice(9);
      summary = summary.charAt(0).toLowerCase() + summary.slice(1);
      let text = `Also, I notice ${summary}.`;
      if (input.contextText.action) {
        const action = input.contextText.action.replace(/[. ]+$/, "");
        text = `Also, I notice ${summary}. I suggest you ${action.charAt(0).toLowerCase() + action.slice(1)}.`;
      }
      this.pendingContext = { text, priority: eventLevel <= 1 ? 46 : 36 };
    }
    if (this.pendingContext && this.cooldownPassed("contextSpeech", now, this.contextCooldownSec))
      candidates.push({ timestamp: now, eventType: "contextUpdate", text: this.pendingContext.text, priority: this.pendingContext.priority, source: "vlm" });

    this.lastCandidates = [...candidates].sort((a, b) => b.priority - a.priority);
    let chosen = this.chooseEvent(candidates, now);
    this.lastEventLevel = eventLevel;

    // Path-clear confirmation after a calm hold
    if (!topHazard || (pathDanger < 0.25 && trafficThreat < 0.25)) {
      if (this.lastHazardSignature !== null) {
        if (this.clearPathSince === null) this.clearPathSince = now;
        else if (now - this.clearPathSince >= this.clearPathHoldSec && this.cooldownPassed("pathClear", now, this.clearPathCooldownSec)) {
          if (!chosen && now - this.lastSpokenTime >= this.minGapSec)
            chosen = { timestamp: now, eventType: "pathClear", text: "Okay, that immediate obstacle is no longer in your path.", priority: 42, source: "hazard" };
          this.lastHazardSignature = null;
          this.lastHazardSeverityBucket = 0;
          this.lastTrafficBucket = 0;
          this.lastPathBucket = 0;
        }
      } else this.clearPathSince = null;
    } else this.clearPathSince = null;

    if (chosen) {
      this.lastSpokenTime = now;
      this.lastSpokenByKey[chosen.eventType] = now;
      if ((chosen.eventType === "pathHazard" || chosen.eventType === "trafficThreat") && this.lastHazardSignature)
        this.lastSpokenByKey[`hazard:${this.lastHazardSignature}`] = now;
      if (chosen.eventType === "contextUpdate") {
        this.lastSpokenByKey.contextSpeech = now;
        this.pendingContext = null;
      }
    }
    return chosen;
  }

  buildHazardCandidate(hazard: Hazard | null, pathDanger: number, traffic: number, alert: string, now: number): SpeechEvent | null {
    if (!hazard) return null;
    const severity = Math.max(hazard.dangerScore, pathDanger, traffic);
    const isVehicle = vehicleLabels.has(hazard.label);
    if (severity < (isVehicle ? 0.24 : 0.28)) {
      this.lastSuppression = "below severity threshold";
      return null;
    }
    const signature = hazardSignature(hazard);
    const sevBucket = severityBucket(severity);
    const pathBucket = severityBucket(pathDanger);
    const trafficBucket = severityBucket(traffic);
    const isNew = signature !== this.lastHazardSignature;
    const isWorse = sevBucket > this.lastHazardSeverityBucket || pathBucket > this.lastPathBucket || trafficBucket > this.lastTrafficBucket;
    const repeatReady = this.cooldownPassed(`hazard:${signature}`, now, this.sameHazardCooldownSec);
    this.lastHazardSignature = signature;
    this.lastHazardSeverityBucket = sevBucket;
    this.lastTrafficBucket = trafficBucket;
    this.lastPathBucket = pathBucket;
    const mayRepeat = repeatReady && !this.pendingContext && (isVehicle || sevBucket >= 4);
    if (!(isNew || isWorse || mayRepeat)) {
      this.lastSuppression = "same hazard, already announced";
      return null;
    }
    const { label, side } = hazard;
    if (isVehicle && traffic >= 0.4) {
      const text =
        side === "center"
          ? traffic >= 0.7
            ? `Stop for a moment. There is a ${label} moving into the space ahead.`
            : `I see a ${label} ahead. Please wait a second and let it pass.`
          : isNew
            ? `Heads up. I see a ${label} coming from your ${side} side.`
            : `That ${label} is still close on your ${side}. Please keep clear.`;
      return { timestamp: now, eventType: "trafficThreat", text, priority: traffic >= 0.7 ? 96 : 82, source: "hazard" };
    }
    const text =
      pathDanger >= 0.7
        ? side === "center"
          ? `Slow down. There is a ${label} directly ahead in your path.`
          : `Slow down. There is a ${label} crowding your path on the ${side}.`
        : isNew
          ? side === "center"
            ? `I see a ${label} ahead. A small adjustment around it would be safer.`
            : `I see a ${label} on the ${side} side of your path. Shift a little away from it.`
          : alert || `That ${label} is still near your path. Keep easing away from it.`;
    return { timestamp: now, eventType: "pathHazard", text, priority: pathDanger >= 0.55 ? 78 : 64, source: "hazard" };
  }

  chooseEvent(candidates: SpeechEvent[], now: number) {
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.priority - a.priority);
    const top = candidates[0];
    const gap = top.priority >= 100 ? this.interruptGapSec : this.minGapSec;
    if (now - this.lastSpokenTime < gap) {
      this.lastSuppression = `held: ${gap}s gap since last line`;
      return null;
    }
    return top;
  }
}
