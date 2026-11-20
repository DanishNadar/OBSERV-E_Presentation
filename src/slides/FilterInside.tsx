import { useRef, useState, type CSSProperties } from "react";
import { colors } from "../theme";
import { Kicker, Tilt } from "../components/ui";
import { useAnimationLoop, useMotion } from "../lib/hooks";
import { KalmanFilter } from "../lib/kalman";
import { seededRandom } from "../lib/random";

const names = ["x", "y", "vx", "vy", "w", "h"];
const meanings = ["box centre x, px", "box centre y, px", "horizontal velocity, px/s", "vertical velocity, px/s", "box width, px", "box height, px"];
const barScale = [1280, 720, 300, 300, 300, 400];
const stateColor =(i: number) => (i < 2 ? colors.amber : i < 4 ? colors.green : colors.cyan);

const Matrix = ({ rows, highlight }: { rows: (number | string)[][]; highlight?: (r: number, c: number) => string | undefined }) => (
  <div className="matrix">
    <div className="matrixBody" style={{ gridTemplateColumns: `repeat(${rows[0].length}, auto)` }}>
      {rows.flatMap((row, r) => row.map((v, c) => <span key={`${r}-${c}`} style={{ color: highlight?.(r, c) }}>{v}</span>))}
    </div>
  </div>
);

export const FilterInside = () => {
  const { reducedMotion } = useMotion();
  const sim = useRef({ filter: new KalmanFilter(), random: seededRandom(5), t: 0, acc: 0, frame: 0 });
  const [state, setState] = useState([640, 318, 0, 0, 124, 271]);
  const [projected, setProjected] = useState([640, 318, 0, 0, 124, 271]);
  const [payloads, setPayloads] = useState<string[]>([]);

  useAnimationLoop((dt) => {
    const s = sim.current;
    s.t += dt;
    s.acc += dt;
    if (s.acc < 1 / 15) return;
    s.acc = 0;
    s.filter.predict(1 / 15);
    const mx = 640 + Math.sin(s.t * 0.8) * 180 + s.random.gaussian() * 4;
    const my = 340 + Math.sin(s.t * 0.5) * 30 + s.random.gaussian() * 4;
    s.filter.update(mx, my, 124 + s.random.gaussian() * 3, 271 + s.random.gaussian() * 3);
    const v = s.filter.vector;
    const p = s.filter.predictFuture(0.008);
    setState(v);
    setProjected(p);
    s.frame += 1;
    const ex = (p[0] - 640) / 1280;
    const ey = (p[1] - 360) / 720;
    setPayloads((list) => [...list.slice(-7), `{"frameIndex":${s.frame},"targetLocked":true,"nextCenter":[${p[0].toFixed(1)},${p[1].toFixed(1)}],"normalizedError":[${ex.toFixed(4)},${ey.toFixed(4)}]}`]);
  }, !reducedMotion);

  return (
    <div className="slide filterInside">
      <Kicker act="IV" color={colors.amber}>Inside the filter</Kicker>
      <h2 className="title" style={{ fontSize: 58, maxWidth: 1600 }}>
        Six numbers describe the person. <span className="grad" style={{ "--g1": colors.amber, "--g2": colors.orange, "--g3": colors.magenta } as CSSProperties}>Two of them steer the camera.</span>
      </h2>
      <div className="filterGrid">
        <div className="stateColumn">
          {names.map((n, i) => (
            <Tilt key={n} className="stateRow glass" style={{ "--sc": stateColor(i) } as CSSProperties} max={8}>
              <span className="stateName mono">{n}</span>
              <span className="stateValue mono">{state[i].toFixed(1)}</span>
              <span className="stateMeaning">{meanings[i]}</span>
              <span className="stateBar"><i style={{ width: `${Math.min(100, (Math.abs(state[i]) / barScale[i]) * 100)}%` }} /></span>
            </Tilt>
          ))}
          <p className="body" style={{ marginTop: 18, fontSize: 19 }}>
            State order <span className="mono c-cyan">[x, y, vx, vy, w, h]</span>. Detections measure only position and size; velocity is inferred from how they change.
          </p>
        </div>
        <div className="equationColumn">
          <div className="eqBlock glass">
            <h4 className="c-amber">Predict, every frame</h4>
            <p className="eq mono">x̂ ← F x̂<br />P ← F P Fᵀ + Q(dt)</p>
            <Matrix rows={[[1, 0, "dt", 0, 0, 0], [0, 1, 0, "dt", 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 0, 1, 0, 0], [0, 0, 0, 0, 1, 0], [0, 0, 0, 0, 0, 1]]} highlight={(_, c) => (c === 2 || c === 3 ? colors.amber : undefined)} />
            <p className="eqNote">F: constant velocity. Q grows with dt: position by dt², velocity and size by dt.</p>
          </div>
          <div className="eqBlock glass">
            <h4 className="c-green">Update, when a box arrives</h4>
            <p className="eq mono">K = P Hᵀ (H P Hᵀ + R)⁻¹<br />x̂ ← x̂ + K (z − H x̂)<br />P ← (I − K H) P</p>
            <p className="eqNote">H picks out x, y, w, h. R = diag(10, 10, 14, 14) and P₀ = 75·I in the OBSERV-E config.</p>
          </div>
        </div>
        <div className="payloadColumn">
          <div className="eqBlock glass">
            <h4 className="c-magenta">Out to the gimbal</h4>
            <p className="body" style={{ fontSize: 19 }}>
              The projected state is pushed <span className="mono c-amber">predictionLeadMs = 8</span> into the future to cover actuator latency, then published at up to 300 Hz over UDP.
            </p>
            <div className="projected mono">
              nextCenter = ({projected[0].toFixed(1)}, {projected[1].toFixed(1)})<br />
              pixelError = ({(projected[0] - 640).toFixed(1)}, {(projected[1] - 360).toFixed(1)})
            </div>
          </div>
          <div className="payloadStream mono glass" aria-label="Live payload stream">
            {payloads.map((p, i) => <div key={i} style={{ opacity: 0.3 + (i / Math.max(1, payloads.length)) * 0.7 }}>{p}</div>)}
          </div>
          <span className="faint" style={{ fontSize: 15 }}>Payload format from gimbalOutput.py. Values simulated for a 1280×720 frame.</span>
        </div>
      </div>
    </div>
  );
};
