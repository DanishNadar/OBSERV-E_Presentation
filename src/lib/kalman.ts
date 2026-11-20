// Port of VLM/src/humanFollower/kalmanFilter.py: constant-velocity model, state [x, y, vx, vy, w, h]
type Matrix = number[][];

const zeros = (r: number, c: number): Matrix => Array.from({ length: r }, () => new Array(c).fill(0));
const identity = (n: number, v = 1): Matrix => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? v : 0)));
const diag = (values: number[]): Matrix => values.map((v, i) => values.map((_, j) => (i === j ? v : 0)));
const transpose = (m: Matrix): Matrix => m[0].map((_, j) => m.map((row) => row[j]));
const add = (a: Matrix, b: Matrix): Matrix => a.map((row, i) => row.map((v, j) => v + b[i][j]));
const sub = (a: Matrix, b: Matrix): Matrix => a.map((row, i) => row.map((v, j) => v - b[i][j]));

const mul = (a: Matrix, b: Matrix): Matrix => {
  const out = zeros(a.length, b[0].length);
  for (let i = 0; i < a.length; i++)
    for (let k = 0; k < b.length; k++) {
      const v = a[i][k];
      if (v !== 0) for (let j = 0; j < b[0].length; j++) out[i][j] += v * b[k][j];
    }
  return out;
};

// Gauss-Jordan inverse with partial pivoting
const invert = (m: Matrix): Matrix => {
  const n = m.length;
  const aug = m.map((row, i) => [...row, ...identity(n)[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(aug[r][c]) > Math.abs(aug[pivot][c])) pivot = r;
    [aug[c], aug[pivot]] = [aug[pivot], aug[c]];
    const p = aug[c][c] || 1e-12;
    for (let j = 0; j < 2 * n; j++) aug[c][j] /= p;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = aug[r][c];
      if (f !== 0) for (let j = 0; j < 2 * n; j++) aug[r][j] -= f * aug[c][j];
    }
  }
  return aug.map((row) => row.slice(n));
};

export interface KalmanConfig {
  processNoisePosition: number;
  processNoiseVelocity: number;
  processNoiseSize: number;
  measurementNoisePosition: number;
  measurementNoiseSize: number;
  initialCovariance: number;
}

// Defaults from the OBSERV-E config
export const defaultKalmanConfig: KalmanConfig = {
  processNoisePosition: 8,
  processNoiseVelocity: 25,
  processNoiseSize: 6,
  measurementNoisePosition: 10,
  measurementNoiseSize: 14,
  initialCovariance: 75,
};

const measurementMatrix: Matrix = [
  [1, 0, 0, 0, 0, 0],
  [0, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 1],
];

const transition = (dt: number): Matrix => {
  const t = Math.max(1e-4, dt);
  return [
    [1, 0, t, 0, 0, 0],
    [0, 1, 0, t, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 1, 0],
    [0, 0, 0, 0, 0, 1],
  ];
};

export class KalmanFilter {
  state: Matrix = [[0], [0], [0], [0], [1], [1]];
  covariance: Matrix;
  isInitialized = false;
  config: KalmanConfig;

  constructor(config: KalmanConfig = defaultKalmanConfig) {
    this.config = { ...config };
    this.covariance = identity(6, config.initialCovariance);
  }

  reset() {
    this.state = [[0], [0], [0], [0], [1], [1]];
    this.covariance = identity(6, this.config.initialCovariance);
    this.isInitialized = false;
  }

  initialize(x: number, y: number, w: number, h: number) {
    this.state = [[x], [y], [0], [0], [Math.max(1, w)], [Math.max(1, h)]];
    this.covariance = identity(6, this.config.initialCovariance);
    this.isInitialized = true;
  }

  // Q grows with dt: position by dt^2, velocity and size by dt
  private processNoise(dt: number) {
    const t = Math.max(1e-4, dt);
    const { processNoisePosition: p, processNoiseVelocity: v, processNoiseSize: s } = this.config;
    return diag([p * t * t, p * t * t, v * t, v * t, s * t, s * t]);
  }

  predict(dt: number) {
    if (!this.isInitialized) return;
    const f = transition(dt);
    this.state = mul(f, this.state);
    this.covariance = add(mul(mul(f, this.covariance), transpose(f)), this.processNoise(dt));
  }

  update(x: number, y: number, w: number, h: number) {
    if (!this.isInitialized) return this.initialize(x, y, w, h);
    const { measurementNoisePosition: rp, measurementNoiseSize: rs } = this.config;
    const r = diag([rp, rp, rs, rs]);
    const z: Matrix = [[x], [y], [Math.max(1, w)], [Math.max(1, h)]];
    const ht = transpose(measurementMatrix);
    const innovation = sub(z, mul(measurementMatrix, this.state));
    const s = add(mul(mul(measurementMatrix, this.covariance), ht), r);
    const gain = mul(mul(this.covariance, ht), invert(s));
    this.state = add(this.state, mul(gain, innovation));
    this.covariance = mul(sub(identity(6), mul(gain, measurementMatrix)), this.covariance);
  }

  predictFuture(dt: number) {
    return mul(transition(dt), this.state).map((row) => row[0]);
  }

  get vector() {
    return this.state.map((row) => row[0]);
  }

  get positionSigma(): [number, number] {
    return [Math.sqrt(Math.max(0, this.covariance[0][0])), Math.sqrt(Math.max(0, this.covariance[1][1]))];
  }
}
