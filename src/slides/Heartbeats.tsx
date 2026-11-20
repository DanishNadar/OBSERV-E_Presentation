import { useEffect, useRef, useState, type CSSProperties } from "react";
import { colors, alpha } from "../theme";
import { Aperture, Kicker, Slider } from "../components/ui";
import { setupCanvas, useAnimationLoop, useMotion } from "../lib/hooks";

const clocks = [
  { name: "IMU rotation vector", hz: 1000, color: colors.green, source: "observe_firmware: SH2_GYRO_INTEGRATED_RV, 1000 µs" },
  { name: "Gimbal state publisher", hz: 200, color: colors.amber, source: "runCameraDemo --controlHz 100–300" },
  { name: "Camera frames", hz: 30, color: colors.cyan, source: "Kalman dt 1/30 s in config" },
  { name: "YOLO detection", hz: 15, color: colors.indigo, source: "detectEvery: 2 → every other frame" },
  { name: "Speech, at most", hz: 1 / 1.2, color: colors.magenta, source: "speech.minGapSec 1.2 s" },
  { name: "Vision-language summary", hz: 0.5, color: colors.violet, source: "vlm.intervalSec 2.0 s (optional)" },
];

const width = 1180;
const lane = 96;
const height = lane * clocks.length;

export const Heartbeats = () => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [windowSec, setWindowSec] = useState(0.25);
  const { reducedMotion } = useMotion();

  const draw = (_dt: number, elapsed: number) => {
    const c = canvas.current;
    if (!c) return;
    const ctx = setupCanvas(c, width, height);
    ctx.clearRect(0, 0, width, height);
    const now = 3 + elapsed * (windowSec / 8);
    clocks.forEach((clk, row) => {
      const y = row * lane + lane / 2;
      // Lane glow band
      const band = ctx.createLinearGradient(0, 0, width, 0);
      band.addColorStop(0, alpha(clk.color, 0));
      band.addColorStop(1, alpha(clk.color, 0.09));
      ctx.fillStyle = band;
      ctx.fillRect(0, row * lane + 8, width, lane - 16);
      ctx.strokeStyle = alpha(clk.color, 0.18);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      const period = 1 / clk.hz;
      const pxPerSec = width / windowSec;
      const first = Math.ceil((now - windowSec) / period);
      const last = Math.floor(now / period);
      const stride = Math.max(1, Math.ceil((last - first) / 1400));
      const tickH = clk.hz < 40 ? 30 : 20;
      ctx.save();
      ctx.strokeStyle = clk.color;
      ctx.shadowColor = clk.color;
      ctx.shadowBlur = (last - first) / stride > 300 ? 0 : 12;
      ctx.lineWidth = (last - first) / stride > 300 ? 1 : 2.5;
      ctx.beginPath();
      for (let k = first; k <= last; k += stride) {
        const x = width - (now - k * period) * pxPerSec;
        ctx.moveTo(x, y - tickH);
        ctx.lineTo(x, y + tickH);
      }
      ctx.stroke();
      // Newest tick gets a bright head
      const xLast = width - (now - last * period) * pxPerSec;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(xLast, y - tickH, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    // "Now" scanline on the right edge
    const g = ctx.createLinearGradient(width - 80, 0, width, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(255,255,255,.08)");
    ctx.fillStyle = g;
    ctx.fillRect(width - 80, 0, 80, height);
  };

  useAnimationLoop(draw, !reducedMotion);
  useEffect(() => draw(0, 3), [windowSec]);

  return (
    <div className="slide heartbeats">
      <Kicker act="II" color={colors.green}>What makes it technically interesting</Kicker>
      <h2 className="title" style={{ maxWidth: 1560, fontSize: 62 }}>
        Six clocks, <span className="grad">three orders of magnitude apart</span>, all serving one person.
      </h2>
      <div className="heartbeatGrid">
        <div className="heartbeatLabels">
          {clocks.map((c) => (
            <div key={c.name} className="heartbeatLabel" style={{ height: lane, "--lc": c.color } as CSSProperties}>
              <span className="hbName">{c.name}</span>
              <span className="hbRate mono">{c.hz >= 1 ? `${Math.round(c.hz)} Hz` : `every ${(1 / c.hz).toFixed(1)} s`}</span>
              <span className="hbSource mono">{c.source}</span>
            </div>
          ))}
        </div>
        <Aperture style={{ position: "relative", width, height }} provenance="implemented" provenanceText="Rates from repo configs" glow={colors.green}>
          <canvas ref={canvas} style={{ width, height }} aria-label="Timing diagram of system update rates" />
        </Aperture>
      </div>
      <div className="heartbeatFooter">
        <p className="body" style={{ maxWidth: "62ch", margin: 0 }}>
          The detector can't run at control speed on a CPU, so the Kalman filter <span className="c-amber">projects the target forward between detections</span> and the gimbal never waits for vision.
        </p>
        <div style={{ width: 560 }}>
          <Slider label="Time window" value={Math.log10(windowSec)} min={-1.7} max={0.6} step={0.01} onChange={(v) => setWindowSec(10 ** v)} format={() => (windowSec < 1 ? `${Math.round(windowSec * 1000)} ms` : `${windowSec.toFixed(1)} s`)} accent={colors.green} />
        </div>
      </div>
    </div>
  );
};
